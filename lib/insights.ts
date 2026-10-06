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

/** Formata um post pro payload (versão enxuta pra IA consumir). */
function fatoPost(m: IgMediaItem) {
  return {
    legenda: (m.caption || 'Sem legenda').slice(0, 90),
    formato: formatoDoPost(m),
    data: dataCurta(m.timestamp),
    views: m.views,
    alcance: m.reach,
    interacoes: m.interactions,
    curtidas: m.likes,
    comentarios: m.comments,
    salvos: m.saved,
    compartilhamentos: m.shares,
  };
}

/** Delta percentual (2 casas). Retorna null se base for 0 (evita "infinito%"). */
function deltaPct(atual: number, anterior: number): number | null {
  if (!anterior || anterior === 0) return null;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

/** Fatos determinísticos extraídos dos dados — a matéria-prima dos insights.
 *
 *  Filosofia: passar MÚLTIPLOS ÂNGULOS (não só top-por-views). A IA precisa
 *  ver os top por alcance, por salvamento, por compartilhamento etc. — porque
 *  um post "que funcionou" pode ser diferente em cada dimensão. Também passa
 *  o CONTRASTE do período (o que subiu vs o que caiu) e a fatia % do volume
 *  que cada formato representa — pra IA poder dizer "35% do volume rendeu
 *  menos que 1 Reel sozinho" em vez de só "carrossel teve média baixa". */
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

  // --- Contraste vs período anterior (o quê subiu, o quê caiu) ---
  const contraste = {
    alcance: {
      atual: a.atual.reach,
      anterior: a.anterior.reach,
      variacaoPct: deltaPct(a.atual.reach, a.anterior.reach),
    },
    views: {
      atual: a.atual.views,
      anterior: a.anterior.views,
      variacaoPct: deltaPct(a.atual.views, a.anterior.views),
    },
    interacoes: {
      atual: a.atual.interactions,
      anterior: a.anterior.interactions,
      variacaoPct: deltaPct(a.atual.interactions, a.anterior.interactions),
    },
    contasEngajadas: {
      atual: a.atual.engagedAccounts,
      anterior: a.anterior.engagedAccounts,
      variacaoPct: deltaPct(a.atual.engagedAccounts, a.anterior.engagedAccounts),
    },
    visitasPerfil: {
      atual: a.atual.profileViews,
      anterior: a.anterior.profileViews,
      variacaoPct: deltaPct(a.atual.profileViews, a.anterior.profileViews),
    },
    seguidoresNovos: {
      atual: a.atual.novosSeguidores,
      anterior: a.anterior.novosSeguidores,
      variacaoPct: deltaPct(a.atual.novosSeguidores, a.anterior.novosSeguidores),
    },
  };

  // --- Top posts por VÁRIAS métricas ---
  // A ideia: um post pode "funcionar" de jeitos diferentes. O top por alcance
  // não é o mesmo que o top por salvamento (que sinaliza conteúdo educativo)
  // ou por compartilhamento (indicação boca a boca). Passar os 3 pra IA.
  const posts = a.conteudos;
  const topPor = {
    views: [...posts].sort((x, y) => y.views - x.views).slice(0, 3).map(fatoPost),
    alcance: [...posts].sort((x, y) => y.reach - x.reach).slice(0, 3).map(fatoPost),
    salvos: [...posts].sort((x, y) => y.saved - x.saved).slice(0, 3).map(fatoPost),
    compartilhamentos: [...posts]
      .sort((x, y) => y.shares - x.shares)
      .slice(0, 3)
      .map(fatoPost),
    comentarios: [...posts]
      .sort((x, y) => y.comments - x.comments)
      .slice(0, 3)
      .map(fatoPost),
    interacoes: [...posts]
      .sort((x, y) => y.interactions - x.interactions)
      .slice(0, 3)
      .map(fatoPost),
  };

  // --- Desempenho por formato (agregados + FATIA % DO VOLUME) ---
  // Pra IA poder dizer "35% do volume rendeu X" em vez de só "média baixa".
  const totalPosts = posts.length;
  const totalViews = posts.reduce((s, m) => s + m.views, 0);
  const totalAlcance = posts.reduce((s, m) => s + m.reach, 0);
  const totalInter = posts.reduce((s, m) => s + m.interactions, 0);

  const porFormato = new Map<
    string,
    { qtd: number; views: number; inter: number; reach: number; saved: number; shares: number }
  >();
  for (const m of posts) {
    const f = formatoDoPost(m);
    const cur = porFormato.get(f) ?? { qtd: 0, views: 0, inter: 0, reach: 0, saved: 0, shares: 0 };
    cur.qtd += 1;
    cur.views += m.views;
    cur.inter += m.interactions;
    cur.reach += m.reach;
    cur.saved += m.saved;
    cur.shares += m.shares;
    porFormato.set(f, cur);
  }
  const pct = (n: number, tot: number) =>
    tot > 0 ? Number(((n / tot) * 100).toFixed(1)) : 0;
  const formatos = [...porFormato.entries()]
    .map(([formato, v]) => ({
      formato,
      qtd: v.qtd,
      pctDosPosts: pct(v.qtd, totalPosts),
      pctDoAlcance: pct(v.reach, totalAlcance),
      pctDasViews: pct(v.views, totalViews),
      pctDasInteracoes: pct(v.inter, totalInter),
      mediaViews: v.qtd ? Math.round(v.views / v.qtd) : 0,
      mediaInteracoes: v.qtd ? Math.round(v.inter / v.qtd) : 0,
      mediaAlcance: v.qtd ? Math.round(v.reach / v.qtd) : 0,
      mediaSalvos: v.qtd ? Math.round(v.saved / v.qtd) : 0,
      mediaCompartilhamentos: v.qtd ? Math.round(v.shares / v.qtd) : 0,
      alcanceTotal: v.reach,
      viewsTotal: v.views,
    }))
    .sort((a, b) => b.mediaAlcance - a.mediaAlcance);

  // --- Piores 3 posts (pra ancorar "o que evitar" em post específico) ---
  const piores = [...posts]
    .filter((m) => m.reach > 0 || m.views > 0) // ignora vazio
    .sort((x, y) => x.reach + x.views - (y.reach + y.views))
    .slice(0, 3)
    .map(fatoPost);

  // --- Alcance seguidores vs não-seguidores em % ---
  const alcanceSplit = a.publico
    ? {
        seguidores: a.publico.seguidores,
        naoSeguidores: a.publico.naoSeguidores,
        pctSeguidores: pct(
          a.publico.seguidores,
          a.publico.seguidores + a.publico.naoSeguidores,
        ),
        pctNaoSeguidores: pct(
          a.publico.naoSeguidores,
          a.publico.seguidores + a.publico.naoSeguidores,
        ),
      }
    : null;

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
    contraste,
    topPor,
    piores,
    formatos,
    totalPostsPeriodo: totalPosts,
    kpis: {
      views: a.atual.views,
      alcance: a.atual.reach,
      interacoes: a.atual.interactions,
      contasEngajadas: a.atual.engagedAccounts,
      taxaEngajamento: `${(a.taxaEngajamento * 100).toFixed(1)}%`,
      visitasPerfil: a.atual.profileViews,
    },
    viewsPorTipo: a.viewsPorTipo.map((i) => ({ tipo: i.chave, views: i.valor })),
    alcanceSplit,
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

const REGRAS_COPY = `REGRAS DE ESCRITA (obrigatórias):

1. TODO INSIGHT PRECISA DE NÚMERO REAL DO PERÍODO. Nada de "engajamento foi bom" sem citar o número que prova. Se você não tem o número no fato, não escreve o insight.

2. NUNCA use travessão (—). Use dois pontos, ponto final ou vírgula.

3. PROIBIDO usar estas frases e conectores vazios:
   - "ou seja", "é por isso que", "isso mostra que", "muda completamente"
   - "quando você entende", "é aí que"
   - "crescimento consistente", "resultado sólido", "performance boa"
   - "deixa de X e vira Y"
   - qualquer coisa com tom de guru ("eu sempre digo", "a verdade é que")

4. PROIBIDO relatório corporativo. Nada de "houve um crescimento significativo".
   Escreve como quem olha os números e fala a real com quem tá do lado.

5. Frases curtas. Nome de post, formato e número específicos.

6. Nada de inventar. Use SÓ os números que estão nos fatos.`;

function systemPrompt(audiencia: Audiencia): string {
  const tom =
    audiencia === 'cliente'
      ? 'AUDIÊNCIA: o CLIENTE lê no portal dele. Tom acolhedor mas direto. Sem enrolação, sem tom corporativo. Fale como parceira ("a gente", "vamos"), mas sem suavizar o que não funcionou.'
      : 'AUDIÊNCIA: a EQUIPE da Lud. Tom tático, cru, apoiado em número. Pode ser explícito ("reduzir cadência", "cortar formato").';

  return `Você é estrategista de social media da Lud. Digital.
Recebe FATOS REAIS de um período de Instagram e escreve uma ANÁLISE DO PERÍODO estruturada.

${tom}

${REGRAS_COPY}

REGRAS DE CONTEÚDO POR CAMPO — leia com atenção, essas instruções são o QUE torna a análise útil:

—— "resumo" (abertura) ——
Abra com o CONTRASTE REAL do mês, não com uma métrica isolada.
Formato: "X subiu Y% mas Z caiu W%. O motivo aparece nos números: <fato dos dados>."
Use o objeto "contraste" pra achar o contraste (ex: alcance subiu mas interações caíram).
Explique o motivo com um número dos fatos (ex: % de alcance que veio de não-seguidores).
NUNCA lidere por número de seguidores se "seguidoresGanhoParcial" for true.

—— "funcionou" (o que funcionou) ——
NÃO ranqueie só por 1 métrica (nunca só views).
Traga 3 ÂNGULOS DIFERENTES do que funcionou, cada um com um post específico e o número que prova, e SOBRETUDO com o MOTIVO DE CADA UM IMPORTAR:
  - Um post por ALCANCE alto (impacto de descoberta)
  - Um post por SALVAMENTO alto (sinal de conteúdo educativo/de guarda)
  - Um post por COMPARTILHAMENTO ou COMENTÁRIO alto (indicação boca a boca ou conversa)
Use o objeto "topPor" pra achar os candidatos. Se os 3 forem o mesmo post, use 2 ângulos + explique que foi o mesmo (raro).
Termina reforçando: "três motivos diferentes de performar, não o mesmo padrão repetido" — só quando de fato forem posts diferentes.

—— "evitar" (o que não funcionou) ——
OBRIGATÓRIO em todo relatório. Tão concreto quanto "funcionou".
Aponte FORMATO ou POST específico com:
  - Número (média de alcance/views/interações)
  - FATIA DO VOLUME que ele representa (use o campo pctDosPosts do formato)
  - IMPACTO (ex: "35% do volume rendeu menos alcance que 1 Reel sozinho")
Feche com a ação: "cortar/reduzir esse formato é a ação de maior impacto pro próximo mês."
Use o objeto "formatos" (ordenado por mediaAlcance decrescente — os últimos são os que puxaram pra baixo) e "piores" (posts individuais que renderam menos).

—— "publico" (quem estamos atraindo) ——
Use demografia (gênero, idade, país majoritário). Se tem "alcanceSplit", combine com o % de seguidores vs não-seguidores.
Formato: "Público é X% <gênero>, concentrado em <faixa>, majoritariamente <país>. Alcance veio Y% de <seguidores/não>."
Sem dado, devolva "".

—— "seguidores" (leitura do crescimento) ——
Se "seguidoresGanhoParcial" for true, DEIXE CLARO que o ganho só cobre os últimos ~30 dias (a API não guarda mais que isso).
Se um post coincide com o pico ("postDoPico"), diga "provavelmente puxou o pico" — nunca como certeza.
Formato: "Ganho de X seguidores (Y dias com dado). O pico foi Z no dia D, provavelmente puxado por <post>."

—— "sugestoes" (Pro próximo período) ——
3 a 5 ações CONCRETAS ancoradas nos fatos deste período.
Cada uma cita um formato/tema/post + o número que motiva a ação.
Se houver META no contexto, priorize o que ajuda a bater.
Se o cliente TEM tráfego pago e um post bombou, sugira impulsionar aquele criativo específico.

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
