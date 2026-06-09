import { NextResponse } from 'next/server';
import { createSession, clearProjetoAtivo, verifyMagicToken } from '@/lib/auth';
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

  // Sempre limpa o "projeto ativo" no login — força nova escolha caso
  // sessão antiga tivesse seleção stale
  clearProjetoAtivo();

  // Roteamento por tipo:
  //   1) Cliente com 2+ projetos → /projetos (escolher qual)
  //   2) Cliente com 1 projeto → /
  //   3) Admin sem projeto → /admin
  //   4) Colaborador sem projeto e não admin → /equipe/me
  const destino =
    projetos.length > 1
      ? '/projetos'
      : projetos.length === 1
        ? '/'
        : ehAdmin
          ? '/admin'
          : colaborador
            ? '/equipe/me'
            : '/';
  return NextResponse.redirect(new URL(destino, url));
}
