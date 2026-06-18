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
};

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
};

export type IgPontoSerie = { dia: string; valor: number };

export type IgAnalytics = {
  account: IgAccount;
  period: { since: string; until: string; dias: number };
  atual: IgPeriodInsights;
  anterior: IgPeriodInsights;
  topMedia: IgMediaItem[];
  taxaEngajamento: number;
  /** Reach diário no período. */
  serieAlcance: IgPontoSerie[];
  /** Delta diário de seguidores (signed: positivo = entraram, negativo = saíram).
   *  Não dá pra separar entraram vs saíram nos mesmos dia — IG API só expõe
   *  o saldo líquido por dia. */
  serieSeguidores: IgPontoSerie[];
  /** Contas que se engajaram (clique, like, save, comment, etc) por dia. */
  serieEngajamento: IgPontoSerie[];
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

const unixDay = (d: Date) => Math.floor(d.getTime() / 1000).toString();

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
  const [reach, interactions, engagedAccounts, profileViews, novosSeguidores] =
    await Promise.all([
      totalValue(igUserId, 'reach', since, until),
      totalValue(igUserId, 'total_interactions', since, until),
      totalValue(igUserId, 'accounts_engaged', since, until),
      totalValue(igUserId, 'profile_views', since, until),
      totalValue(igUserId, 'follower_count', since, until),
    ]);
  return { reach, interactions, engagedAccounts, profileViews, novosSeguidores };
}

async function timeSeries(
  igUserId: string,
  metric: string,
  since: string,
  until: string,
): Promise<IgPontoSerie[]> {
  try {
    const json = await graph<any>(`${igUserId}/insights`, {
      metric,
      metric_type: 'time_series',
      period: 'day',
      since,
      until,
    });
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
): Promise<{ reach: number; interactions: number }> {
  try {
    const json = await graph<any>(`${mediaId}/insights`, {
      metric: 'reach,total_interactions',
    });
    let reach = 0;
    let interactions = 0;
    for (const m of json?.data ?? []) {
      const v = m?.values?.[0]?.value ?? 0;
      if (m.name === 'reach') reach = v;
      if (m.name === 'total_interactions') interactions = v;
    }
    return { reach, interactions };
  } catch {
    return { reach: 0, interactions: 0 };
  }
}

async function getTopMedia(
  igUserId: string,
  sinceUnix: number,
  limit: number,
): Promise<IgMediaItem[]> {
  const json = await graph<{ data: any[] }>(`${igUserId}/media`, {
    fields:
      'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: '50',
  });
  const recentes = (json.data ?? []).filter((m) => {
    const t = Date.parse(m.timestamp) / 1000;
    return Number.isFinite(t) && t >= sinceUnix;
  });

  const comInsights = await Promise.all(
    recentes.map(async (m): Promise<IgMediaItem> => {
      const ins = await getMediaInsights(m.id);
      return {
        id: m.id,
        caption: m.caption ?? '',
        mediaType: m.media_type ?? '',
        thumbnail: m.thumbnail_url ?? m.media_url ?? null,
        permalink: m.permalink ?? '',
        timestamp: m.timestamp ?? '',
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
        reach: ins.reach,
        interactions: ins.interactions,
      };
    }),
  );

  return comInsights
    .sort((a, b) => b.interactions - a.interactions || b.reach - a.reach)
    .slice(0, limit);
}

function parseDataLocal(iso: string, fimDoDia = false): Date {
  // ISO "YYYY-MM-DD" — interpreta como hora local pra não pular dia
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, fimDoDia ? 23 : 0, fimDoDia ? 59 : 0, 0);
}

/** Levantamento completo de um perfil: período + período anterior (mesmo
 *  tamanho) + top posts + 3 séries diárias.
 *
 *  Aceita opcoes em formato:
 *   - { dias: 30 } → últimos N dias
 *   - { since: '2024-01-01', until: '2024-01-31' } → range customizado
 */
export async function getIgAnalytics(
  igUserId: string,
  opts: { dias?: number; since?: string; until?: string } = {},
): Promise<IgAnalytics> {
  const fim = opts.until ? parseDataLocal(opts.until, true) : new Date();
  const inicioAtual = opts.since
    ? parseDataLocal(opts.since)
    : new Date(fim.getTime() - (opts.dias ?? 30) * 86400000);
  const dias = Math.max(
    1,
    Math.round((fim.getTime() - inicioAtual.getTime()) / 86400000),
  );
  const inicioAnterior = new Date(inicioAtual.getTime() - dias * 86400000);

  const account = await getAccount(igUserId);
  const [
    atual,
    anterior,
    topMedia,
    serieAlcance,
    serieSeguidores,
    serieEngajamento,
  ] = await Promise.all([
    getPeriodInsights(igUserId, unixDay(inicioAtual), unixDay(fim)),
    getPeriodInsights(igUserId, unixDay(inicioAnterior), unixDay(inicioAtual)),
    getTopMedia(igUserId, Math.floor(inicioAtual.getTime() / 1000), 20),
    timeSeries(igUserId, 'reach', unixDay(inicioAtual), unixDay(fim)),
    timeSeries(igUserId, 'follower_count', unixDay(inicioAtual), unixDay(fim)),
    timeSeries(igUserId, 'accounts_engaged', unixDay(inicioAtual), unixDay(fim)),
  ]);

  return {
    account,
    period: {
      since: inicioAtual.toISOString().slice(0, 10),
      until: fim.toISOString().slice(0, 10),
      dias,
    },
    atual,
    anterior,
    topMedia,
    taxaEngajamento: atual.reach > 0 ? atual.interactions / atual.reach : 0,
    serieAlcance,
    serieSeguidores,
    serieEngajamento,
  };
}
