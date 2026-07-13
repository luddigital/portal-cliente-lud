import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorByEmail } from '@/lib/notion';
import { salvarObjetivosSemana } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/gestao/objetivos { projetoId, texto } — só equipe Lud. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    projetoId?: string;
    texto?: string;
  };
  const projetoId = (body.projetoId ?? '').trim();
  if (!projetoId) {
    return NextResponse.json({ error: 'projetoId obrigatório' }, { status: 400 });
  }

  try {
    await salvarObjetivosSemana(projetoId, (body.texto ?? '').slice(0, 10_000), session.email);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
