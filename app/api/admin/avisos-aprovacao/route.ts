import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { enviarAviso, planejarAvisos } from '@/lib/aviso-aprovacao';
import { invalidarCachesAposMudanca } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Modo prévia dos avisos automáticos de aprovação: a equipe manda com um clique.
 * POST { chave, mensagem? } manda um grupo · POST { todos: true } manda todos.
 * O plano é refeito na hora, então a regra das 5 horas vale também aqui.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { chave?: string; mensagem?: string; todos?: boolean };
  let plano;
  try {
    plano = await planejarAvisos();
  } catch (err: any) {
    return NextResponse.json({ error: `Não consegui conferir o que já foi enviado: ${err?.message ?? err}` }, { status: 503 });
  }
  const alvo = body.todos ? plano.enviar : plano.enviar.filter((g) => g.chave === body.chave);
  if (alvo.length === 0) {
    return NextResponse.json({ error: 'Esse aviso não está mais na lista (já foi enviado ou o post saiu da aprovação).' }, { status: 409 });
  }
  const resultados = [];
  for (const g of alvo) {
    const r = await enviarAviso(g, session.email, body.todos ? undefined : body.mensagem);
    resultados.push({ chave: g.chave, projeto: g.projetoNome, ...r });
  }
  invalidarCachesAposMudanca();
  const falhas = resultados.filter((r) => !r.ok);
  return NextResponse.json({ ok: falhas.length === 0, resultados }, { status: falhas.length && falhas.length === resultados.length ? 502 : 200 });
}
