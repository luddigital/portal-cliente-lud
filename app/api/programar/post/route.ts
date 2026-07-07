import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  atualizarStatusPost,
  getColaboradorByEmail,
  invalidarCachesAposMudanca,
} from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/programar/post { postId, status? }
 * Muda o Status do post no Notion. Só admin/colaborador da Lud. pode chamar.
 * Se status não vier, default = "Agendado".
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json(
      { error: 'só equipe Lud. pode programar' },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    postId?: string;
    status?: string;
  };
  const postId = (body.postId ?? '').trim();
  const status = (body.status ?? 'Agendado').trim();
  if (!postId) {
    return NextResponse.json({ error: 'postId obrigatório' }, { status: 400 });
  }

  try {
    await atualizarStatusPost(postId, status);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao programar' },
      { status: 500 },
    );
  }
}
