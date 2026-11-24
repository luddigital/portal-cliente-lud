import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { criarTarefasDeCalendario } from '@/lib/tarefas-calendario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Dia 1 de cada mês, 9h: tarefas de Criação de Calendário (2 meses à frente). `?previa=1` só mostra. */
export async function GET(req: Request) {
  const previa = new URL(req.url).searchParams.get('previa') === '1';
  const secret = process.env.CRON_SECRET;
  const doCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
  const s = !doCron && previa ? await getSession().catch(() => null) : null;
  const admin = !!s && env.auth.adminEmails.includes(s.email.trim().toLowerCase());
  if (!doCron && !admin) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, previa, ...(await criarTarefasDeCalendario({ hoje: hojeEmSaoPaulo(), previa })) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message }, { status: 500 });
  }
}
