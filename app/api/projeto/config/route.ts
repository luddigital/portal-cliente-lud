import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getProjetoConfig } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const projetoId = url.searchParams.get('projetoId') ?? '';
  if (!projetoId) {
    return NextResponse.json({ error: 'projetoId obrigatório' }, { status: 400 });
  }

  const isAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!isAdmin && !session.projetoIds.includes(projetoId)) {
    return NextResponse.json({ error: 'acesso restrito' }, { status: 403 });
  }

  try {
    const config = await getProjetoConfig(projetoId);
    return NextResponse.json({ config });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao ler config' },
      { status: 500 },
    );
  }
}
