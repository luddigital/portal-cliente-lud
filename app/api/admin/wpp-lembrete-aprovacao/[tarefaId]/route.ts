import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getTarefaComPost,
  getEmpresaDetalhe,
  listAllProjetos,
} from '@/lib/notion';
import { getGrupoWhatsappDoProjeto } from '@/lib/supabase';
import { enviarMensagemTexto, zapiConfigured } from '@/lib/zapi';
import { montarLembrete } from '@/lib/lembrete-aprovacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin dispara um lembrete via WhatsApp pro cliente responsável por uma
 * tarefa de aprovação. Resolve: tarefa → projeto → cliente → whatsapp,
 * monta a mensagem com link pro portal e envia pela Z-API.
 *
 * POST { mensagemCustom?: string, apenasPrevia?: boolean }
 * apenasPrevia=true → só monta a mensagem padrão e devolve, sem enviar.
 */
export async function POST(
  req: Request,
  { params }: { params: { tarefaId: string } },
): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mensagemCustom?: string;
    apenasPrevia?: boolean;
  };

  // 1) Tarefa → projeto
  const data = await getTarefaComPost(params.tarefaId);
  if (!data) {
    return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 });
  }
  const t = data.tarefa;
  if (!t.projetoId) {
    return NextResponse.json(
      { error: 'tarefa sem projeto associado' },
      { status: 400 },
    );
  }

  // 2) Projeto → GRUPO do WhatsApp. SEMPRE pro grupo — nunca pro PV.
  const grupo = await getGrupoWhatsappDoProjeto(t.projetoId);

  // Resolve nome do cliente pra personalizar o cabeçalho da mensagem.
  const projetos = await listAllProjetos();
  const projeto = projetos.find((p) => p.id === t.projetoId);
  const clienteId = projeto ? ((projeto as any).clienteId as string | undefined) : undefined;
  const cliente = clienteId ? await getEmpresaDetalhe(clienteId) : null;
  const nomeCliente = cliente?.nome ?? projeto?.nome ?? 'cliente';

  const linkPost = t.postId
    ? `${env.app.url}/post/${t.postId}?tarefa=${params.tarefaId}`
    : `${env.app.url}/tarefa/${params.tarefaId}`;

  const apelido = grupo?.apelido?.trim() || null;
  const lembrete = montarLembrete({
    apelido: apelido ?? nomeCliente,
    tarefaTitulo: t.tarefaTitulo,
    postTitulo: t.postTitulo || t.tarefaTitulo,
    prazo: t.tarefaPrazo,
    postData: t.postData,
    link: linkPost,
  });
  const mensagemPadrao = lembrete.mensagem;

  const erroSemGrupo =
    `Esse projeto não tem grupo do WhatsApp vinculado. ` +
    `Vincule em /admin/whatsapp antes de enviar lembretes. ` +
    `(Projeto: "${projeto?.nome ?? t.projetoId}")`;

  if (body.apenasPrevia) {
    return NextResponse.json({
      mensagem: mensagemPadrao,
      clienteNome: nomeCliente,
      apelido,
      situacao: lembrete.situacao,
      grupoNome: grupo?.id ? grupo.nome : null,
      erroGrupo: grupo?.id ? null : erroSemGrupo,
    });
  }

  if (!grupo?.id) {
    return NextResponse.json({ error: erroSemGrupo }, { status: 400 });
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

  const mensagem = body.mensagemCustom?.trim() || mensagemPadrao;

  const resultado = await enviarMensagemTexto(grupo.id, mensagem);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: `Falha ao enviar pro grupo: ${resultado.erro}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    destino: 'grupo',
    grupoId: grupo.id,
    grupoNome: grupo.nome,
    clienteNome: nomeCliente,
    messageId: resultado.messageId,
    previa: mensagem,
  });
}
