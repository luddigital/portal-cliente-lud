import { NextResponse } from 'next/server';
import { sessaoDaEquipe } from '@/lib/conteudo-acesso';
import { atualizarPostDoPortal, ehPostDoPortal, type CamposPost } from '@/lib/conteudo-portal';
import { invalidarCachesAposMudanca } from '@/lib/notion';

export const runtime = 'nodejs';

/** Edita a pauta/post do portal. PATCH { campos } */
export async function PATCH(req: Request, { params }: { params: { postId: string } }) {
  const quem = await sessaoDaEquipe();
  if (!quem) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  if (!ehPostDoPortal(params.postId)) return NextResponse.json({ error: 'post não é do portal' }, { status: 400 });
  try {
    const campos = ((await req.json().catch(() => ({}))) ?? {}) as CamposPost;
    const post = await atualizarPostDoPortal(params.postId, campos, quem.email);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, post });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}

/** Tira a pauta do calendário (vira Cancelado; não apaga). */
export async function DELETE(_req: Request, { params }: { params: { postId: string } }) {
  const quem = await sessaoDaEquipe();
  if (!quem) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  if (!ehPostDoPortal(params.postId)) return NextResponse.json({ error: 'post não é do portal' }, { status: 400 });
  try {
    await atualizarPostDoPortal(params.postId, { status: 'Cancelado' }, quem.email);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
