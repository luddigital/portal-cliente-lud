import { NextResponse } from 'next/server';
import { sessaoDaEquipe } from '@/lib/conteudo-acesso';
import { ehPostDoPortal, produzirPostDoPortal } from '@/lib/conteudo-portal';
import { invalidarCachesAposMudanca } from '@/lib/notion';

export const runtime = 'nodejs';

/** "Produzir post": fecha a fase de pauta e cria a cadeia de tarefas com os prazos. */
export async function POST(_req: Request, { params }: { params: { postId: string } }) {
  const quem = await sessaoDaEquipe();
  if (!quem) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  if (!ehPostDoPortal(params.postId)) return NextResponse.json({ error: 'post não é do portal' }, { status: 400 });
  try {
    const tarefas = await produzirPostDoPortal(params.postId);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, tarefas: tarefas.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 400 });
  }
}
