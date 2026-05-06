import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { findProjetosByEmail } from '@/lib/notion';

export const runtime = 'nodejs';

// Bypass do magic link — só funciona em dev (NODE_ENV !== 'production')
// Uso: /api/auth/dev-login?email=oi@lud.digital
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev-login não disponível em produção' }, { status: 403 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'faltou ?email=' }, { status: 400 });
  }

  const projetos = await findProjetosByEmail(email);
  if (projetos.length === 0) {
    return NextResponse.json(
      { error: `Nenhum cliente encontrado com "E-mail da empresa" = ${email}` },
      { status: 404 },
    );
  }

  await createSession({ email, projetoIds: projetos.map((p) => p.id) });
  return NextResponse.redirect(new URL('/', url));
}
