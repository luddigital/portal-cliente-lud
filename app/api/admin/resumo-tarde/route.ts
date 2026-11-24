import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { marcarForaDoResumo } from '@/lib/resumo-tarde';

export const runtime = 'nodejs';

/** Tira (ou volta) um post do resumo de hoje. POST { postId, fora } */
export async function POST(req: Request) {
  const s = await getSession().catch(() => null);
  if (!s || !env.auth.adminEmails.includes(s.email.trim().toLowerCase())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { postId?: string; fora?: boolean };
  if (!b.postId) return NextResponse.json({ error: 'falta o post' }, { status: 400 });
  try {
    await marcarForaDoResumo(b.postId, !!b.fora);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'erro' }, { status: 500 });
  }
}
