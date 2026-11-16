import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { salvarVersaoCalendario } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/calendario-workspace/versao
 * Body: { projetoId, ano, mes }
 *
 * Congela o rascunho + feedbacks atuais numa nova entrada em `versoes[]`.
 * Chamado quando a Luiza aperta "Salvar versão".
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
  };

  const projetoId = (body.projetoId ?? '').trim();
  const ano = Number(body.ano);
  const mes = Number(body.mes);
  if (!projetoId || !Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'parâmetros inválidos' }, { status: 400 });
  }

  const atualizado = await salvarVersaoCalendario({ projetoId, ano, mes }, session.email);
  if (!atualizado) return NextResponse.json({ error: 'erro ao salvar versão' }, { status: 500 });
  return NextResponse.json({ ok: true, versoes: atualizado.versoes });
}
