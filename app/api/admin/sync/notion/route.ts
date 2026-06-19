import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { sincronizarProjetos } from '@/lib/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Dispara sync Notion → Supabase pra um conjunto de projetos.
 *
 * POST { projetoIds: ["uuid1", "uuid2"] }
 *
 * Risk-zero: SÓ escreve em Supabase. Não toca em nada existente do portal.
 * Roda quantas vezes quiser — upsert por ID, idempotente.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    projetoIds?: string[];
  };
  const ids = (body.projetoIds ?? []).filter(
    (s) => typeof s === 'string' && s.length > 0,
  );
  if (ids.length === 0) {
    return NextResponse.json(
      { error: 'projetoIds vazio — passe ao menos 1 projetoId' },
      { status: 400 },
    );
  }

  try {
    const r = await sincronizarProjetos(ids);
    return NextResponse.json({
      ok: !r.postagens.erro && !r.tarefas.erro,
      postagens: r.postagens,
      tarefas: r.tarefas,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro inesperado' },
      { status: 500 },
    );
  }
}
