import { NextResponse } from 'next/server';
import { getSession, setProjetoAtivo } from '@/lib/auth';
import { findProjetosByEmail } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function validarESalvar(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_allowed' }> {
  const permitidos = new Set(session.projetoIds);
  if (!permitidos.has(id)) {
    // Tenta refresh pela lista mais recente (caso projeto tenha sido
    // vinculado depois da sessão ser criada)
    const lista = await findProjetosByEmail(session.email);
    for (const p of lista) permitidos.add(p.id);
  }
  if (!permitidos.has(id)) return { ok: false, reason: 'not_allowed' };
  setProjetoAtivo(id);
  return { ok: true };
}

/**
 * GET: redireciona após salvar — usado pela tela /projetos (link direto).
 * POST: retorna JSON — usado pelo dropdown ProjetoSwitcher no header.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim();
  if (!id) return NextResponse.redirect(new URL('/projetos', req.url));

  const r = await validarESalvar(session, id);
  if (!r.ok) return NextResponse.redirect(new URL('/projetos', req.url));
  return NextResponse.redirect(new URL('/', req.url));
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  }

  const r = await validarESalvar(session, id);
  if (!r.ok) {
    return NextResponse.json(
      { error: 'projeto fora dos seus acessos' },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true });
}
