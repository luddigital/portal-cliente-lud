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

/** Análise estruturada do período, escrita pela IA no estilo do guia de copy
 *  da Lud. (frases curtas, específicas, sem travessão, sem genérico). */
export type AnaliseIA = {
  /** Frase-resumo do topo: o fato mais forte e honesto do período. */
  resumo: string;
  /** O que funcionou (padrão de conteúdo vencedor). */
  funcionou: string;
  /** O que evitar repetir. */
  evitar: string;
  /** Quem estamos atraindo (público). */
  publico: string;
  /** Leitura do crescimento de seguidores. */
  seguidores: string;
  /** 3 a 5 ações pro próximo período. */
  sugestoes: string[];
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
    demografia: a.demografia
      ? {
          genero: a.demografia.genero.slice(0, 3),
          idade: a.demografia.idade,
          paises: a.demografia.paises.slice(0, 4),
        }
      : null,
    // Crescimento de seguidores só cobre a janela recente da API (~30 dias).
    // Em períodos maiores, o ganho NÃO representa o período todo.
    seguidoresGanhoParcial:
      serie.length > 0 && serie.length < a.period.dias - 3,
    diasComDadoSeguidores: serie.length,
  };
}

export type Audiencia = 'interno' | 'cliente';

const REGRAS_COPY = `REGRAS DE ESCRITA (guia de copy da Lud.):
- Frases curtas e específicas. Sempre com número ou nome real do post.
- NUNCA use travessão (—). Use dois pontos, vírgula ou nova frase.
- PROIBIDO frase genérica: nada de "muda completamente", "crescimento consistente", "deixa de X e vira Y", "quando você entende", "é aí que", "ou seja", "e é por isso que", nem tom de guru ("eu sempre digo").
- Nada de inventar. Use SÓ os números que estão nos fatos.
- Tom de conversa, direto, sem enrolação.`;

function systemPrompt(audiencia: Audiencia): string {
  const tom =
    audiencia === 'cliente'
      ? 'AUDIÊNCIA: o CLIENTE lê no portal dele. Tom acolhedor e claro, mostrando o valor. Fale como parceira ("a gente", "vamos"). Sem jargão interno nem ordens secas.'
      : 'AUDIÊNCIA: a EQUIPE da Lud. (admin). Tom tático e direto, pode ser mais cru ("priorizar", "reduzir a cadência"), bem apoiado em número.';

  return `Você é estrategista de social media da Lud. Digital.
Recebe FATOS REAIS de um período de Instagram e escreve uma ANÁLISE DO PERÍODO estruturada.

${tom}

${REGRAS_COPY}

Escreva um texto curto pra cada campo:
- "resumo": frase de abertura. Puxe o fato mais forte e HONESTO do período: de preferência VIEWS e ALCANCE (que cobrem o período todo) + o padrão de conteúdo que liderou. NUNCA lidere por número de seguidores se "seguidoresGanhoParcial" for true. Proibido frase genérica.
- "funcionou": o formato/padrão de conteúdo que mais performou, com nome de post e número real.
- "evitar": o que rendeu menos e vale repetir menos, com o porquê curto.
- "publico": quem a conta atrai (use a demografia: gênero, idade, país). Sem demografia, fale do split seguidores/não-seguidores. Sem nada, devolva "".
- "seguidores": leitura do crescimento. Se "seguidoresGanhoParcial" for true, deixe claro que o ganho é só dos últimos dias (a API não guarda o histórico). Se um post coincide com o pico, diga "provavelmente puxou", nunca como certeza.
- "sugestoes": 3 a 5 ações concretas pro PRÓXIMO período. Se houver META, priorize o que ajuda a bater. Se o cliente TEM tráfego pago e um post bombou, sugira impulsionar esse criativo.

Se um campo não tiver dado suficiente, devolva "" (ou [] em sugestoes). Não invente.

Responda APENAS com JSON válido, sem texto antes ou depois:
{"resumo":"...","funcionou":"...","evitar":"...","publico":"...","seguidores":"...","sugestoes":["...","..."]}`;
}

/** Gera a análise estruturada do período chamando o Claude. */
export async function gerarAnaliseIA(params: {
  a: IgAnalytics;
  clienteNome?: string;
  temTrafegoPago: boolean;
  adsResumo?: string;
  audiencia: Audiencia;
  /** Resumo do objetivo + progresso rumo às metas do mês (do Notion). */
  metaContexto?: string;
}): Promise<AnaliseIA> {
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
    max_tokens: 1500,
    system: systemPrompt(params.audiencia),
    messages: [
      {
        role: 'user',
        content: `${contexto}\n\nFATOS DO PERÍODO (JSON):\n${JSON.stringify(fatos, null, 2)}\n\nEscreva a análise do período.`,
      },
    ],
  });

  const bloco = resp.content.find((b: any) => b.type === 'text') as
    | { type: 'text'; text: string }
    | undefined;
  return parseAnalise((bloco?.text ?? '').trim());
}

/** Extrai o objeto JSON da resposta, resiliente a texto extra em volta. */
function parseAnalise(raw: string): AnaliseIA {
  const vazio: AnaliseIA = {
    resumo: '',
    funcionou: '',
    evitar: '',
    publico: '',
    seguidores: '',
    sugestoes: [],
  };
  const tentativas = [raw];
  const ini = raw.indexOf('{');
  const fim = raw.lastIndexOf('}');
  if (ini >= 0 && fim > ini) tentativas.push(raw.slice(ini, fim + 1));

  for (const t of tentativas) {
    try {
      const o = JSON.parse(t);
      if (o && typeof o === 'object') {
        const str = (v: unknown) => (typeof v === 'string' ? v : '');
        return {
          resumo: str(o.resumo),
          funcionou: str(o.funcionou),
          evitar: str(o.evitar),
          publico: str(o.publico),
          seguidores: str(o.seguidores),
          sugestoes: Array.isArray(o.sugestoes)
            ? o.sugestoes.filter((s: unknown) => typeof s === 'string').slice(0, 5)
            : [],
        };
      }
    } catch {
      // tenta a próxima
    }
  }
  return vazio;
}
