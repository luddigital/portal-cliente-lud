import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listarTarefasAbertasDeTodos } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Posts com tarefa em aberto, do mais próximo pro mais longe. O botão Atualizar
 * usa essa lista pra deixar a prévia de cada post pronta (abre na hora depois).
 */
export async function GET() {
  const session = await getSession();
  if (!session || !env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const tarefas = await listarTarefasAbertasDeTodos().catch(() => []);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const porPost = new Map<string, string>();
  for (const t of tarefas) {
    if (!t.postId) continue;
    const d = t.postData ?? '9999';
    const atual = porPost.get(t.postId);
    if (!atual || d < atual) porPost.set(t.postId, d);
  }
  // Primeiro de hoje em diante (o que vai ser aberto), depois os atrasados.
  const ids = [...porPost.entries()]
    .sort(([, a], [, b]) => (a >= hoje) !== (b >= hoje) ? (a >= hoje ? -1 : 1) : a.localeCompare(b))
    .map(([id]) => id);
  return NextResponse.json({ ids });
}
