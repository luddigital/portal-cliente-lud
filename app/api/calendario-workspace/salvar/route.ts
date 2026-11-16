import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { salvarCalendarioWorkspace } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/calendario-workspace/salvar
 * Body: { projetoId, ano, mes, briefingLivre?, rascunho?, feedbacks?, projectClaudeUrl? }
 *
 * Chamado em debounce pelo client component sempre que a Luiza altera qualquer
 * campo do workspace. UPSERT na tabela calendario_workspace.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin) return NextResponse.json({ error: 'só admin' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    projetoId?: string;
    ano?: number;
    mes?: number;
    briefingLivre?: string;
    rascunho?: string;
    feedbacks?: string;
    projectClaudeUrl?: string | null;
  };

  const projetoId = (body.projetoId ?? '').trim();
  const ano = Number(body.ano);
  const mes = Number(body.mes);
  if (!projetoId || !Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'parâmetros inválidos' }, { status: 400 });
  }

  const salvo = await salvarCalendarioWorkspace(
    {
      projetoId,
      ano,
      mes,
      briefingLivre: (body.briefingLivre ?? '').slice(0, 100_000),
      rascunho: (body.rascunho ?? '').slice(0, 200_000),
      feedbacks: (body.feedbacks ?? '').slice(0, 100_000),
      projectClaudeUrl: body.projectClaudeUrl ? body.projectClaudeUrl.trim().slice(0, 1_000) : null,
    },
    session.email,
  );

  if (!salvo) return NextResponse.json({ error: 'erro ao salvar' }, { status: 500 });
  return NextResponse.json({ ok: true, atualizadoEm: salvo.atualizadoEm });
}
