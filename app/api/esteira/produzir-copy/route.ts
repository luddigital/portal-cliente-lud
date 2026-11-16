import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { invalidarCachesAposMudanca, pedirCopyDaSkill } from '@/lib/notion';

export const runtime = 'nodejs';

/**
 * Botão "Produzir copy" da Esteira: põe o post na "LudHub — Fila de Copy".
 * A rotina agendada roda a skill criar-copy-completo nos posts da fila e grava
 * a copy no post; aí ele aparece em Aprovação | B&C. Só admin.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as { tarefaId?: string; postId?: string; titulo?: string; handle?: string };
  if (!b.tarefaId || !b.postId) return NextResponse.json({ error: 'dados faltando' }, { status: 400 });
  try {
    await pedirCopyDaSkill({ tarefaId: b.tarefaId, postId: b.postId, titulo: b.titulo ?? 'Post', handle: b.handle ?? '', link: `${env.app.url}/post/${b.postId}` });
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Não consegui pôr na fila.' }, { status: 500 });
  }
}
