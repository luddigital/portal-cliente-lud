import { NextResponse } from 'next/server';
import { createSession, verifyMagicToken } from '@/lib/auth';
import { findProjetosByEmail, getColaboradorByEmail } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/login?err=invalid', url));

  const payload = await verifyMagicToken(token);
  if (!payload) return NextResponse.redirect(new URL('/login?err=expired', url));

  const ehAdmin = env.auth.adminEmails.includes(payload.email.trim().toLowerCase());
  const [projetos, colaborador] = await Promise.all([
    findProjetosByEmail(payload.email),
    getColaboradorByEmail(payload.email),
  ]);
  if (projetos.length === 0 && !ehAdmin && !colaborador) {
    return NextResponse.redirect(new URL('/login?err=notfound', url));
  }

  await createSession({
    email: payload.email,
    projetoIds: projetos.map((p) => p.id),
    colaboradorId: colaborador?.id ?? null,
  });

  // Roteamento por tipo:
  //   1) Cliente comum (tem projeto) → /
  //   2) Admin sem projeto → /admin
  //   3) Colaborador sem projeto e não admin → /equipe/me
  const destino =
    projetos.length > 0
      ? '/'
      : ehAdmin
        ? '/admin'
        : colaborador
          ? '/equipe/me'
          : '/';
  return NextResponse.redirect(new URL(destino, url));
}
