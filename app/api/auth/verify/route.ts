import { NextResponse } from 'next/server';
import { createSession, verifyMagicToken } from '@/lib/auth';
import { findProjetosByEmail } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/login?err=invalid', url));

  const payload = await verifyMagicToken(token);
  if (!payload) return NextResponse.redirect(new URL('/login?err=expired', url));

  const ehAdmin = env.auth.adminEmails.includes(payload.email.trim().toLowerCase());
  const projetos = await findProjetosByEmail(payload.email);
  if (projetos.length === 0 && !ehAdmin) {
    return NextResponse.redirect(new URL('/login?err=notfound', url));
  }

  await createSession({ email: payload.email, projetoIds: projetos.map((p) => p.id) });
  return NextResponse.redirect(new URL('/', url));
}
