import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { invalidarProjetosOcultos } from '@/lib/notion';
import { salvarVisibilidadeDoProjeto } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Projeto aparece ou não na área do cliente.
 * POST { visivel: boolean } → { ok }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const email = session?.email.trim().toLowerCase() ?? '';
  if (!session || !env.auth.adminEmails.includes(email)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (typeof body?.visivel !== 'boolean') {
    return NextResponse.json({ error: 'faltou visivel' }, { status: 400 });
  }
  try {
    await salvarVisibilidadeDoProjeto(params.id, body.visivel, email === 'oi@lud.digital' ? 'Luiza' : email);
    invalidarProjetosOcultos();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[projeto/visibilidade]', e);
    return NextResponse.json({ error: 'não consegui salvar' }, { status: 500 });
  }
}
