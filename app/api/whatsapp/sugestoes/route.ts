/**
 * Lista as sugestões PENDENTES da Claude para um grupo.
 * Valida que o usuário logado tem permissão de leitura no grupo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listarGruposDoUsuario, listarSugestoesPendentes } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const grupoId = new URL(req.url).searchParams.get('grupoId');
  if (!grupoId) {
    return NextResponse.json({ error: 'missing_grupoId' }, { status: 400 });
  }

  const grupos = await listarGruposDoUsuario(session.email);
  if (!grupos.some((g) => g.id === grupoId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const sugestoes = await listarSugestoesPendentes(grupoId);
    return NextResponse.json({ sugestoes });
  } catch (e: any) {
    console.error('[whatsapp/sugestoes]', e?.message);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}
