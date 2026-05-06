import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { aprovarTarefa, getTarefaComPost } from '@/lib/notion';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const data = await getTarefaComPost(params.id);
    if (!data) return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 });
    if (!data.tarefa.projetoId || !session.projetoIds.includes(data.tarefa.projetoId)) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { comentario?: string };
    await aprovarTarefa(params.id, body.comentario);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[aprovar] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
