/**
 * Lista grupos que o usuário logado pode ver.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listarGruposDoUsuario } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const grupos = await listarGruposDoUsuario(session.email);
    return NextResponse.json({ grupos });
  } catch (e: any) {
    console.error('[whatsapp/groups]', e?.message);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}
