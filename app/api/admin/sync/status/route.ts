import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { statusSync } from '@/lib/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sync/status
 * Retorna contagens das tabelas de sync + último sync executado.
 * Útil pra checar se o sync rodou e quantos registros foram parar lá.
 */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  try {
    const s = await statusSync();
    return NextResponse.json(s);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro inesperado' },
      { status: 500 },
    );
  }
}
