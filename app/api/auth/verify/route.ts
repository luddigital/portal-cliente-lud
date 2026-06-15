import { NextResponse } from 'next/server';
import {
  createSession,
  clearProjetoAtivo,
  setProjetoAtivo,
  verifyMagicToken,
} from '@/lib/auth';
import { findProjetosByEmail, getColaboradorByEmail } from '@/lib/notion';
import { escolherProjetoPadrao } from '@/lib/projetoServico';
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

  // Limpa o "projeto ativo" da sessão anterior pra não vazar seleção stale
  clearProjetoAtivo();

  // Roteamento por tipo:
  //   1) Cliente com 2+ projetos → pré-seleciona Instagram (ou primeiro
  //      projeto se não houver IG) e cai em /. Switcher no header da
  //      home permite trocar a qualquer momento.
  //   2) Cliente com 1 projeto → /
  //   3) Admin sem projeto → /admin
  //   4) Colaborador sem projeto e não admin → /equipe/me
  if (projetos.length > 1) {
    const escolhido = escolherProjetoPadrao(projetos);
    if (escolhido) setProjetoAtivo(escolhido.id);
    return NextResponse.redirect(new URL('/', url));
  }
  const destino =
    projetos.length === 1
      ? '/'
      : ehAdmin
        ? '/admin'
        : colaborador
          ? '/equipe/me'
          : '/';
  return NextResponse.redirect(new URL(destino, url));
}
