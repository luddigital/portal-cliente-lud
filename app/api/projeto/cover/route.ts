import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { salvarCoverProjeto } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/projeto/cover
 * Body: { projetoId, coverUrl }  — coverUrl null/'' pra remover.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin) return NextResponse.json({ error: 'só admin' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    projetoId?: string;
    coverUrl?: string | null;
  };

  const projetoId = (body.projetoId ?? '').trim();
  if (!projetoId) return NextResponse.json({ error: 'projetoId obrigatório' }, { status: 400 });

  const url = body.coverUrl?.trim() || null;
  // Validação simples — bloqueia schemes esquisitos.
  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'URL precisa começar com http(s)://' }, { status: 400 });
  }

  const ok = await salvarCoverProjeto(projetoId, url, session.email);
  if (!ok) return NextResponse.json({ error: 'erro ao salvar' }, { status: 500 });
  return NextResponse.json({ ok: true, coverUrl: url });
}
