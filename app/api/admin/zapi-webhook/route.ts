import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { urlDoWebhookZapi, zapiGet, zapiPut } from '@/lib/zapi-mensagens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function admin() {
  const s = await getSession().catch(() => null);
  return !!s && env.auth.adminEmails.includes(s.email.trim().toLowerCase());
}

/** GET: mostra a configuração atual de webhooks do Z-API (sem mudar nada). */
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const me = await zapiGet('/me').catch((e) => ({ erro: e?.message }));
  return NextResponse.json({ me });
}

/** POST: liga o webhook de mensagens recebidas (+ enviadas por mim) apontando pro portal. */
export async function POST() {
  if (!(await admin())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const recebidas = await zapiPut('/update-webhook-received', { value: urlDoWebhookZapi() });
  const enviadas = await zapiPut('/update-notify-sent-by-me', { notifySentByMe: true });
  return NextResponse.json({ recebidas, enviadas });
}
