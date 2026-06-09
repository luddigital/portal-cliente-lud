import { NextResponse } from 'next/server';
import { getSession, setProjetoAtivo } from '@/lib/auth';
import { findProjetosByEmail } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cliente escolhe qual projeto quer ver. Salva no cookie e manda pra home.
 * Valida que o projeto realmente faz parte dos acessos da sessão.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.redirect(new URL('/projetos', req.url));
  }

  // Confere que o projeto faz parte do que a sessão pode ver
  const permitidos = new Set(session.projetoIds);
  // Também checa via findProjetosByEmail (caso a session tenha sido criada
  // antes de algum projeto ser vinculado — pra evitar quebrar acesso)
  if (!permitidos.has(id)) {
    const lista = await findProjetosByEmail(session.email);
    for (const p of lista) permitidos.add(p.id);
  }
  if (!permitidos.has(id)) {
    return NextResponse.redirect(new URL('/projetos', req.url));
  }

  setProjetoAtivo(id);
  return NextResponse.redirect(new URL('/', req.url));
}
