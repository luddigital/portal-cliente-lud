import { NextResponse } from 'next/server';
import { sessaoDaEquipe } from '@/lib/conteudo-acesso';
import { criarPostDoPortal, projetoDoPortal, type CamposPost } from '@/lib/conteudo-portal';
import { invalidarCachesAposMudanca } from '@/lib/notion';

export const runtime = 'nodejs';

/** Cria uma pauta no calendário do portal. POST { titulo, dataPostagem, formato, … } */
export async function POST(req: Request, { params }: { params: { projetoId: string } }) {
  const quem = await sessaoDaEquipe();
  if (!quem) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const projeto = await projetoDoPortal(params.projetoId);
  if (!projeto) return NextResponse.json({ error: 'esse projeto não roda no portal' }, { status: 404 });
  try {
    const campos = ((await req.json().catch(() => ({}))) ?? {}) as CamposPost;
    const post = await criarPostDoPortal(projeto.projetoId, campos, quem.email);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, post });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
