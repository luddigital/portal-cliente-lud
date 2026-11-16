import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { atualizarReuniao, criarReuniao, excluirReuniao } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function guard() {
  const session = await getSession();
  if (!session) return { erro: 'não autenticado', status: 401, session: null };
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin) return { erro: 'só admin', status: 403, session: null };
  return { erro: null, status: 200, session };
}

/** POST — criar nova reunião. */
export async function POST(req: Request) {
  const g = await guard();
  if (g.erro || !g.session) return NextResponse.json({ error: g.erro }, { status: g.status });

  const body = (await req.json().catch(() => ({}))) as {
    projetoId?: string;
    clienteNome?: string | null;
    data?: string;
    titulo?: string;
    pauta?: string;
  };

  const projetoId = (body.projetoId ?? '').trim();
  const data = (body.data ?? '').trim();
  if (!projetoId || !data) {
    return NextResponse.json({ error: 'projetoId e data obrigatórios' }, { status: 400 });
  }

  const criada = await criarReuniao(
    {
      projetoId,
      clienteNome: body.clienteNome?.trim() || null,
      data,
      titulo: (body.titulo ?? '').slice(0, 300),
      pauta: (body.pauta ?? '').slice(0, 10_000),
    },
    g.session.email,
  );
  if (!criada) return NextResponse.json({ error: 'erro ao criar' }, { status: 500 });
  return NextResponse.json({ ok: true, reuniao: criada });
}

/** PATCH — atualizar reunião (data, título, pauta, feita, anotações). */
export async function PATCH(req: Request) {
  const g = await guard();
  if (g.erro || !g.session) return NextResponse.json({ error: g.erro }, { status: g.status });

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    data?: string;
    titulo?: string;
    pauta?: string;
    feita?: boolean;
    anotacoes?: string;
  };

  const id = (body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const atualizada = await atualizarReuniao(
    id,
    {
      data: body.data,
      titulo: body.titulo?.slice(0, 300),
      pauta: body.pauta?.slice(0, 10_000),
      feita: body.feita,
      anotacoes: body.anotacoes?.slice(0, 20_000),
    },
    g.session.email,
  );
  if (!atualizada) return NextResponse.json({ error: 'erro ao atualizar' }, { status: 500 });
  return NextResponse.json({ ok: true, reuniao: atualizada });
}

/** DELETE — excluir reunião pelo query ?id=. */
export async function DELETE(req: Request) {
  const g = await guard();
  if (g.erro) return NextResponse.json({ error: g.erro }, { status: g.status });
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  const ok = await excluirReuniao(id);
  if (!ok) return NextResponse.json({ error: 'erro ao excluir' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
