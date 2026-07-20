import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  atualizarStatusPost,
  getColaboradorByEmail,
  invalidarCachesAposMudanca,
} from '@/lib/notion';
import { salvarConfigProgramacao } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/programar/config
 * Body: { postId, horario, plataformas, formato, legenda, acao }
 *   acao = 'confirmar' → salva config + status pra 'Agendado'
 *   acao = 'rascunho'  → só salva config (não muda status)
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const c = await getColaboradorByEmail(session.email);
      ehColaborador = !!c;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    postId?: string;
    horario?: string;
    plataformas?: string[];
    formato?: string;
    legenda?: string;
    acao?: 'confirmar' | 'rascunho';
  };

  const postId = (body.postId ?? '').trim();
  if (!postId) return NextResponse.json({ error: 'postId obrigatório' }, { status: 400 });
  const acao = body.acao === 'confirmar' ? 'confirmar' : 'rascunho';

  const config = {
    horario: (body.horario ?? '').slice(0, 10),
    plataformas: Array.isArray(body.plataformas)
      ? body.plataformas.filter((s) => typeof s === 'string').slice(0, 10)
      : [],
    formato: (body.formato ?? '').slice(0, 40),
    legenda: (body.legenda ?? '').slice(0, 10_000),
  };

  try {
    await salvarConfigProgramacao(postId, config, session.email);
    if (acao === 'confirmar') {
      await atualizarStatusPost(postId, 'Agendado');
      invalidarCachesAposMudanca();
    }
    return NextResponse.json({ ok: true, acao });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
