import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { apagarCopiasDoPortal, invalidarCachesAposMudanca, listarCopiasDoPortalNaEsteira } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Lista os posts da Esteira que têm copy gerada pelo próprio portal
 * (marcadores "🤖 Copy Produzida — v" / "🤖 Reescrita Claude — v"), ou seja,
 * copy que NÃO veio da skill criar-copy-completo. Só leitura. Só admin.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const posts = await listarCopiasDoPortalNaEsteira();
  return NextResponse.json({ ok: true, total: posts.length, posts });
}

/** POST { postIds: string[], simular?: boolean } — apaga as copies geradas pelo portal. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { postIds?: string[]; simular?: boolean };
  const ids = (body.postIds ?? []).filter((x) => typeof x === 'string').slice(0, 40);
  if (!ids.length) return NextResponse.json({ error: 'sem posts' }, { status: 400 });
  const resultado = await apagarCopiasDoPortal(ids, body.simular !== false);
  if (body.simular === false) invalidarCachesAposMudanca();
  return NextResponse.json({ ok: true, resultado });
}
