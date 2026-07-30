import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  atualizarRelationDoPost,
  atualizarSelectDoPost,
  getColaboradorByEmail,
} from '@/lib/notion';

export const runtime = 'nodejs';

/** POST /api/pauta/[postId]/props
 *  body: { formatoId? | null, funilId? | null, objetivoId? | null, demandaValor? | null }
 *  — envia só o que mudou; null = limpa. Só equipe Lud. */
export async function POST(req: Request, { params }: { params: { postId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const email = session.email.trim().toLowerCase();
  const ehAdmin = env.auth.adminEmails.includes(email);
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const c = await getColaboradorByEmail(session.email);
      ehColaborador = !!c;
    } catch { /* mantém false */ }
  }
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    formatoId?: string | null;
    funilId?: string | null;
    objetivoId?: string | null;
    demandaValor?: string | null;
  };

  try {
    if ('formatoId' in body) {
      await atualizarRelationDoPost(
        params.postId,
        'Formato',
        body.formatoId ? [body.formatoId] : [],
      );
    }
    if ('funilId' in body) {
      await atualizarRelationDoPost(
        params.postId,
        'Funil',
        body.funilId ? [body.funilId] : [],
      );
    }
    if ('objetivoId' in body) {
      await atualizarRelationDoPost(
        params.postId,
        'Objetivo',
        body.objetivoId ? [body.objetivoId] : [],
      );
    }
    if ('demandaValor' in body) {
      await atualizarSelectDoPost(
        params.postId,
        env.notion.postProps.demanda,
        body.demandaValor ?? null,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[pauta/props] erro:', err);
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
