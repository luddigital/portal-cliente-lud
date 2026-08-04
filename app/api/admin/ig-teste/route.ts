import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listIgAccounts } from '@/lib/instagram';
import { publicarAgoraIG, publicarNoIG } from '@/lib/instagramPublish';
import { resolverMidiaDoPost } from '@/lib/postMedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function ehAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return env.auth.adminEmails.includes(session.email.trim().toLowerCase());
}

/** Extrai o id do post (Notion) de um link ou id cru. */
function extrairPostId(entrada: string): string {
  const s = entrada.trim();
  const m = s.match(/[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : s;
}

/**
 * GET — sem params: lista as contas IG do token.
 *       com ?postId=... : resolve a arte do post (preview, não publica).
 */
export async function GET(req: Request) {
  if (!(await ehAdmin())) {
    return NextResponse.json({ error: 'só admin' }, { status: 403 });
  }
  const url = new URL(req.url);
  const postIdRaw = url.searchParams.get('postId');
  if (postIdRaw) {
    try {
      const midia = await resolverMidiaDoPost(extrairPostId(postIdRaw));
      if ('erro' in midia) return NextResponse.json({ erro: midia.erro });
      return NextResponse.json({ midia });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? 'erro ao resolver mídia' }, { status: 500 });
    }
  }
  try {
    const contas = await listIgAccounts();
    return NextResponse.json({ contas });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'erro ao listar contas' }, { status: 500 });
  }
}

/**
 * POST — publica AGORA no Instagram. Dois modos:
 *   { igUserId, postId }              → publica a arte real do post (img/carrossel/reels)
 *   { igUserId, imageUrl, caption }   → publica uma imagem por URL (teste manual)
 */
export async function POST(req: Request) {
  if (!(await ehAdmin())) {
    return NextResponse.json({ error: 'só admin' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    igUserId?: string;
    imageUrl?: string;
    caption?: string;
    postId?: string;
  };
  const igUserId = (body.igUserId ?? '').trim();
  if (!igUserId) return NextResponse.json({ error: 'faltou igUserId' }, { status: 400 });

  // Modo 1 — arte real de um post
  if (body.postId) {
    const midia = await resolverMidiaDoPost(extrairPostId(body.postId));
    if ('erro' in midia) return NextResponse.json({ error: midia.erro }, { status: 400 });
    const caption = (body.caption ?? '').trim() || midia.legenda;
    const r = await publicarNoIG({ igUserId, formato: midia.formato, itens: midia.itens, caption });
    if (!r.ok) return NextResponse.json({ error: r.error, etapa: r.etapa }, { status: 502 });
    return NextResponse.json({ ok: true, mediaId: r.mediaId, permalink: r.permalink });
  }

  // Modo 2 — URL manual (teste)
  const imageUrl = (body.imageUrl ?? '').trim();
  if (!/^https:\/\/.+/i.test(imageUrl)) {
    return NextResponse.json(
      { error: 'imageUrl precisa ser uma URL pública https://' },
      { status: 400 },
    );
  }
  const r = await publicarAgoraIG({ igUserId, imageUrl, caption: (body.caption ?? '').slice(0, 2200) });
  if (!r.ok) return NextResponse.json({ error: r.error, etapa: r.etapa }, { status: 502 });
  return NextResponse.json({ ok: true, mediaId: r.mediaId, permalink: r.permalink });
}
