import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import { getColaboradorByEmail } from '@/lib/notion';

export const runtime = 'nodejs';

/** GET /api/pauta/[postId]/rascunho → { ideia_texto, atualizado_em, publicado_em }
 *  POST /api/pauta/[postId]/rascunho { ideia_texto } → upsert (autosave)
 *  Só equipe Lud. (admin OU colaborador). Cliente NUNCA acessa. */
async function verificaEquipe() {
  const session = await getSession();
  if (!session) return { ok: false as const, res: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
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
    return { ok: false as const, res: NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 }) };
  }
  return { ok: true as const, email };
}

export async function GET(_req: Request, { params }: { params: { postId: string } }) {
  const guard = await verificaEquipe();
  if (!guard.ok) return guard.res;

  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('rascunho_pauta')
    .select('ideia_texto, atualizado_em, atualizado_por, publicado_em, publicado_por')
    .eq('post_id', params.postId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rascunho: data ?? null });
}

export async function POST(req: Request, { params }: { params: { postId: string } }) {
  const guard = await verificaEquipe();
  if (!guard.ok) return guard.res;

  const body = (await req.json().catch(() => ({}))) as { ideia_texto?: string };
  const texto = (body.ideia_texto ?? '').replace(/\r\n/g, '\n');

  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('rascunho_pauta')
    .upsert(
      {
        post_id: params.postId,
        ideia_texto: texto,
        atualizado_em: new Date().toISOString(),
        atualizado_por: guard.email,
      },
      { onConflict: 'post_id' },
    )
    .select('atualizado_em, publicado_em')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...data });
}
