import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { invalidarCachesAposMudanca, listOpcoesRelation, mudarFormatoDoPost } from '@/lib/notion';

export const runtime = 'nodejs';

async function soAdmin() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  return null;
}

/** Opções de formato do post (base Formato do Notion). */
export async function GET() {
  const negado = await soAdmin();
  if (negado) return negado;
  const opcoes = await listOpcoesRelation('Formato').catch(() => []);
  return NextResponse.json({ opcoes });
}

/** Troca o formato do post. Body: { postId, formatoId }. */
export async function POST(req: Request) {
  const negado = await soAdmin();
  if (negado) return negado;
  const b = (await req.json().catch(() => ({}))) as { postId?: string; formatoId?: string };
  if (!b.postId || !b.formatoId) return NextResponse.json({ error: 'dados faltando' }, { status: 400 });
  try {
    await mudarFormatoDoPost(b.postId, b.formatoId);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Não consegui trocar o formato.' }, { status: 500 });
  }
}
