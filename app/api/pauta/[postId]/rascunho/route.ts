import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import { getColaboradorByEmail } from '@/lib/notion';

export const runtime = 'nodejs';

const CAMPOS_VALIDOS = ['ideia_texto', 'informacoes_texto', 'materiais_texto', 'referencias_texto'] as const;
type Campo = (typeof CAMPOS_VALIDOS)[number];

/** GET  → { rascunho: {ideia_texto, informacoes_texto, materiais_texto, atualizado_em, publicado_em} | null }
 *  POST { campo?: string } — envia só os campos que mudaram; upsert.
 *  Só equipe Lud. */
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
    .select('ideia_texto, informacoes_texto, materiais_texto, referencias_texto, atualizado_em, atualizado_por, publicado_em, publicado_por')
    .eq('post_id', params.postId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rascunho: data ?? null });
}

export async function POST(req: Request, { params }: { params: { postId: string } }) {
  const guard = await verificaEquipe();
  if (!guard.ok) return guard.res;

  const body = (await req.json().catch(() => ({}))) as Partial<Record<Campo, string>>;

  const update: Record<string, any> = {
    post_id: params.postId,
    atualizado_em: new Date().toISOString(),
    atualizado_por: guard.email,
  };
  for (const campo of CAMPOS_VALIDOS) {
    if (campo in body) {
      update[campo] = (body[campo] ?? '').replace(/\r\n/g, '\n');
    }
  }

  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('rascunho_pauta')
    .upsert(update, { onConflict: 'post_id' })
    .select('atualizado_em, publicado_em')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...data });
}
