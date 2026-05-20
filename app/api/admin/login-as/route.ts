import { NextResponse } from 'next/server';
import { getSession, createSession, pushAdminOrigem } from '@/lib/auth';
import { findProjetosByEmail } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin entra na sessão de outro cliente — útil pra ver o portal do ponto de vista do cliente.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  const url = new URL(req.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'faltou ?email=' }, { status: 400 });
  }
  const projetos = await findProjetosByEmail(email);
  if (projetos.length === 0) {
    return NextResponse.json(
      { error: 'cliente sem projetos vinculados' },
      { status: 404 },
    );
  }
  // Guarda a sessão admin original pra permitir voltar com 1 click
  await pushAdminOrigem(session);
  await createSession({ email, projetoIds: projetos.map((p) => p.id) });
  return NextResponse.redirect(new URL('/', req.url));
}
