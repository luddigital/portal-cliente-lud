import { env } from './env';
import type { FormatoIG, MidiaItem } from './postMedia';

/**
 * Publicação na Página do Facebook ligada ao Instagram do projeto (Graph API).
 * Usa o token da Página (vem de me/accounts com o token do System User).
 * Precisa da permissão pages_manage_posts. Foto: /{page}/photos; carrossel: várias
 * fotos sem publicar + /{page}/feed com attached_media; vídeo/Reels: /{page}/videos.
 */
const BASE = 'https://graph.facebook.com';
const url = (p: string) => `${BASE}/${env.instagram.graphVersion}/${p}`;

async function post(path: string, body: Record<string, string>, token: string) {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, access_token: token }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(json?.error?.message ?? `Graph API ${res.status}`);
  return json;
}

/** Página do Facebook (id + token) ligada à conta do Instagram. */
async function paginaDoIg(igUserId: string): Promise<{ id: string; token: string } | null> {
  const token = env.instagram.graphToken;
  if (!token) return null;
  const qs = new URLSearchParams({ fields: 'id,access_token,instagram_business_account{id}', limit: '100', access_token: token });
  const res = await fetch(`${url('me/accounts')}?${qs}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  const p = (json?.data ?? []).find((x: any) => x?.instagram_business_account?.id === igUserId);
  return p?.access_token ? { id: p.id, token: p.access_token } : null;
}

export async function publicarNoFB(a: { igUserId: string; formato: FormatoIG; itens: MidiaItem[]; caption: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const pg = await paginaDoIg(a.igUserId);
    if (!pg) return { ok: false, error: 'Página do Facebook não encontrada pra essa conta (ou sem permissão)' };
    const video = a.itens.find((i) => i.tipo === 'video');
    if (a.formato === 'REELS' || (video && a.itens.length === 1)) {
      const r = await post(`${pg.id}/videos`, { file_url: (video ?? a.itens[0]).url, description: a.caption }, pg.token);
      return { ok: true, id: r.id };
    }
    const fotos = a.itens.filter((i) => i.tipo === 'image');
    if (fotos.length <= 1) {
      const r = await post(`${pg.id}/photos`, { url: fotos[0]?.url ?? a.itens[0].url, caption: a.caption }, pg.token);
      return { ok: true, id: r.post_id ?? r.id };
    }
    const ids: string[] = [];
    for (const f of fotos.slice(0, 10)) {
      const r = await post(`${pg.id}/photos`, { url: f.url, published: 'false' }, pg.token);
      ids.push(r.id);
    }
    const body: Record<string, string> = { message: a.caption };
    ids.forEach((id, k) => (body[`attached_media[${k}]`] = JSON.stringify({ media_fbid: id })));
    const r = await post(`${pg.id}/feed`, body, pg.token);
    return { ok: true, id: r.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'erro no Facebook' };
  }
}
