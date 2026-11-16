import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  atualizarDataDoPost,
  atualizarRelationDoPost,
  atualizarSelectDoPost,
  getColaboradorByEmail,
  tipoDaPropDoPost,
} from '@/lib/notion';

/** Salva o valor de uma prop que pode ser relation OU select — detecta
 *  automático pelo tipo no Notion. `valor` é ID (relation) ou nome (select). */
async function salvarPropDinamico(
  postId: string,
  propriedade: string,
  valor: string | null,
): Promise<void> {
  const tipo = await tipoDaPropDoPost(propriedade);
  if (tipo === 'relation') {
    await atualizarRelationDoPost(postId, propriedade, valor ? [valor] : []);
  } else if (tipo === 'select' || tipo === 'status') {
    await atualizarSelectDoPost(postId, propriedade, valor);
  } else {
    throw new Error(`prop "${propriedade}" não é relation nem select (tipo: ${tipo ?? 'desconhecido'})`);
  }
}

export const runtime = 'nodejs';

/** POST /api/pauta/[postId]/props
 *  body: { formatoId? | null, funilId? | null, objetivoId? | null, demandaValor? | null }
 *  — envia só o que mudou; null = limpa. Só equipe Lud. */
export async function POST(req: Request, { params }: { params: { postId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const email = session.email.trim().toLowerCase();
  const ehAdmin = env.auth.adminEmails.includes(email);
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const c = await getColaboradorByEmail(session.email);
      ehColaborador = !!c;
    } catch { /* mantém false */ }
  }
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    formatoId?: string | null;
    funilId?: string | null;
    objetivoId?: string | null;
    demandaValor?: string | null;
    data?: string | null;
  };

  try {
    if ('data' in body) {
      const d = body.data;
      if (d && !/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(d)) {
        return NextResponse.json({ error: 'data deve ser YYYY-MM-DD' }, { status: 400 });
      }
      await atualizarDataDoPost(params.postId, d ?? null);
    }
    if ('formatoId' in body) {
      await salvarPropDinamico(params.postId, 'Formato', body.formatoId ?? null);
    }
    if ('funilId' in body) {
      await salvarPropDinamico(params.postId, 'Funil', body.funilId ?? null);
    }
    if ('objetivoId' in body) {
      await salvarPropDinamico(params.postId, 'Objetivo', body.objetivoId ?? null);
    }
    if ('demandaValor' in body) {
      await salvarPropDinamico(
        params.postId,
        env.notion.postProps.demanda,
        body.demandaValor ?? null,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[pauta/props] erro:', err);
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
