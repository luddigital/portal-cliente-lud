import { NextResponse } from 'next/server';
import { getSession, createSession, pushAdminOrigem } from '@/lib/auth';
import {
  findProjetosByEmail,
  getClienteById,
  listAcessosDoCliente,
} from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin entra como cliente passando só o ID do cliente. Resolve o email:
 *   1. Tenta o e-mail principal cadastrado no cliente (E-mail da empresa)
 *   2. Cai pro primeiro acesso extra ativo (caso TKRA — sem email principal)
 *
 * Útil pro botão "Ver como cliente →" nos cards de projeto.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'faltou ?id=' }, { status: 400 });
  }

  const cliente = await getClienteById(id);
  if (!cliente) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 });
  }

  let email = cliente.email;
  if (!email) {
    // Fallback: pega o primeiro acesso extra ativo
    const acessos = await listAcessosDoCliente(id);
    email = acessos.find((a) => a.ativo)?.email ?? null;
  }
  if (!email) {
    return NextResponse.json(
      {
        error:
          'Esse cliente não tem email principal nem acessos extras. Cadastre um acesso antes.',
      },
      { status: 400 },
    );
  }

  const projetos = await findProjetosByEmail(email);
  if (projetos.length === 0) {
    return NextResponse.json(
      { error: 'cliente sem projetos vinculados' },
      { status: 404 },
    );
  }

  // Guarda a sessão admin original pra voltar com 1 click
  await pushAdminOrigem(session);
  await createSession({ email, projetoIds: projetos.map((p) => p.id) });
  return NextResponse.redirect(new URL('/', req.url));
}
