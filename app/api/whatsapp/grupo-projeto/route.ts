import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vincula um grupo do WhatsApp a um projeto do Notion. Serve pro botão
 * de lembrete de aprovação saber em qual grupo mandar a mensagem.
 *
 * PUT { grupoId: string, projetoId: string | null }
 * (projetoId=null desvincula)
 */
export async function PUT(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    grupoId?: string;
    projetoId?: string | null;
  };
  const grupoId = (body.grupoId ?? '').trim();
  const projetoId = body.projetoId === null ? null : (body.projetoId ?? '').trim() || null;

  if (!grupoId) {
    return NextResponse.json({ error: 'grupoId obrigatório' }, { status: 400 });
  }

  const sb = await supabaseAdmin();
  const { error } = await sb
    .from('whatsapp_grupos')
    .update({
      projeto_id: projetoId,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', grupoId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, grupoId, projetoId });
}
