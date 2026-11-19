import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { adicionarLinkDriveAoPost, invalidarCachesAposMudanca } from '@/lib/notion';

export const runtime = 'nodejs';

/**
 * Cola um link do Drive (arte ou vídeo do post) no campo "Link do Google Drive" do post no Notion,
 * sem apagar os que já estão lá. POST { url, nome? }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const url = String(body?.url ?? '').trim();
  if (!/^https:\/\/(drive|docs)\.google\.com\//i.test(url)) {
    return NextResponse.json({ error: 'Cole um link do Google Drive.' }, { status: 400 });
  }
  try {
    await adicionarLinkDriveAoPost(params.id, String(body?.nome ?? '').trim() || 'Arte', url);
    invalidarCachesAposMudanca();
    try {
      revalidateTag(`post-${params.id.replace(/-/g, '')}`);
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Não consegui salvar no Notion.' }, { status: 500 });
  }
}
