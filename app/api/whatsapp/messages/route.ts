/**
 * Histórico de mensagens de um grupo.
 * Valida que o usuário tem permissão de leitura antes de devolver.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listarGruposDoUsuario, listarMensagens } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const grupoId = url.searchParams.get('grupoId');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
  if (!grupoId) {
    return NextResponse.json({ error: 'missing_grupoId' }, { status: 400 });
  }

  // Confirma que o usuário tem permissão de leitura
  const grupos = await listarGruposDoUsuario(session.email);
  const permitido = grupos.some((g) => g.id === grupoId);
  if (!permitido) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const mensagens = await listarMensagens(grupoId, limit);
    return NextResponse.json({ mensagens });
  } catch (e: any) {
    console.error('[whatsapp/messages]', e?.message);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}
