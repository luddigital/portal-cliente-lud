import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  comentarPost,
  getTarefaComPost,
  invalidarCachesAposMudanca,
} from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Adiciona um comentário no post sem fechar a tarefa.
 *
 * Usado quando o cliente tem aprovação colaborativa (banco TKRA, por ex.):
 * vários membros da equipe podem comentar livremente, e a tarefa só fecha
 * quando alguém clica Aprovar/Reprovar explicitamente.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      comentario?: string;
    };
    const comentario = (body.comentario ?? '').trim();
    if (comentario.length < 2) {
      return NextResponse.json(
        { error: 'Escreve algo no comentário (mínimo 2 caracteres).' },
        { status: 400 },
      );
    }

    const data = await getTarefaComPost(params.id);
    if (!data)
      return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 });

    const ehAdmin = env.auth.adminEmails.includes(
      session.email.trim().toLowerCase(),
    );
    const ehColaborador = !!session.colaboradorId;
    if (
      !ehAdmin &&
      !ehColaborador &&
      (!data.tarefa.projetoId ||
        !session.projetoIds.includes(data.tarefa.projetoId))
    ) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    // Quem comentou (pra identificar nos comentários do Notion).
    const autor = session.email;
    const textoFinal = `💬 ${autor}\n\n${comentario}`;
    await comentarPost(data.tarefa.postId, textoFinal);
    invalidarCachesAposMudanca();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[comentar] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) {
      try {
        msg = JSON.parse(err.body).message ?? msg;
      } catch {}
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
