import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listPostsDoMes } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Posts do projeto num mês — usado pelo calendário da página do projeto pra
 * trocar de mês sem recarregar a página inteira.
 * GET ?mes=YYYY-MM
 */
export async function GET(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const mes = new URL(req.url).searchParams.get('mes') ?? '';
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return NextResponse.json({ error: 'mes inválido' }, { status: 400 });
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return NextResponse.json({ error: 'mes inválido' }, { status: 400 });
  try {
    const posts = await listPostsDoMes([params.id], year, month);
    return NextResponse.json({ posts });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
