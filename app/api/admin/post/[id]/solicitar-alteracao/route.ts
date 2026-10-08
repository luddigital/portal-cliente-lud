import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { solicitarAlteracaoDoPost, type TipoAlteracao } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Pede pra equipe alterar arte e/ou copy de um post (cria as tarefas no Notion).
 * POST { tipos: ('arte'|'copy')[], prazo: 'YYYY-MM-DD', nota?: string, alteracaoPostId?: string }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
    if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const tipos = (Array.isArray(body?.tipos) ? body.tipos : []).filter(
      (t: unknown): t is TipoAlteracao => t === 'arte' || t === 'copy',
    );
    const prazo = String(body?.prazo ?? '');
    if (tipos.length === 0) {
      return NextResponse.json({ error: 'Escolhe arte, copy ou as duas.' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
      return NextResponse.json({ error: 'data inválida' }, { status: 400 });
    }

    const { criadas } = await solicitarAlteracaoDoPost({
      postId: params.id,
      tipos: Array.from(new Set<TipoAlteracao>(tipos)),
      prazo,
      nota: typeof body?.nota === 'string' ? body.nota : null,
      alteracaoPostId: typeof body?.alteracaoPostId === 'string' ? body.alteracaoPostId : null,
    });
    return NextResponse.json({ ok: true, criadas });
  } catch (err: any) {
    console.error('[solicitar-alteracao] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
