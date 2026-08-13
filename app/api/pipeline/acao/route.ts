import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorByEmail } from '@/lib/notion';
import {
  ETAPA_IDS,
  type EtapaCopyId,
  gerarRascunhoEtapa,
  salvarContextoEtapa,
  enfileirarProducaoFinal,
  lerPipelineDoPost,
} from '@/lib/pipelineCopy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type AcaoBody = {
  acao?: 'rascunho' | 'contexto' | 'producao_final';
  postId?: string;
  projetoId?: string;
  etapa?: EtapaCopyId;
  contexto?: string;
  ctx?: {
    postTitulo?: string;
    formato?: string | null;
    clienteNome?: string | null;
    anteriores?: { etapa: EtapaCopyId; output: string }[];
  };
};

/** Só equipe Lud. (admin ou colaborador) pode mexer no pipeline. */
async function gateEquipe(email: string): Promise<boolean> {
  const ehAdmin = env.auth.adminEmails.includes(email.trim().toLowerCase());
  if (ehAdmin) return true;
  try {
    const colab = await getColaboradorByEmail(email);
    return !!colab;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!(await gateEquipe(session.email))) {
    return NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as AcaoBody;
  const acao = body.acao;
  const postId = (body.postId ?? '').trim();
  const projetoId = (body.projetoId ?? '').trim();
  const etapa = body.etapa;

  if (!postId || !projetoId) {
    return NextResponse.json({ error: 'postId e projetoId obrigatórios' }, { status: 400 });
  }
  if (!etapa || !ETAPA_IDS.includes(etapa)) {
    return NextResponse.json({ error: 'etapa inválida' }, { status: 400 });
  }

  try {
    if (acao === 'contexto') {
      await salvarContextoEtapa(
        postId,
        projetoId,
        etapa,
        (body.contexto ?? '').slice(0, 4000),
        session.email,
      );
    } else if (acao === 'producao_final') {
      await enfileirarProducaoFinal(postId, projetoId, etapa, session.email);
    } else if (acao === 'rascunho') {
      await gerarRascunhoEtapa(
        postId,
        projetoId,
        etapa,
        {
          postTitulo: body.ctx?.postTitulo ?? 'Post',
          formato: body.ctx?.formato ?? null,
          clienteNome: body.ctx?.clienteNome ?? null,
          contextoExtra: body.contexto ?? null,
          anteriores: body.ctx?.anteriores ?? [],
        },
        session.email,
      );
    } else {
      return NextResponse.json({ error: 'ação inválida' }, { status: 400 });
    }

    // Devolve o estado fresco do post pro board atualizar sem reload.
    const pipeline = await lerPipelineDoPost(postId);
    return NextResponse.json({ ok: true, pipeline });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'erro' }, { status: 500 });
  }
}
