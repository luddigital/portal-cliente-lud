import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { postsEditadosDesde } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Posts que mudaram no Notion desde o último Atualizar (?desde=ISO). Marca a prévia
 * guardada de cada um como velha; o botão recarrega só esses.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const desde = new URL(req.url).searchParams.get('desde') ?? '';
  if (Number.isNaN(Date.parse(desde))) return NextResponse.json({ error: 'desde inválido' }, { status: 400 });
  // 2 min de folga: o Notion às vezes registra a edição um pouco depois.
  const inicio = new Date(Date.parse(desde) - 120_000).toISOString();
  const ids = await postsEditadosDesde(inicio);
  for (const id of ids) revalidateTag(`previa:${id.replace(/-/g, '')}`);
  return NextResponse.json({ ids });
}
