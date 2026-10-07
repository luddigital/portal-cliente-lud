import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { invalidarCachesAposMudanca, reabrirTarefa } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const STATUS_ABERTOS = ['Inbox', 'Em Pausa', 'Iniciar', 'Em Andamento', 'Acompanhar'];

/** Desfaz um "concluir" feito por engano (só admin). POST { status } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = STATUS_ABERTOS.includes(body.status ?? '') ? body.status! : 'Iniciar';
  try {
    await reabrirTarefa(params.id, status);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro ao reabrir' }, { status: 500 });
  }
}
