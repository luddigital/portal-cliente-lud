import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import lote from '@/contextos/importar-2026-11-05.json';

export const runtime = 'nodejs';

/** Importa um lote de documentos das pastas dos projetos (só os que ainda não existem: mesmo cliente e título). */
export async function POST() {
  const s = await getSession();
  if (!s || !env.auth.adminEmails.includes(s.email.trim().toLowerCase())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const sb = await supabaseAdmin();
  const { data: existentes } = await sb.from('contexto_clientes').select('handle,titulo');
  const tem = new Set((existentes ?? []).map((e: any) => `${e.handle}|${e.titulo}`));
  const novos = (lote as any[]).filter((d) => !tem.has(`${d.handle}|${d.titulo}`));
  for (const d of novos) {
    const { error } = await sb.from('contexto_clientes').insert({ ...d, ativo: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, importados: novos.length });
}
