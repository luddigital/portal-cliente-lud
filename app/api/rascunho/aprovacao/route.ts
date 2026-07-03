import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  lerRascunhoAprovacao,
  limparRascunhoAprovacao,
  salvarRascunhoAprovacao,
  type Marcacao,
} from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/rascunho/aprovacao?tarefaId=X — carrega rascunho do usuário */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const tarefaId = (url.searchParams.get('tarefaId') ?? '').trim();
  if (!tarefaId) {
    return NextResponse.json({ error: 'tarefaId obrigatório' }, { status: 400 });
  }

  const rascunho = await lerRascunhoAprovacao(tarefaId, session.email);
  return NextResponse.json(rascunho);
}

/** POST /api/rascunho/aprovacao — salva (upsert) */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    tarefaId?: string;
    comentarioGeral?: string;
    marcacoes?: Marcacao[];
  };
  const tarefaId = (body.tarefaId ?? '').trim();
  if (!tarefaId) {
    return NextResponse.json({ error: 'tarefaId obrigatório' }, { status: 400 });
  }

  const comentarioGeral = (body.comentarioGeral ?? '').slice(0, 5000);
  const marcacoes = Array.isArray(body.marcacoes)
    ? body.marcacoes
        .filter(
          (m) =>
            m &&
            typeof m.t === 'number' &&
            Number.isFinite(m.t) &&
            typeof m.texto === 'string',
        )
        .map((m) => ({ t: m.t, texto: m.texto.slice(0, 1000) }))
        .slice(0, 100)
    : [];

  try {
    await salvarRascunhoAprovacao(tarefaId, session.email, comentarioGeral, marcacoes);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao salvar' },
      { status: 500 },
    );
  }
}

/** DELETE /api/rascunho/aprovacao?tarefaId=X — limpa (após aprovar/pedir alteração) */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const tarefaId = (url.searchParams.get('tarefaId') ?? '').trim();
  if (!tarefaId) {
    return NextResponse.json({ error: 'tarefaId obrigatório' }, { status: 400 });
  }

  await limparRascunhoAprovacao(tarefaId, session.email);
  return NextResponse.json({ ok: true });
}
