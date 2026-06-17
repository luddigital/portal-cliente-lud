/**
 * Descarta uma sugestão da Claude sem enviar nada.
 * Só permite se o usuário tem `pode_responder = true` no grupo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { podeResponderNoGrupo, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = await supabaseAdmin();
  const { data: sug, error: errSug } = await sb
    .from('whatsapp_sugestoes')
    .select('grupo_id, status')
    .eq('id', params.id)
    .maybeSingle();

  if (errSug) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
  if (!sug) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (sug.status !== 'pendente') {
    return NextResponse.json({ error: 'ja_resolvida' }, { status: 409 });
  }

  const pode = await podeResponderNoGrupo(session.email, sug.grupo_id);
  if (!pode) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await sb
    .from('whatsapp_sugestoes')
    .update({ status: 'rejeitada', atualizado_em: new Date().toISOString() })
    .eq('id', params.id);

  return NextResponse.json({ ok: true });
}
