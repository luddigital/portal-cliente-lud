import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listPostsDoMes } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { year: string; month: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'ano/mês inválido' }, { status: 400 });
  }

  // Admin pode passar projetoIds via query pra ver de qualquer cliente.
  const url = new URL(req.url);
  const queryIds = url.searchParams.get('projetoIds');
  const isAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  const projetoIds =
    queryIds && isAdmin ? queryIds.split(',').filter(Boolean) : session.projetoIds;

  try {
    const posts = await listPostsDoMes(projetoIds, year, month);
    return NextResponse.json({ year, month, posts });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao buscar posts' },
      { status: 500 },
    );
  }
}
