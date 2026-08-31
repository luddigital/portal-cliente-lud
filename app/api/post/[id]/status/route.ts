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

const STATUS_VALIDOS = new Set([
  'Em produção',
  'Aprovação',
  'Alteração',
  'Agendado',
  'Postado',
]);

/**
 * POST /api/post/[id]/status
 * Body: { status: 'Em produção' | 'Aprovação' | 'Alteração' | 'Agendado' | 'Postado' }
 * Muda o status manual do post no Notion. Só admin/colaborador.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const c = await getColaboradorByEmail(session.email);
      ehColaborador = !!c;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 });
  }

  const postId = params.id?.trim();
  if (!postId) return NextResponse.json({ error: 'postId obrigatório' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = (body.status ?? '').trim();
  if (!STATUS_VALIDOS.has(status)) {
    return NextResponse.json(
      { error: `status inválido — use um de: ${[...STATUS_VALIDOS].join(', ')}` },
      { status: 400 },
    );
  }

  try {
    await atualizarStatusPost(postId, status);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
