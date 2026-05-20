import { NextResponse } from 'next/server';
import { signMagicToken } from '@/lib/auth';
import { sendMagicLink } from '@/lib/mail';
import { findProjetosByEmail } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  const ehAdmin = env.auth.adminEmails.includes(email.trim().toLowerCase());
  const projetos = await findProjetosByEmail(email);
  if (projetos.length === 0 && !ehAdmin) {
    return NextResponse.json({ error: 'Email não encontrado nos nossos clientes. Fala com a gente no oi@lud.digital.' }, { status: 404 });
  }

  const token = await signMagicToken(email);
  const url = `${env.app.url}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLink(email, url);

  return NextResponse.json({ ok: true });
}
