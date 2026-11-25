import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { zapiGet } from '@/lib/zapi-mensagens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Pergunta pro Z-API se o WhatsApp da Lud está conectado (guarda a resposta por 2 min). */
const statusZapi = unstable_cache(
  async () => {
    const s = await zapiGet('/status').catch(() => null);
    if (!s || typeof s !== 'object') return { conectado: null as boolean | null };
    return { conectado: s.connected === true ? true : s.connected === false ? false : null };
  },
  ['zapi-status-v1'],
  { revalidate: 120 },
);

export async function GET() {
  const s = await getSession().catch(() => null);
  if (!s || !env.auth.adminEmails.includes(s.email.trim().toLowerCase())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  return NextResponse.json(await statusZapi());
}
