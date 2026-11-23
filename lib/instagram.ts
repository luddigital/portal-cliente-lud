import { unstable_cache } from 'next/cache';
import { env } from './env';

const BASE = 'https://graph.facebook.com';

export type IgAccount = {
  igUserId: string;
  username: string;
  name: string;
  profilePicture: string | null;
  followersCount: number;
  pageName: string;
};

export type IgPeriodInsights = {
  reach: number;
  interactions: number;
  engagedAccounts: number;
  profileViews: number;
  novosSeguidores: number;
  /** Total de visualizações de conteúdo no período (métrica `views` da conta). */
  views: number;
};

/** Uma fatia de um breakdown (ex.: por tipo de conteúdo, por público). */
export type IgBreakdownItem = { chave: string; valor: number };

export type IgMediaItem = {
  id: string;
  caption: string;
  mediaType: string;
  thumbnail: string | null;
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
  reach: number;
  interactions: number;
  /** Salvamentos (posts, carrosséis e reels). */
  saved: number;
  /** Compartilhamentos (mais confiável em reels). */
  shares: number;
  /** Views/plays de vídeo. 0 se não é vídeo. */
  views: number;
  /** Seguidores ganhos pelo post (métrica `follows`). 0 se a API não expõe
   *  essa métrica pra conta/versão. */
  seguidores: number;
  /** Título do post no Notion, casado por data de publicação. Opcional. */
  tituloNotion?: string;
};

export type IgPontoSerie = { dia: string; valor: number };

export type IgAnalytics = {
  account: IgAccount;
  period: { since: string; until: string; dias: number };
  atual: IgPeriodInsights;
  anterior: IgPeriodInsights;
  /** Melhores conteúdos (mais engajamento) do período. */
  topMedia: IgMediaItem[];
  /** Piores conteúdos (menor engajamento) do período. */
  topPiores: IgMediaItem[];
  /** Todos os conteúdos do período (feed + reels), pra aba Conteúdo com busca
   *  e ordenação por métrica. Limitado às últimas ~50 publicações. */
  conteudos: IgMediaItem[];
  /** True se a API devolveu `follows` (seguidores por post) pra pelo menos um
   *  conteúdo — habilita a coluna/ordenação por Seguidores. */
  temSeguidoresPorPost: boolean;
  taxaEngajamento: number;
  /** Reach diário no período. */
  serieAlcance: IgPontoSerie[];
  /** Views (visualizações) diárias no período. */
  serieViews: IgPontoSerie[];
  /** Views quebradas por tipo de conteúdo (Reels, Stories, Posts, …).
   *  Vazio se a conta/versão da API não expõe o breakdown. */
  viewsPorTipo: IgBreakdownItem[];
  /** Alcance dividido entre seguidores e não-seguidores. null se a API
   *  não expõe o breakdown pra essa conta. */
  publico: { seguidores: number; naoSeguidores: number } | null;
  /** Demografia dos seguidores (foto do momento). null se a API não expõe
   *  (conta com <100 seguidores ou versão sem o breakdown). */
  demografia: {
    genero: IgBreakdownItem[];
    idade: IgBreakdownItem[];
    paises: IgBreakdownItem[];
    cidades: IgBreakdownItem[];
  } | null;
  /** Delta diário de seguidores (signed: positivo = entraram, negativo = saíram).
   *  Não dá pra separar entraram vs saíram nos mesmos dia — IG API só expõe
   *  o saldo líquido por dia. */
  serieSeguidores: IgPontoSerie[];
  /** Contas que se engajaram (clique, like, save, comment, etc) por dia. */
  serieEngajamento: IgPontoSerie[];
  /** Diagnóstico do casamento de títulos do Notion (só preenchido pro admin). */
  debugTitulos?: {
    projetoId: string;
    titulosNoPeriodo: number;
    postsCasados: number;
    totalPosts: number;
    amostraDatasNotion: string[];
    amostraDatasIg: string[];
  };
};

/** True quando o token da Graph API está configurado no ambiente. */
export function igConfigured(): boolean {
  return Boolean(env.instagram.graphToken);
}

class IgError extends Error {}

const cache = new Map<string, { exp: number; data: unknown }>();
const TTL_MS = 10 * 60 * 1000;

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = env.instagram.graphToken;
  if (!token) throw new IgError('IG_GRAPH_TOKEN não configurado');

  const qs = new URLSearchParams({ ...params, access_token: token });
  const url = `${BASE}/${env.instagram.graphVersion}/${path}?${qs}`;

  const key = url;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data as T;

  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || json?.error) {
    const msg = json?.error?.message ?? `Graph API ${res.status}`;
    throw new IgError(msg);
  }
  cache.set(key, { exp: Date.now() + TTL_MS, data: json });
  return json as T;
}

/** Lista as contas Instagram acessíveis pelo token (via Páginas do Business Manager). */
export async function listIgAccounts(): Promise<IgAccount[]> {
  const json = await graph<{ data: any[] }>('me/accounts', {
    fields:
      'name,instagram_business_account{id,username,name,profile_picture_url,followers_count}',
    limit: '100',
  });
  const out: IgAccount[] = [];
  for (const page of json.data ?? []) {
    const ig = page.instagram_business_account;
    if (!ig?.id) continue;
    out.push({
      igUserId: ig.id,
      username: ig.username ?? '',
      name: ig.name ?? ig.username ?? '',
      profilePicture: ig.profile_picture_url ?? null,
      followersCount: ig.followers_count ?? 0,
      pageName: page.name ?? '',
    });
  }
  return out.sort((a, b) => a.username.localeCompare(b.username, 'pt-BR'));
}

async function getAccount(igUserId: string): Promise<IgAccount> {
  const json = await graph<any>(igUserId, {
    fields: 'username,name,profile_picture_url,followers_count',
  });
  return {
    igUserId,
    username: json.username ?? '',
    name: json.name ?? json.username ?? '',
    profilePicture: json.profile_picture_url ?? null,
    followersCount: json.followers_count ?? 0,
    pageName: '',
  };
}

/** Soma um insight de conta no período. Cada métrica é resiliente a falha isolada. */
async function totalValue(
  igUserId: string,
  metric: string,
  since: string,
  until: string,
): Promise<number> {
  try {
    const json = await graph<any>(`${igUserId}/insights`, {
      metric,
      metric_type: 'total_value',
      period: 'day',
      since,
      until,
    });
    const node = json?.data?.[0];
    return node?.total_value?.value ?? 0;
  } catch {
    return 0;
  }
}

async function getPeriodInsights(
  igUserId: string,
  since: string,
  until: string,
): Promise<IgPeriodInsights> {
  const [
    reach,
    interactions,
    engagedAccounts,
    profileViews,
    novosSeguidores,
    views,
  ] = await Promise.all([
    totalValue(igUserId, 'reach', since, until),
    totalValue(igUserId, 'total_interactions', since, until),
    totalValue(igUserId, 'accounts_engaged', since, until),
    totalValue(igUserId, 'profile_views', since, until),
    // follower_count NÃO é compatível com total_value (a API recusa). Vem como
    // série diária de saldo líquido — somamos pra ter o ganho do período.
    sumTimeSeries(igUserId, 'follower_count', since, until),
    totalValue(igUserId, 'views', since, until),
  ]);
  return {
    reach,
    interactions,
    engagedAccounts,
    profileViews,
    novosSeguidores,
    views,
  };
}

/** Soma os valores diários de uma métrica time_series no período. */
async function sumTimeSeries(
  igUserId: string,
  metric: string,
  since: string,
  until: string,
): Promise<number> {
  const pts = await timeSeries(igUserId, metric, since, until);
  return pts.reduce((acc, p) => acc + p.valor, 0);
}

async function timeSeries(
  igUserId: string,
  metric: string,
  since: string,
  until: string,
): Promise<IgPontoSerie[]> {
  // A partir da API v22, `metric_type=time_series` foi deprecado pra
  // várias métricas. Pro follower_count especialmente ele passa a devolver
  // erro/vazio. Pra outras métricas o padrão é time_series então omitir
  // funciona igual.
  const params: Record<string, string> = {
    metric,
    period: 'day',
    since,
    until,
  };
  if (metric !== 'follower_count') {
    params.metric_type = 'time_series';
  }
  try {
    const json = await graph<any>(`${igUserId}/insights`, params);
    const node = json?.data?.[0];
    const arr: any[] = node?.values ?? [];
    return arr.map((v) => ({
      dia: typeof v.end_time === 'string' ? v.end_time.slice(0, 10) : '',
      valor: typeof v.value === 'number' ? v.value : 0,
    }));
  } catch {
    return [];
  }
}

async function getMediaInsights(
  mediaId: string,
  mediaType: string,
): Promise<{
  reach: number;
  interactions: number;
  saved: number;
  shares: number;
  views: number;
  seguidores: number;
}> {
  // shares/views só fazem sentido em vídeo/reels. IMAGE e CAROUSEL_ALBUM
  // não têm shares (a API rejeita a métrica).
  const ehVideo = mediaType === 'VIDEO' || mediaType === 'REELS';
  const base = ehVideo
    ? 'reach,total_interactions,saved,shares,views'
    : 'reach,total_interactions,saved';
  // Tenta incluir `follows` (seguidores ganhos pelo post — o que o Business
  // Suite mostra na coluna "Seguidores"). Se a versão da API recusar a
  // métrica, refaz sem ela — sem quebrar as outras.
  const zero = { reach: 0, interactions: 0, saved: 0, shares: 0, views: 0, seguidores: 0 };
  for (const metrics of [`${base},follows`, base]) {
    try {
      const json = await graph<any>(`${mediaId}/insights`, { metric: metrics });
      const out = { ...zero };
      for (const m of json?.data ?? []) {
        const v =
          m?.values?.[0]?.value ??
          m?.total_value?.value ??
          0;
        if (m.name === 'reach') out.reach = v;
        else if (m.name === 'total_interactions') out.interactions = v;
        else if (m.name === 'saved') out.saved = v;
        else if (m.name === 'shares') out.shares = v;
        else if (m.name === 'views') out.views = v;
        else if (m.name === 'follows') out.seguidores = v;
      }
      return out;
    } catch {
      // tenta a próxima combinação (sem follows)
    }
  }
  return zero;
}

/** Traz todos os posts do período ordenados por engajamento (desc).
 *  Fatiar depois pra pegar melhores e piores separadamente. */
async function getMediaOrdenada(
  igUserId: string,
  sinceUnix: number,
  fimUnix: number,
): Promise<IgMediaItem[]> {
  const json = await graph<{ data: any[] }>(`${igUserId}/media`, {
    fields:
      'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: '50',
  });
  // Filtra pelo período INTEIRO (início E fim). Antes só checava o início, então
  // posts posteriores ao "até" vazavam (ex: post de agosto num filtro de julho).
  const recentes = (json.data ?? []).filter((m) => {
    const t = Date.parse(m.timestamp) / 1000;
    return Number.isFinite(t) && t >= sinceUnix && t <= fimUnix;
  });

  const comInsights = await Promise.all(
    recentes.map(async (m): Promise<IgMediaItem> => {
      const ins = await getMediaInsights(m.id, m.media_type ?? '');
      // Reels vêm da API como media_type=VIDEO + media_product_type=REELS.
      // Consolidamos: se é reel, mediaType efetivo vira REELS pra formatoLabel
      // e pra a chamada de insights (que aceita views/shares só em vídeo/reel).
      const mediaType =
        m.media_product_type === 'REELS' ? 'REELS' : (m.media_type ?? '');
      return {
        id: m.id,
        caption: m.caption ?? '',
        mediaType,
        thumbnail: m.thumbnail_url ?? m.media_url ?? null,
        permalink: m.permalink ?? '',
        timestamp: m.timestamp ?? '',
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
        reach: ins.reach,
        interactions: ins.interactions,
        saved: ins.saved,
        shares: ins.shares,
        views: ins.views,
        seguidores: ins.seguidores,
      };
    }),
  );

  // Filtra posts sem engajamento nenhum (0 reach + 0 interactions) — geralmente
  // são posts arquivados/deletados ou insights que não chegaram. Não fazem
  // sentido nem no "melhor" nem no "pior".
  return comInsights
    .filter((m) => m.reach > 0 || m.interactions > 0)
    .sort((a, b) => b.interactions - a.interactions || b.reach - a.reach);
}

function parseDataLocal(iso: string, fimDoDia = false): Date {
  // ISO "YYYY-MM-DD" — interpreta como hora local pra não pular dia
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, fimDoDia ? 23 : 0, fimDoDia ? 59 : 0, 0);
}

/**
 * Analytics ao vivo do Instagram de um projeto (início/fim em epoch ms).
 * Devolve null se o projeto não tem conta mapeada em IG_ACCOUNTS, se não há
 * token, ou se a Graph API falhar. Espelha o contrato do getMetaAdsRelatorio
 * pra a página de projeto renderizar de forma condicional.
 */
export async function getIgAnalyticsDoProjeto(
  projetoId: string,
  inicioMs: number,
  fimMs: number,
): Promise<IgAnalytics | null> {
  const igUserId = env.instagram.accounts[projetoId];
  if (!igUserId || !env.instagram.graphToken) return null;
  try {
    const since = new Date(inicioMs).toISOString().slice(0, 10);
    const until = new Date(fimMs).toISOString().slice(0, 10);
    return await getIgAnalytics(igUserId, { since, until });
  } catch (err) {
    console.error('[instagram] erro no projeto', projetoId, err);
    return null;
  }
}

/**
 * Foto de perfil do Instagram do projeto (pro avatar da página do projeto).
 * Usa a conta mapeada em IG_ACCOUNTS; sem mapeamento, procura pelo @ que
 * aparece no nome do projeto ("IG | @turismoemchicago") nas contas do token.
 */
// Foto de perfil quase não muda: fica guardada 6 h entre visitas (o cache em
// memória acima some a cada servidor novo da Vercel). Erro não vai pro cache.
const _fotoDoProjetoCached = unstable_cache(
  async (projetoId: string, nomeProjeto: string): Promise<string | null> => {
    const igUserId = env.instagram.accounts[projetoId];
    if (igUserId) {
      const foto = await getAccount(igUserId).then((a) => a.profilePicture).catch(() => null);
      if (foto) return foto;
    }
    const handle = nomeProjeto.match(/@([\w.]+)/)?.[1]?.toLowerCase();
    if (!handle) return null;
    const contas = await listIgAccounts();
    const nossa = contas.find((c) => c.username.toLowerCase() === handle)?.profilePicture;
    if (nossa) return nossa;
    // Conta que não está no token: o Business Discovery lê a foto de qualquer perfil
    // comercial/criador público, consultando a partir de uma conta nossa.
    const base = contas[0]?.igUserId;
    if (!base) return null;
    try {
      const json = await graph<any>(base, { fields: `business_discovery.username(${handle}){profile_picture_url}` });
      return json?.business_discovery?.profile_picture_url ?? null;
    } catch {
      return null;
    }
  },
  ['ig-foto-do-projeto-v2'],
  { revalidate: 6 * 3600 },
);

export async function getFotoDoInstagramDoProjeto(
  projetoId: string,
  nomeProjeto: string,
): Promise<string | null> {
  if (!env.instagram.graphToken) return null;
  try {
    return await _fotoDoProjetoCached(projetoId, nomeProjeto);
  } catch {
    return null;
  }
}

/** Levantamento completo de um perfil: período + período anterior (mesmo
 *  tamanho) + top posts + 3 séries diárias.
 *
 *  Aceita opcoes em formato:
 *   - { dias: 30 } → últimos N dias
 *   - { since: '2024-01-01', until: '2024-01-31' } → range customizado
 */
/** Soma métricas de vários períodos consecutivos. Nota: reach e
 *  engagedAccounts somam contas únicas de cada janela — se um mesmo perfil
 *  entrou em 2 janelas, entra 2× no total. Padrão do mercado (Metricool,
 *  Sprout, Buffer fazem o mesmo). */
function somarInsights(pedacos: IgPeriodInsights[]): IgPeriodInsights {
  return pedacos.reduce<IgPeriodInsights>(
    (acc, p) => ({
      reach: acc.reach + p.reach,
      interactions: acc.interactions + p.interactions,
      engagedAccounts: acc.engagedAccounts + p.engagedAccounts,
      profileViews: acc.profileViews + p.profileViews,
      novosSeguidores: acc.novosSeguidores + p.novosSeguidores,
      views: acc.views + p.views,
    }),
    {
      reach: 0,
      interactions: 0,
      engagedAccounts: 0,
      profileViews: 0,
      novosSeguidores: 0,
      views: 0,
    },
  );
}

/** Puxa uma métrica com `breakdown` (ex.: media_product_type, follow_type) no
 *  período. Resiliente: se a conta/versão da API não expõe o breakdown, devolve
 *  vazio em vez de estourar. */
async function totalValueBreakdown(
  igUserId: string,
  metric: string,
  breakdown: string,
  since: string,
  until: string,
): Promise<IgBreakdownItem[]> {
  try {
    const json = await graph<any>(`${igUserId}/insights`, {
      metric,
      metric_type: 'total_value',
      period: 'day',
      breakdown,
      since,
      until,
    });
    const results = json?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    return results.map((r: any) => ({
      chave: String(r?.dimension_values?.[0] ?? '').toUpperCase(),
      valor: typeof r?.value === 'number' ? r.value : 0,
    }));
  } catch {
    return [];
  }
}

/** Demografia dos seguidores por dimensão (age | gender | country | city).
 *  É um snapshot (foto do momento) — requer 100+ seguidores. Resiliente. */
async function demografiaBreakdown(
  igUserId: string,
  breakdown: 'age' | 'gender' | 'country' | 'city',
): Promise<IgBreakdownItem[]> {
  try {
    const json = await graph<any>(`${igUserId}/insights`, {
      metric: 'follower_demographics',
      period: 'lifetime',
      metric_type: 'total_value',
      timeframe: 'last_30_days',
      breakdown,
    });
    const results = json?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    return results
      .map((r: any) => ({
        chave: String(r?.dimension_values?.[0] ?? ''),
        valor: typeof r?.value === 'number' ? r.value : 0,
      }))
      .filter((i: IgBreakdownItem) => i.valor > 0)
      .sort((a: IgBreakdownItem, b: IgBreakdownItem) => b.valor - a.valor);
  } catch {
    return [];
  }
}

/** Junta fatias de breakdown de vários pedaços de 30d somando por chave. */
function mergeBreakdown(fatias: IgBreakdownItem[][]): IgBreakdownItem[] {
  const mapa = new Map<string, number>();
  for (const fatia of fatias) {
    for (const item of fatia) {
      mapa.set(item.chave, (mapa.get(item.chave) ?? 0) + item.valor);
    }
  }
  return [...mapa.entries()]
    .map(([chave, valor]) => ({ chave, valor }))
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

/** Divide um intervalo em pedaços de até 30 dias — cap da Graph API. */
function chunks30d(inicioU: number, fimU: number): [number, number][] {
  const CHUNK = 30 * 86400;
  const out: [number, number][] = [];
  let cursor = inicioU;
  while (cursor < fimU) {
    const proximo = Math.min(cursor + CHUNK, fimU);
    out.push([cursor, proximo]);
    cursor = proximo;
  }
  return out;
}

export async function getIgAnalytics(
  igUserId: string,
  opts: { dias?: number; since?: string; until?: string } = {},
): Promise<IgAnalytics> {
  const fim = opts.until ? parseDataLocal(opts.until, true) : new Date();
  const inicioPedido = opts.since
    ? parseDataLocal(opts.since)
    : new Date(fim.getTime() - (opts.dias ?? 30) * 86400000);

  const fimU = Math.floor(fim.getTime() / 1000);
  const inicioAtualU = Math.floor(inicioPedido.getTime() / 1000);
  const dias = Math.max(1, Math.round((fimU - inicioAtualU) / 86400));
  const inicioAnteriorU = inicioAtualU - dias * 86400;

  // Divide em pedaços de 30 dias — Graph API não aceita janela maior. Cada
  // pedaço é fetchado em paralelo, somamos KPIs e concatenamos séries.
  const pedacosAtual = chunks30d(inicioAtualU, fimU);
  const pedacosAnterior = chunks30d(inicioAnteriorU, inicioAtualU);
  const s = (n: number) => n.toString();

  const account = await getAccount(igUserId);
  const [
    insightsAtual,
    insightsAnterior,
    mediaOrdenada,
    fatiasAlcance,
    fatiasSeguidores,
    fatiasEngajamento,
    fatiasViews,
    fatiasViewsPorTipo,
    fatiasPublico,
    demoGenero,
    demoIdade,
    demoPaises,
    demoCidades,
  ] = await Promise.all([
    Promise.all(pedacosAtual.map(([a, b]) => getPeriodInsights(igUserId, s(a), s(b)))),
    Promise.all(pedacosAnterior.map(([a, b]) => getPeriodInsights(igUserId, s(a), s(b)))),
    getMediaOrdenada(igUserId, inicioAtualU, fimU),
    Promise.all(pedacosAtual.map(([a, b]) => timeSeries(igUserId, 'reach', s(a), s(b)))),
    Promise.all(pedacosAtual.map(([a, b]) => timeSeries(igUserId, 'follower_count', s(a), s(b)))),
    Promise.all(pedacosAtual.map(([a, b]) => timeSeries(igUserId, 'accounts_engaged', s(a), s(b)))),
    Promise.all(pedacosAtual.map(([a, b]) => timeSeries(igUserId, 'views', s(a), s(b)))),
    // Breakdowns (podem não existir na conta → mergeBreakdown volta []):
    Promise.all(
      pedacosAtual.map(([a, b]) =>
        totalValueBreakdown(igUserId, 'views', 'media_product_type', s(a), s(b)),
      ),
    ),
    Promise.all(
      pedacosAtual.map(([a, b]) =>
        totalValueBreakdown(igUserId, 'reach', 'follow_type', s(a), s(b)),
      ),
    ),
    // Demografia dos seguidores (snapshot — não depende do período):
    demografiaBreakdown(igUserId, 'gender'),
    demografiaBreakdown(igUserId, 'age'),
    demografiaBreakdown(igUserId, 'country'),
    demografiaBreakdown(igUserId, 'city'),
  ]);

  const atual = somarInsights(insightsAtual);
  const anterior = somarInsights(insightsAnterior);
  const serieAlcance = fatiasAlcance.flat();
  const serieSeguidores = fatiasSeguidores.flat();
  const serieEngajamento = fatiasEngajamento.flat();
  const serieViews = fatiasViews.flat();
  const viewsPorTipo = mergeBreakdown(fatiasViewsPorTipo);

  // Público: a API devolve chaves tipo FOLLOWER / NON_FOLLOWER (variam por
  // versão). Classificamos por conter "NON"/"NÃO" pra ser resiliente ao nome.
  const publicoMerge = mergeBreakdown(fatiasPublico);
  let publico: { seguidores: number; naoSeguidores: number } | null = null;
  if (publicoMerge.length > 0) {
    let seguidores = 0;
    let naoSeguidores = 0;
    for (const item of publicoMerge) {
      if (/NON|NAO|NÃO/.test(item.chave)) naoSeguidores += item.valor;
      else seguidores += item.valor;
    }
    if (seguidores + naoSeguidores > 0) publico = { seguidores, naoSeguidores };
  }

  const temDemografia =
    demoGenero.length > 0 ||
    demoIdade.length > 0 ||
    demoPaises.length > 0 ||
    demoCidades.length > 0;
  const demografia = temDemografia
    ? {
        genero: demoGenero,
        idade: demoIdade,
        paises: demoPaises.slice(0, 6),
        cidades: demoCidades.slice(0, 6),
      }
    : null;

  // Melhores = top 3 do sorted desc. Piores = últimos 3 do sorted desc =
  // primeiros 3 do sorted asc. Só se tiver 6+ posts pra fazer sentido —
  // com menos, todos viram "top".
  const topMedia = mediaOrdenada.slice(0, 20);
  const topPiores =
    mediaOrdenada.length >= 6
      ? [...mediaOrdenada].reverse().slice(0, 3)
      : [];

  return {
    account,
    period: {
      since: new Date(inicioAtualU * 1000).toISOString().slice(0, 10),
      until: fim.toISOString().slice(0, 10),
      dias,
    },
    atual,
    anterior,
    topMedia,
    topPiores,
    conteudos: mediaOrdenada,
    temSeguidoresPorPost: mediaOrdenada.some((m) => m.seguidores > 0),
    taxaEngajamento: atual.reach > 0 ? atual.interactions / atual.reach : 0,
    serieAlcance,
    serieSeguidores,
    serieEngajamento,
    serieViews,
    viewsPorTipo,
    publico,
    demografia,
  };
}


/**
 * Conta do Instagram (ig user id) de um projeto, pra programar/publicar.
 * 1) IG_ACCOUNTS (aceita o id com ou sem traços);
 * 2) senão, acha pelo @ do nome do projeto ("IG | @nyorquina") entre as contas
 *    que o token da Meta enxerga. Assim projeto novo não depende de mexer no IG_ACCOUNTS.
 */
export async function contaIgDoProjeto(projetoId: string | null | undefined, nomeProjeto?: string | null): Promise<string | null> {
  if (projetoId) {
    const semTraco = projetoId.replace(/-/g, '');
    const comTraco = semTraco.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    const map = env.instagram.accounts;
    const direto = map[projetoId] ?? map[semTraco] ?? map[comTraco];
    if (direto) return direto;
  }
  const handle = (nomeProjeto ?? '').match(/@([\w.]+)/)?.[1]?.toLowerCase();
  if (!handle || !env.instagram.graphToken) return null;
  try {
    const contas = await listIgAccounts();
    return contas.find((c) => c.username.toLowerCase() === handle)?.igUserId ?? null;
  } catch {
    return null;
  }
}
