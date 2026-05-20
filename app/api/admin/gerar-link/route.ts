import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Admin gera um link de acesso direto pra um cliente (válido 7 dias).
 * O cliente clica → vira sessão de 30 dias automaticamente.
 *
 * POST { email: string } → { url: string, expiresAt: string }
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email inválido' }, { status: 400 });
  }

  const secret = new TextEncoder().encode(env.auth.secret);
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // 7 dias
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);

  const url = `${env.app.url}/api/auth/verify?token=${token}`;
  return NextResponse.json({
    url,
    expiresAt: new Date(exp * 1000).toISOString(),
  });
}
