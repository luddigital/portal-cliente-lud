import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { igConfigured, listIgAccounts } from '@/lib/instagram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const isAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!isAdmin) {
    return NextResponse.json({ error: 'acesso restrito' }, { status: 403 });
  }
  if (!igConfigured()) {
    return NextResponse.json({ error: 'não configurado', accounts: [] }, { status: 200 });
  }
  try {
    const accounts = await listIgAccounts();
    return NextResponse.json({ accounts });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao listar contas' },
      { status: 500 },
    );
  }
}
