import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { apagarDocContexto, salvarDocContexto } from '@/lib/contextoClientes';

export const runtime = 'nodejs';

async function soAdmin() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(s.email.trim().toLowerCase())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  return null;
}

/** Cria ou atualiza um documento do contexto de um cliente. */
export async function POST(req: Request) {
  const negado = await soAdmin();
  if (negado) return negado;
  const b = await req.json().catch(() => ({}));
  if (!b.handle || !b.titulo?.trim()) return NextResponse.json({ error: 'Faltou cliente ou título.' }, { status: 400 });
  try {
    const doc = await salvarDocContexto({ ...b, origem: b.origem ?? 'Portal' });
    return NextResponse.json({ ok: true, doc });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Não consegui salvar.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const negado = await soAdmin();
  if (negado) return negado;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Faltou o id.' }, { status: 400 });
  try {
    await apagarDocContexto(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Não consegui apagar.' }, { status: 500 });
  }
}
