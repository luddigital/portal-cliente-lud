import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { concluirTarefa, invalidarCachesAposMudanca } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Conclui uma tarefa (Status → Concluído + Finalizada em hoje).
 * Só admin pode usar — acionado pela página de entrega no painel.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
    if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    await concluirTarefa(params.id);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[concluir] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
