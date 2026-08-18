import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { findProjetosByEmail } from '@/lib/notion';

export const runtime = 'nodejs';

// Bypass do magic link. Funciona em dev local E em deploys de PREVIEW da Vercel
// (VERCEL_ENV === 'preview') — pra dar pra testar num preview sem depender do
// email de magic link. Continua BLOQUEADO em produção.
// Uso: /api/auth/dev-login?email=oi@lud.digital
export async function GET(req: Request) {
  const ehPreview = process.env.VERCEL_ENV === 'preview';
  const ehProducao = process.env.NODE_ENV === 'production' && !ehPreview;
  if (ehProducao) {
    return NextResponse.json({ error: 'dev-login não disponível em produção' }, { status: 403 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'faltou ?email=' }, { status: 400 });
  }

  // Admin entra mesmo sem projetos (é a conta da equipe, não um cliente).
  const ehAdmin = env.auth.adminEmails.includes(email.trim().toLowerCase());
  const projetos = await findProjetosByEmail(email);
  if (projetos.length === 0 && !ehAdmin) {
    return NextResponse.json(
      { error: `Nenhum cliente encontrado com "E-mail da empresa" = ${email}` },
      { status: 404 },
    );
  }

  await createSession({ email, projetoIds: projetos.map((p) => p.id) });
  return NextResponse.redirect(new URL('/', url));
}
