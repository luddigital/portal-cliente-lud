import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { marcarFeedbacksDoPostAprovado } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST { postId }: post aprovado na Esteira Copy, feedbacks dele entram na fila da melhoria contínua. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const { postId } = (await req.json().catch(() => ({}))) as { postId?: string };
  if (!postId) return NextResponse.json({ error: 'postId obrigatório' }, { status: 400 });
  try {
    const marcados = await marcarFeedbacksDoPostAprovado(postId);
    return NextResponse.json({ ok: true, marcados });
  } catch (err: any) {
    console.warn('[feedback/aprovado] falhou', err?.message);
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
