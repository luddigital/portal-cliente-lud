import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { criarAcesso } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Admin adiciona um email de acesso extra pra um cliente.
 * POST { clienteId, email, nome?, funcao? }
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    email?: string;
    nome?: string;
    funcao?: string;
  };
  if (!body.clienteId || !body.email) {
    return NextResponse.json(
      { error: 'clienteId e email são obrigatórios' },
      { status: 400 },
    );
  }
  try {
    const acesso = await criarAcesso({
      clienteId: body.clienteId,
      email: body.email,
      nome: body.nome,
      funcao: body.funcao,
    });
    return NextResponse.json({ ok: true, acesso });
  } catch (err: any) {
    console.error('[acessos POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro inesperado' },
      { status: 500 },
    );
  }
}
