import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getGrupoWhatsappDoProjeto, registrarEnvioAvulso } from '@/lib/supabase';
import { enviarMensagemTexto, zapiConfigured } from '@/lib/zapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MENSAGEM = 4000;

/**
 * Admin envia UMA mensagem geral pro cliente do projeto, juntando tudo o que
 * está pendente (aprovações, materiais, informações). Sempre vai pro GRUPO do
 * WhatsApp vinculado ao projeto, nunca pro privado, e só sai depois do clique
 * em "Enviar" no popup (o texto é revisado e editável lá).
 *
 * POST { mensagem: string, postIds?: string[] }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mensagem?: unknown;
    postIds?: unknown;
    grupoId?: unknown;
  };
  const mensagem = typeof body.mensagem === 'string' ? body.mensagem.trim() : '';
  if (!mensagem) {
    return NextResponse.json({ error: 'A mensagem está vazia.' }, { status: 400 });
  }
  if (mensagem.length > MAX_MENSAGEM) {
    return NextResponse.json(
      { error: `A mensagem passou de ${MAX_MENSAGEM} caracteres. Encurte o texto.` },
      { status: 400 },
    );
  }
  const postIds = Array.isArray(body.postIds)
    ? body.postIds
        .filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length <= 64)
        .slice(0, 50)
    : [];

  // SEMPRE pro grupo — nunca pro PV.
  const grupo = await getGrupoWhatsappDoProjeto(
    params.id,
    typeof body.grupoId === 'string' ? body.grupoId : null,
  );
  if (!grupo?.id) {
    return NextResponse.json(
      {
        error:
          'Esse projeto não tem grupo do WhatsApp vinculado. Vincule em /admin/whatsapp antes de enviar.',
      },
      { status: 400 },
    );
  }

  if (!zapiConfigured()) {
    return NextResponse.json(
      {
        error:
          'Z-API não configurado. Preencha ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN nas env vars da Vercel.',
      },
      { status: 503 },
    );
  }

  const resultado = await enviarMensagemTexto(grupo.id, mensagem);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: `Falha ao enviar pro grupo: ${resultado.erro}` },
      { status: 502 },
    );
  }

  await registrarEnvioAvulso({
    projetoId: params.id,
    postId: null,
    postIds,
    momento: 'geral',
    situacao: 'pendencias',
    texto: mensagem,
    grupoId: grupo.id,
    messageId: resultado.messageId ?? null,
    email: session.email,
  });

  return NextResponse.json({
    ok: true,
    destino: 'grupo',
    grupoNome: grupo.nome,
    messageId: resultado.messageId,
  });
}
