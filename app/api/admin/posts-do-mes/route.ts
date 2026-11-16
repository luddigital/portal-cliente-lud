import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listPostsNoIntervalo } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Posts de todos os clientes num mês — usado pelo calendário do dashboard pra
 * trocar de mês sem recarregar a página.
 * GET ?mes=YYYY-MM
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const mes = new URL(req.url).searchParams.get('mes') ?? '';
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return NextResponse.json({ error: 'mes inválido' }, { status: 400 });
  const ano = Number(m[1]);
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) return NextResponse.json({ error: 'mes inválido' }, { status: 400 });
  const ultimo = new Date(Date.UTC(ano, mm, 0)).getUTCDate();
  try {
    const posts = await listPostsNoIntervalo(`${mes}-01`, `${mes}-${String(ultimo).padStart(2, '0')}`);
    return NextResponse.json({ posts });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
