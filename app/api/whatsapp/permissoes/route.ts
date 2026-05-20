/**
 * Admin: lista/cria/edita permissões de grupos.
 *
 * GET   ?grupoId=...       → lista permissões do grupo
 * POST  { grupoId, ativo } → liga/desliga visibilidade do grupo no Portal
 * PUT   { grupoId, usuario_email, pode_ler, pode_responder } → upsert permissão
 * DELETE ?id=...           → remove permissão
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function exigeAdmin() {
  const session = await getSession();
  if (!session) return { error: 'unauthorized' as const, status: 401 };
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return { error: 'forbidden' as const, status: 403 };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  const guard = await exigeAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const grupoId = new URL(req.url).searchParams.get('grupoId');
  const sb = await supabaseAdmin();

  if (grupoId) {
    const { data, error } = await sb
      .from('whatsapp_permissoes')
      .select('*')
      .eq('grupo_id', grupoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ permissoes: data });
  }

  // sem grupoId: lista todos os grupos com contagem de permissões
  const { data: grupos, error: errG } = await sb
    .from('whatsapp_grupos')
    .select('*')
    .order('nome', { ascending: true });
  if (errG) return NextResponse.json({ error: errG.message }, { status: 500 });
  return NextResponse.json({ grupos });
}

export async function POST(req: NextRequest) {
  const guard = await exigeAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    grupoId?: string;
    ativo?: boolean;
    projetoId?: string | null;
  };
  if (!body.grupoId) {
    return NextResponse.json({ error: 'missing_grupoId' }, { status: 400 });
  }
  const sb = await supabaseAdmin();
  const update: Record<string, any> = { atualizado_em: new Date().toISOString() };
  if (typeof body.ativo === 'boolean') update.ativo = body.ativo;
  if (body.projetoId !== undefined) update.projeto_id = body.projetoId;
  const { error } = await sb
    .from('whatsapp_grupos')
    .update(update)
    .eq('id', body.grupoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const guard = await exigeAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    grupoId?: string;
    usuario_email?: string;
    pode_ler?: boolean;
    pode_responder?: boolean;
  };
  if (!body.grupoId || !body.usuario_email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  const sb = await supabaseAdmin();
  const { error } = await sb.from('whatsapp_permissoes').upsert(
    {
      grupo_id: body.grupoId,
      usuario_email: body.usuario_email.toLowerCase().trim(),
      pode_ler: body.pode_ler ?? true,
      pode_responder: body.pode_responder ?? false,
    },
    { onConflict: 'usuario_email,grupo_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await exigeAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  const sb = await supabaseAdmin();
  const { error } = await sb.from('whatsapp_permissoes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
