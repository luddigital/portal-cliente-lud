import { env } from './env';
import type { FormatoIG, MidiaItem } from './postMedia';

/**
 * Publicação no Instagram via Graph API (Content Publishing).
 *
 * IMPORTANTE: a API do Instagram NÃO agenda — ela publica NA HORA. O fluxo é:
 *   1. cria "container(s)" de mídia (POST /{ig-user-id}/media)
 *   2. publica (POST /{ig-user-id}/media_publish)
 * O agendamento (publicar na hora marcada) é feito por fora, por um cron que
 * chama `publicarNoIG` quando a hora chega.
 *
 * Requisitos do token (System User do Business Manager da Lud.):
 *   - instagram_content_publish, instagram_basic, pages_read_engagement
 *   - a conta IG precisa ser Business/Creator ligada a uma Página do Facebook
 * A `image_url`/`video_url` PRECISA ser pública (a Meta é que baixa a mídia).
 */

const BASE = 'https://graph.facebook.com';

export type Etapa = 'container' | 'status' | 'publish' | 'config' | 'input';
export type PublicacaoResultado =
  | { ok: true; mediaId: string; permalink: string | null }
  | { ok: false; error: string; etapa: Etapa };

/** Erro interno que carrega a etapa, pra devolver diagnóstico bom. */
class IgPublishError extends Error {
  etapa: Etapa;
  constructor(message: string, etapa: Etapa) {
    super(message);
    this.etapa = etapa;
  }
}

function graphUrl(path: string): string {
  return `${BASE}/${env.instagram.graphVersion}/${path}`;
}

async function graphPost(path: string, body: Record<string, string>, etapa: Etapa): Promise<any> {
  const token = env.instagram.graphToken;
  if (!token) throw new IgPublishError('IG_GRAPH_TOKEN não configurado', 'config');
  const res = await fetch(graphUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, access_token: token }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const e = json?.error ?? {};
    const partes = [e.message, e.error_user_msg].filter(Boolean);
    throw new IgPublishError(partes.join(' — ') || `Graph API ${res.status}`, etapa);
  }
  return json;
}

async function graphGet(path: string, fields: string, etapa: Etapa): Promise<any> {
  const token = env.instagram.graphToken;
  if (!token) throw new IgPublishError('IG_GRAPH_TOKEN não configurado', 'config');
  const qs = new URLSearchParams({ fields, access_token: token });
  const res = await fetch(`${graphUrl(path)}?${qs}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const e = json?.error ?? {};
    throw new IgPublishError(e.message || `Graph API ${res.status}`, etapa);
  }
  return json;
}

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function criarContainer(igUserId: string, params: Record<string, string>): Promise<string> {
  const c = await graphPost(`${igUserId}/media`, params, 'container');
  if (!c.id) throw new IgPublishError('Meta não retornou o id do container', 'container');
  return c.id as string;
}

/** Espera o container ficar FINISHED. Vídeo demora — por isso os parâmetros. */
async function esperarPronto(creationId: string, tentativas: number, intervaloMs: number): Promise<void> {
  for (let i = 0; i < tentativas; i++) {
    const st = await graphGet(creationId, 'status_code', 'status');
    const code = st.status_code as string;
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new IgPublishError(`processamento da mídia: ${code}`, 'status');
    }
    await espera(intervaloMs);
  }
  throw new IgPublishError('tempo esgotado esperando a mídia processar', 'status');
}

async function publicarContainer(igUserId: string, creationId: string): Promise<PublicacaoResultado> {
  const pub = await graphPost(`${igUserId}/media_publish`, { creation_id: creationId }, 'publish');
  const mediaId = pub.id as string;
  let permalink: string | null = null;
  try {
    const info = await graphGet(mediaId, 'permalink', 'publish');
    permalink = info.permalink ?? null;
  } catch {
    /* permalink é cosmético — não falha a publicação */
  }
  return { ok: true, mediaId, permalink };
}

/**
 * Publica AGORA no Instagram — imagem única, carrossel ou Reels.
 * `itens` são as mídias já com URL PÚBLICA (a Meta baixa de lá).
 */
export async function publicarNoIG(opts: {
  igUserId: string;
  formato: FormatoIG;
  itens: MidiaItem[];
  caption: string;
}): Promise<PublicacaoResultado> {
  if (!env.instagram.graphToken) {
    return { ok: false, error: 'IG_GRAPH_TOKEN não configurado', etapa: 'config' };
  }
  const { igUserId, itens, caption } = opts;
  if (!itens.length) return { ok: false, error: 'nenhuma mídia pra publicar', etapa: 'input' };

  // Normaliza o formato de acordo com o que realmente veio.
  let formato = opts.formato;
  if (formato === 'CAROUSEL' && itens.length < 2) formato = itens[0].tipo === 'video' ? 'REELS' : 'IMAGE';
  if (formato === 'CAROUSEL' && itens.length > 10) {
    return { ok: false, error: 'carrossel do Instagram aceita no máximo 10 itens', etapa: 'input' };
  }

  try {
    let creationId: string;

    if (formato === 'REELS') {
      const item = itens.find((i) => i.tipo === 'video') ?? itens[0];
      creationId = await criarContainer(igUserId, {
        media_type: 'REELS',
        video_url: item.url,
        caption,
        share_to_feed: 'true',
      });
      await esperarPronto(creationId, 40, 3000); // vídeo pode levar minutos
    } else if (formato === 'CAROUSEL') {
      const childIds: string[] = [];
      for (const item of itens) {
        const params: Record<string, string> =
          item.tipo === 'video'
            ? { media_type: 'VIDEO', video_url: item.url, is_carousel_item: 'true' }
            : { image_url: item.url, is_carousel_item: 'true' };
        const cid = await criarContainer(igUserId, params);
        await esperarPronto(cid, item.tipo === 'video' ? 40 : 8, item.tipo === 'video' ? 3000 : 1500);
        childIds.push(cid);
      }
      creationId = await criarContainer(igUserId, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
      });
      await esperarPronto(creationId, 12, 2000);
    } else {
      // IMAGE
      creationId = await criarContainer(igUserId, { image_url: itens[0].url, caption });
      await esperarPronto(creationId, 8, 1500);
    }

    return await publicarContainer(igUserId, creationId);
  } catch (e: any) {
    const etapa: Etapa = e instanceof IgPublishError ? e.etapa : 'container';
    return { ok: false, error: e?.message ?? 'erro ao publicar', etapa };
  }
}

/**
 * Atalho pra publicar UMA imagem por URL pública direta (usado no teste manual).
 */
export async function publicarAgoraIG(opts: {
  igUserId: string;
  imageUrl: string;
  caption: string;
}): Promise<PublicacaoResultado> {
  return publicarNoIG({
    igUserId: opts.igUserId,
    formato: 'IMAGE',
    itens: [{ fileId: 'manual', nome: 'manual', tipo: 'image', url: opts.imageUrl }],
    caption: opts.caption,
  });
}
