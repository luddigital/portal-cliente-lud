/**
 * Lud. Digital — motor de insights da análise de Instagram.
 *
 * A ideia: os EVENTOS são detectados de forma determinística no código (picos,
 * top posts, correlações, formatos), e só então mandamos os FATOS pro Claude
 * escrever o insight acionável. Assim a IA nunca inventa número — só interpreta
 * e sugere a próxima ação, ligada aos serviços da Lud. (tráfego pago etc).
 */
import { env } from './env';
import type { IgAnalytics, IgMediaItem } from './instagram';

export type InsightAcionavel = {
  /** Categoria pra ícone/cor no front. */
  tipo: 'trafego' | 'repetir' | 'cortar' | 'timing' | 'publico' | 'geral';
  titulo: string;
  texto: string;
};

function formatoDoPost(m: IgMediaItem): string {
  const t = (m.mediaType || '').toUpperCase();
  if (t === 'REELS') return 'Reels';
  if (t === 'CAROUSEL_ALBUM') return 'Carrossel';
  if (t === 'IMAGE') return 'Foto';
  if (t === 'VIDEO') return 'Vídeo';
  return 'Post';
}

function mediana(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function dataCurta(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Fatos determinísticos extraídos dos dados — a matéria-prima dos insights. */
export function detectarEventos(a: IgAnalytics) {
  // --- Pico de seguidores ---
  const serie = a.serieSeguidores;
  const med = mediana(serie.map((p) => p.valor).filter((v) => v > 0));
  let pico: { dia: string; valor: number } | null = null;
  for (const p of serie) {
    if (!pico || p.valor > pico.valor) pico = { dia: p.dia, valor: p.valor };
  }
  const picoRelevante =
    pico != null && med > 0 && pico.valor >= Math.max(med * 2, med + 30);

  // --- Post que coincide com o pico (candidato a "puxou o crescimento") ---
  let postDoPico: IgMediaItem | null = null;
  if (picoRelevante && pico) {
    const picoU = new Date(pico.dia).getTime();
    const janela = 2 * 86400000; // ±2 dias
    const candidatos = a.conteudos
      .filter((m) => {
        const t = Date.parse(m.timestamp);
        return Number.isFinite(t) && Math.abs(t - picoU) <= janela;
      })
      .sort((x, y) => y.reach - x.reach || y.views - x.views);
    postDoPico = candidatos[0] ?? null;
  }

  // --- Top posts por views ---
  const topPosts = [...a.conteudos]
    .sort((x, y) => y.views - x.views || y.interactions - x.interactions)
    .slice(0, 3)
    .map((m) => ({
      legenda: (m.caption || 'Sem legenda').slice(0, 90),
      formato: formatoDoPost(m),
      data: dataCurta(m.timestamp),
      views: m.views,
      alcance: m.reach,
      interacoes: m.interactions,
      curtidas: m.likes,
      comentarios: m.comments,
      salvos: m.saved,
    }));

  // --- Desempenho médio por formato ---
  const porFormato = new Map<string, { qtd: number; views: number; inter: number; reach: number }>();
  for (const m of a.conteudos) {
    const f = formatoDoPost(m);
    const cur = porFormato.get(f) ?? { qtd: 0, views: 0, inter: 0, reach: 0 };
    cur.qtd += 1;
    cur.views += m.views;
    cur.inter += m.interactions;
    cur.reach += m.reach;
    porFormato.set(f, cur);
  }
  const formatos = [...porFormato.entries()].map(([formato, v]) => ({
    formato,
    qtd: v.qtd,
    mediaViews: Math.round(v.views / v.qtd),
    mediaInteracoes: Math.round(v.inter / v.qtd),
    mediaAlcance: Math.round(v.reach / v.qtd),
  }));

  return {
    periodo: a.period,
    seguidores: {
      total: a.account.followersCount,
      ganhoLiquido: a.atual.novosSeguidores,
      pico: picoRelevante && pico ? { data: dataCurta(pico.dia), valor: pico.valor } : null,
    },
    postDoPico: postDoPico
      ? {
          legenda: (postDoPico.caption || 'Sem legenda').slice(0, 90),
          formato: formatoDoPost(postDoPico),
          data: dataCurta(postDoPico.timestamp),
          views: postDoPico.views,
          alcance: postDoPico.reach,
          interacoes: postDoPico.interactions,
        }
      : null,
    topPosts,
    formatos,
    kpis: {
      views: a.atual.views,
      alcance: a.atual.reach,
      interacoes: a.atual.interactions,
      taxaEngajamento: `${(a.taxaEngajamento * 100).toFixed(1)}%`,
      visitasPerfil: a.atual.profileViews,
    },
    viewsPorTipo: a.viewsPorTipo.map((i) => ({ tipo: i.chave, views: i.valor })),
    publico: a.publico,
  };
}

export type Audiencia = 'interno' | 'cliente';

function systemPrompt(audiencia: Audiencia): string {
  const tom =
    audiencia === 'cliente'
      ? `AUDIÊNCIA: o CLIENTE (dono da conta) vai ler no portal dele.
Tom: acolhedor, positivo e claro — mostra o valor que a Lud. entrega. Fale como parceira que está cuidando da conta ("a gente", "vamos").
- Foque no que ESTÁ FUNCIONANDO e no que a Lud. vai fazer a seguir.
- Evite jargão interno e ordens secas tipo "corta isso"; enquadre como "vamos ajustar", "vamos priorizar".
- Não exponha estratégia interna crua (verba, corte agressivo); traduza pra benefício do cliente.`
      : `AUDIÊNCIA: a EQUIPE INTERNA da Lud. (uso no admin).
Tom: tático, direto, sem rodeio. Pode dizer "corta isso", "sobe campanha", "aumenta a cadência". Cheio de número. É ferramenta de decisão do time.`;

  return `Você é estrategista de social media da Lud. Digital, um hub de marketing digital.
Recebe FATOS REAIS de performance de uma conta de Instagram no período e escreve insights ACIONÁVEIS.

${tom}

REGRAS INEGOCIÁVEIS (valem pros dois tons):
- Use APENAS os números que estão nos fatos. NUNCA invente valores, datas ou métricas.
- A API do Instagram NÃO diz quantos seguidores um post trouxe. Se um post coincide com um pico, fale em PROBABILIDADE ("provavelmente puxou", "coincidiu com"), nunca como causa provada.
- Se o cliente TEM tráfego pago ativo e um post teve tração orgânica forte, sugira impulsionar esse criativo. Se NÃO tem tráfego pago, não invente que tem.
- Se houver META do mês, PRIORIZE os insights que ajudam a bater essa meta, e referencie o progresso real rumo a ela.
- Cada insight termina com uma AÇÃO concreta.

HIERARQUIA: o PRIMEIRO insight do array é o mais importante do período (vira destaque na tela). Escolha o de maior impacto pra ser o #1. Gere de 3 a 5 insights no total.

Responda APENAS com um JSON válido, sem texto antes ou depois, no formato:
[{"tipo":"trafego|repetir|cortar|timing|publico|geral","titulo":"...","texto":"..."}]`;
}

/** Gera os insights acionáveis chamando o Claude com os fatos já detectados. */
export async function gerarInsightsAnalise(params: {
  a: IgAnalytics;
  clienteNome?: string;
  temTrafegoPago: boolean;
  adsResumo?: string;
  audiencia: Audiencia;
  /** Resumo do objetivo + progresso rumo às metas do mês (do Notion). */
  metaContexto?: string;
}): Promise<InsightAcionavel[]> {
  if (!env.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  const fatos = detectarEventos(params.a);

  const contexto = [
    params.clienteNome ? `Cliente: ${params.clienteNome}.` : '',
    params.metaContexto ? `META DO MÊS: ${params.metaContexto}` : '',
    params.temTrafegoPago
      ? `O cliente TEM serviço de tráfego pago com a Lud.${params.adsResumo ? ' ' + params.adsResumo : ''}`
      : 'O cliente NÃO tem tráfego pago ativo no momento.',
  ]
    .filter(Boolean)
    .join(' ');

  // @ts-ignore — dependência opcional (igual ao claude.ts)
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default;
  const client = new Anthropic({ apiKey: env.anthropic.apiKey });

  const resp = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 1400,
    system: systemPrompt(params.audiencia),
    messages: [
      {
        role: 'user',
        content: `${contexto}\n\nFATOS DO PERÍODO (JSON):\n${JSON.stringify(fatos, null, 2)}\n\nEscreva os insights acionáveis pra Lud.`,
      },
    ],
  });

  const bloco = resp.content.find((b: any) => b.type === 'text') as
    | { type: 'text'; text: string }
    | undefined;
  const raw = (bloco?.text ?? '').trim();
  return parseInsights(raw);
}

/** Extrai o array JSON da resposta, resiliente a texto extra em volta. */
function parseInsights(raw: string): InsightAcionavel[] {
  const tentativas = [raw];
  const ini = raw.indexOf('[');
  const fim = raw.lastIndexOf(']');
  if (ini >= 0 && fim > ini) tentativas.push(raw.slice(ini, fim + 1));

  for (const t of tentativas) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) {
        return arr
          .filter((x) => x && typeof x.titulo === 'string' && typeof x.texto === 'string')
          .map((x) => ({
            tipo: (
              ['trafego', 'repetir', 'cortar', 'timing', 'publico', 'geral'].includes(x.tipo)
                ? x.tipo
                : 'geral'
            ) as InsightAcionavel['tipo'],
            titulo: String(x.titulo),
            texto: String(x.texto),
          }));
      }
    } catch {
      // tenta a próxima
    }
  }
  return [];
}
