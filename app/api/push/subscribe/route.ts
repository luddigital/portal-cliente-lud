import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addSubscription, removeSubscription, type PushSubscription } from '@/lib/push';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { subscription?: PushSubscription };
  if (!body.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
    return NextResponse.json({ error: 'subscription inválida' }, { status: 400 });
  }
  await addSubscription(session.email, body.subscription);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: 'endpoint faltando' }, { status: 400 });
  await removeSubscription(session.email, body.endpoint);
  return NextResponse.json({ ok: true });
}
