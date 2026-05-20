import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { pedirAlteracao, getTarefaComPost, invalidarCachesAposMudanca } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { comentario?: string };
    const comentario = (body.comentario ?? '').trim();
    if (comentario.length < 3) {
      return NextResponse.json(
        { error: 'Conta o que precisa ajustar (mínimo 3 caracteres).' },
        { status: 400 },
      );
    }

    const data = await getTarefaComPost(params.id);
    if (!data) return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 });
    const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
    if (
      !ehAdmin &&
      (!data.tarefa.projetoId || !session.projetoIds.includes(data.tarefa.projetoId))
    ) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    await pedirAlteracao(params.id, comentario);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[alterar] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
