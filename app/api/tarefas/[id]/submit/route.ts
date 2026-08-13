import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  adicionarLinkDriveAoPost,
  atualizarLinkDriveDoPost,
  comentarPost,
  concluirTarefa,
  getTarefaComPost,
  invalidarCachesAposMudanca,
} from '@/lib/notion';
import { ensurePostFolder, uploadFile } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    return await handle(req, params.id);
  } catch (err: any) {
    console.error('[tarefa submit] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) {
      try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    }
    return NextResponse.json({ error: msg, code: err?.code ?? null }, { status: 500 });
  }
}

async function handle(req: Request, tarefaId: string) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const data = await getTarefaComPost(tarefaId);
  if (!data) return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 });
  const t = data.tarefa;
  if (!t.projetoId || !session.projetoIds.includes(t.projetoId)) {
    return NextResponse.json({ error: 'sem permissão pra essa tarefa' }, { status: 403 });
  }

  const form = await req.formData();
  const texto = (form.get('texto') as string | null)?.trim() ?? '';
  const comentario = (form.get('comentario') as string | null)?.trim() ?? '';
  const linkUrlRaw = (form.get('linkUrl') as string | null)?.trim() ?? '';
  const linkUrl = /^https?:\/\//i.test(linkUrlRaw) ? linkUrlRaw : '';
  // O cliente agora envia 1 arquivo por request (pra não estourar Vercel
  // body limit nem timeout). O server aceita 0+ — vai subindo conforme
  // chegarem. Não finaliza tarefa enquanto finalize !== 'true'.
  const arquivos = form.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0);
  const finalize = form.get('finalize') === 'true';
  // Quando o cliente adianta materiais numa etapa de "pauta" (aprovação),
  // sobe arquivos + comenta, mas a tarefa fica aberta — quem fecha é o
  // clique de "Aprovar" via /aprovar.
  const naoConcluirTarefa = form.get('naoConcluirTarefa') === 'true';
  // Contagem acumulada vinda do client — só pro comentário final ficar
  // certo ("52 arquivos no Drive" em vez de "1 arquivo").
  const totalAcumulado = parseInt(
    (form.get('totalAcumulado') as string | null) ?? '0',
    10,
  ) || 0;

  if (!finalize && arquivos.length === 0) {
    return NextResponse.json(
      { error: 'sem arquivo nem finalize=true — nada a fazer' },
      { status: 400 },
    );
  }
  if (finalize && !texto && !comentario && !linkUrl && totalAcumulado === 0 && arquivos.length === 0) {
    return NextResponse.json(
      { error: 'envia pelo menos texto, arquivo, comentário ou link' },
      { status: 400 },
    );
  }

  let driveLink: string | null = null;
  let totalDessaCall = 0;

  if (arquivos.length > 0) {
    const folder = await ensurePostFolder({
      cliente: t.projetoNome,
      postTitulo: t.postTitulo,
      dataPostagem: t.postData,
    });
    driveLink = folder.webViewLink;

    // Sobe os arquivos dessa request em paralelo (cliente manda 1 por vez,
    // mas mantemos o loop pra resiliência caso mude no futuro).
    await Promise.all(
      arquivos.map(async (file) => {
        const buf = Buffer.from(await file.arrayBuffer());
        await uploadFile({
          folderId: folder.folderId,
          name: file.name,
          mimeType: file.type,
          buffer: buf,
        });
      }),
    );
    totalDessaCall = arquivos.length;
  }

  // Se ainda não é o finalize, só responde "ok" sem mexer em tarefa nem
  // Notion — vamos receber mais arquivos.
  if (!finalize) {
    return NextResponse.json({
      ok: true,
      driveLink,
      arquivos: totalDessaCall,
    });
  }

  // === FINALIZE: atualiza Drive link + comenta + conclui tarefa ===
  if (driveLink) {
    await atualizarLinkDriveDoPost(t.postId, `Materiais — ${t.postTitulo}`, driveLink);
  } else if (totalAcumulado > 0) {
    // Não temos a URL da pasta nesse request (foi setada no primeiro),
    // mas se o cliente já subiu arquivos antes a pasta existe.
    // Ensure pra pegar a URL e gravar.
    const folder = await ensurePostFolder({
      cliente: t.projetoNome,
      postTitulo: t.postTitulo,
      dataPostagem: t.postData,
    });
    driveLink = folder.webViewLink;
    await atualizarLinkDriveDoPost(t.postId, `Materiais — ${t.postTitulo}`, driveLink);
  }

  if (linkUrl) {
    try {
      await adicionarLinkDriveAoPost(
        t.postId,
        `Link enviado pelo cliente — ${t.postTitulo}`,
        linkUrl,
      );
    } catch (err: any) {
      console.warn('[submit] falhou adicionar link externo:', err?.message);
    }
  }

  const totalArquivos = totalAcumulado + totalDessaCall;
  const partes: string[] = [`✅ Tarefa "${t.tarefaTitulo}" — recebida do cliente.`];
  if (totalArquivos > 0 && driveLink) {
    partes.push(`📎 ${totalArquivos} arquivo${totalArquivos > 1 ? 's' : ''} no Drive: ${driveLink}`);
  }
  if (linkUrl) {
    partes.push(`🔗 Link externo: ${linkUrl}`);
  }
  if (texto) {
    partes.push('');
    partes.push(`📝 Informações enviadas pelo cliente:`);
    partes.push(texto);
  }
  if (comentario) {
    partes.push('');
    partes.push(`💬 Comentário do cliente:`);
    partes.push(comentario);
  }
  await comentarPost(t.postId, partes.join('\n'));

  if (!naoConcluirTarefa) {
    await concluirTarefa(t.tarefaId);
  }
  invalidarCachesAposMudanca();

  return NextResponse.json({
    ok: true,
    driveLink,
    arquivos: totalArquivos,
    linkAdicionado: !!linkUrl,
    tarefaConcluida: !naoConcluirTarefa,
  });
}
