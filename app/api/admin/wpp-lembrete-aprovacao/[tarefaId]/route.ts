import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  concluirTarefa,
  getTarefaComPost,
  getEmpresaDetalhe,
  invalidarCachesAposMudanca,
  listAllProjetos,
  listarTarefasDoPost,
} from '@/lib/notion';
import { getGruposWhatsappDoProjeto, registrarEnvioAvulso } from '@/lib/supabase';
import { enviarMensagemTexto, zapiConfigured } from '@/lib/zapi';
import { montarLembrete } from '@/lib/lembrete-aprovacao';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';

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
    grupoId?: string;
    /** Outras tarefas do mesmo cliente que entram no mesmo lembrete. */
    outrasTarefaIds?: string[];
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
  const grupos = await getGruposWhatsappDoProjeto(t.projetoId);
  const grupo = body.grupoId
    ? grupos.find((g) => g.id === body.grupoId) ?? null
    : grupos[0] ?? null;

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
  const textos = await lerMensagensEditadas();
  // Aprovação nova depois de uma alteração (Ordem (1) = 03) → mensagem de reaprovação.
  const daTarefa = t.postId
    ? (await listarTarefasDoPost(t.postId).catch(() => [])).find(
        (x) => x.tarefaId.replace(/-/g, '') === params.tarefaId.replace(/-/g, ''),
      )
    : undefined;
  const reaprovacao = !!daTarefa && daTarefa.ordemUm === '03' && /aprova/i.test(t.tarefaTitulo);
  // Outros posts do mesmo cliente no mesmo lembrete (botão "Lembrar no grupo" da entrega).
  const outras = (
    await Promise.all(
      (body.outrasTarefaIds ?? [])
        .filter((id) => id && id.replace(/-/g, '') !== params.tarefaId.replace(/-/g, ''))
        .slice(0, 12)
        .map((id) => getTarefaComPost(id).then((d) => (d ? { id, t: d.tarefa } : null)).catch(() => null)),
    )
  ).filter((x): x is { id: string; t: typeof t } => !!x && x.t.projetoId === t.projetoId);
  const postsDoLembrete = [
    { titulo: t.postTitulo || t.tarefaTitulo, link: linkPost, postId: t.postId },
    ...outras.map((o) => ({
      titulo: o.t.postTitulo || o.t.tarefaTitulo,
      link: o.t.postId ? `${env.app.url}/post/${o.t.postId}?tarefa=${o.id}` : `${env.app.url}/tarefa/${o.id}`,
      postId: o.t.postId,
    })),
  ];
  const lembrete = montarLembrete({
    posts: postsDoLembrete,
    forcarEtapa: reaprovacao ? 'reaprovacao' : undefined,
    textos,
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
      reaprovacao,
      mensagem: mensagemPadrao,
      clienteNome: nomeCliente,
      apelido,
      situacao: lembrete.situacao,
      grupoNome: grupo?.id ? grupo.nome : null,
      grupoId: grupo?.id ?? null,
      grupos: grupos.map((g) => ({ id: g.id, nome: g.nome, apelido: g.apelido })),
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

  for (const extra of postsDoLembrete.slice(1)) {
    if (!extra.postId) continue;
    await registrarEnvioAvulso({
      projetoId: t.projetoId,
      postId: extra.postId,
      momento: reaprovacao ? 'reaprovacao' : undefined,
      situacao: lembrete.situacao.codigo,
      texto: mensagem,
      grupoId: grupo.id,
      messageId: resultado.messageId ?? null,
      email: session.email,
    }).catch(() => {});
  }
  await registrarEnvioAvulso({
    projetoId: t.projetoId,
    postId: t.postId,
    momento: reaprovacao ? 'reaprovacao' : undefined,
    situacao: lembrete.situacao.codigo,
    texto: mensagem,
    grupoId: grupo.id,
    messageId: resultado.messageId ?? null,
    email: session.email,
  });

  // Conclusão automática da tarefa de envio da Lud quando o botão de envio
  // é apertado — sem isso, "Enviar Post Aprovação" fica eternamente aberta
  // e o post nunca passa pra "Aprovação | Post" (que é o que o cliente vê).
  //
  // Três cenários:
  //  1. Botão clicado numa tarefa "Enviar Post*" → conclui ELA MESMA (envio normal).
  //  2. Reaprovação (ordemUm=03) → busca a "Enviar Post*" aberta no post e conclui.
  //  3. Lembrete puro (tarefa atual = "Aprovação | Post" aguardando cliente) →
  //     não conclui nada, só mandou lembrete.
  let tarefaEnvioConcluida = false;
  const ehTarefaDeEnvio = /enviar\s*post|enviar.*aprova/i.test(t.tarefaTitulo);

  try {
    if (ehTarefaDeEnvio) {
      // Caso 1: a própria tarefa é de envio — concluir ela mesma.
      await concluirTarefa(params.tarefaId);
      tarefaEnvioConcluida = true;
    } else if (reaprovacao && t.postId) {
      // Caso 2: reaprovação depois de alteração — buscar e concluir a Enviar
      // Post relacionada (que foi reaberta pelo ciclo de alteração).
      const tarefasDoPost = await listarTarefasDoPost(t.postId);
      const enviarPost = tarefasDoPost.find(
        (x) => x.aberta && /enviar\s*post|enviar.*aprova/i.test(x.titulo),
      );
      if (enviarPost) {
        await concluirTarefa(enviarPost.tarefaId);
        tarefaEnvioConcluida = true;
      }
    }
    // Caso 3 (lembrete puro): não faz nada, o envio ao cliente já foi feito antes.
  } catch (err: any) {
    console.warn('[wpp-lembrete] não consegui concluir "Enviar Post":', err?.message);
  }

  // Entregas/régua/página do post leem com cache: invalidar faz o enviado
  // sumir da lista "falta enviar" sem precisar F5 manual.
  invalidarCachesAposMudanca();

  return NextResponse.json({
    ok: true,
    destino: 'grupo',
    grupoId: grupo.id,
    grupoNome: grupo.nome,
    clienteNome: nomeCliente,
    messageId: resultado.messageId,
    previa: mensagem,
    reaprovacao,
    tarefaEnvioConcluida,
  });
}
