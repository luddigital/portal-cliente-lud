import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { atualizarPrazoTarefa, invalidarCachesAposMudanca, listColaboradores } from '@/lib/notion';
import { registrarMudancaPrazo } from '@/lib/supabase';

export const runtime = 'nodejs';

/** Nome curto de quem mexeu: colaborador cadastrado, senão a Luiza (conta da Lud.), senão o e-mail. */
async function nomeDoAutor(email: string): Promise<string | null> {
  const e = email.trim().toLowerCase();
  const colab = (await listColaboradores().catch(() => [])).find(
    (c) => (c.email ?? '').trim().toLowerCase() === e,
  );
  if (colab) return colab.nome.split(' ')[0];
  if (e === 'oi@lud.digital') return 'Luiza';
  return null;
}

/**
 * Muda o prazo (Data Entrega) de uma tarefa no Notion e guarda no histórico.
 * POST { prazo: 'YYYY-MM-DD' } → { ok, mudanca }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
    if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const prazo = String(body?.prazo ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
      return NextResponse.json({ error: 'data inválida' }, { status: 400 });
    }

    const { anterior, titulo, postId } = await atualizarPrazoTarefa(params.id, prazo);
    invalidarCachesAposMudanca();

    const mudanca =
      anterior === prazo
        ? null
        : await registrarMudancaPrazo({
            tarefaId: params.id,
            postId,
            tarefaTitulo: titulo,
            de: anterior,
            para: prazo,
            email: session.email,
            nome: await nomeDoAutor(session.email),
          });

    return NextResponse.json({ ok: true, mudanca });
  } catch (err: any) {
    console.error('[prazo tarefa] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
