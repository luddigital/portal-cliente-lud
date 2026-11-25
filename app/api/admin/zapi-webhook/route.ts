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
export async function GET(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const me = await zapiGet('/me').catch((e) => ({ erro: e?.message }));
  // ?grupo=<id> também mostra o grupo: nome, quem está nele e se só admin manda mensagem.
  const grupo = new URL(req.url).searchParams.get('grupo');
  if (grupo) {
    const id = grupo.endsWith('-group') ? grupo : `${grupo}-group`;
    const meta = await zapiGet(`/group-metadata/${id}`).catch((e) => ({ erro: e?.message }));
    const fone = String(me?.phone ?? me?.id ?? '').replace(/\D/g, '');
    const participantes = (meta?.participants ?? []) as { phone?: string; isAdmin?: boolean; isSuperAdmin?: boolean }[];
    const euNoGrupo = participantes.find((p) => fone && String(p.phone ?? '').replace(/\D/g, '').endsWith(fone.slice(-8)));
    return NextResponse.json({
      me: { phone: me?.phone ?? me?.id, name: me?.name },
      grupo: { nome: meta?.subject, soAdminManda: meta?.announce ?? meta?.onlyAdminsSendMessage ?? null, participantes: participantes.length, erro: meta?.error ?? meta?.message ?? null },
      euNoGrupo: euNoGrupo ? { admin: !!(euNoGrupo.isAdmin || euNoGrupo.isSuperAdmin) } : null,
    });
  }
  return NextResponse.json({ me });
}

/** POST: liga o webhook de mensagens recebidas (+ enviadas por mim) apontando pro portal. */
export async function POST() {
  if (!(await admin())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const recebidas = await zapiPut('/update-webhook-received', { value: urlDoWebhookZapi() });
  const enviadas = await zapiPut('/update-notify-sent-by-me', { notifySentByMe: true });
  return NextResponse.json({ recebidas, enviadas });
}
