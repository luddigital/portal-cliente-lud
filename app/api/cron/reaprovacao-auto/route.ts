import { NextResponse } from 'next/server';
import { rodarReaprovacaoAutomatica } from '@/lib/reaprovacao-auto';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Reaprovação automática (a cada 10 min, das 9h às 18h de São Paulo, seg a sex).
 * `?previa=1` só mostra o que mandaria, sem enviar.
 */
export async function GET(req: Request) {
  const previa = new URL(req.url).searchParams.get('previa') === '1';
  const secret = process.env.CRON_SECRET;
  const doCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
  // A prévia (não manda nada) também abre pra quem é admin, pra conferir pelo navegador.
  const session = !doCron && previa ? await getSession().catch(() => null) : null;
  const admin = !!session && env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!doCron && !admin) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  const agoraSp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hora = agoraSp.getHours();
  const diaUtil = agoraSp.getDay() >= 1 && agoraSp.getDay() <= 5;
  if (!previa && (!diaUtil || hora < 9 || hora >= 18)) return NextResponse.json({ ok: true, fora_do_horario: true });
  try {
    const r = await rodarReaprovacaoAutomatica({ enviar: !previa });
    if (r.erros.length) console.warn('[reaprovacao-auto]', r.erros);
    return NextResponse.json({ ok: true, previa, ...r });
  } catch (err: any) {
    console.warn('[reaprovacao-auto] falhou:', err?.message);
    return NextResponse.json({ ok: false, erro: err?.message }, { status: 500 });
  }
}
