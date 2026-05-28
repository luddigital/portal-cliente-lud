import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
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
  const arquivos = form.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0);

  if (!texto && arquivos.length === 0) {
    return NextResponse.json({ error: 'envia pelo menos texto ou arquivo' }, { status: 400 });
  }

  let driveLink: string | null = null;
  let totalArquivos = 0;

  if (arquivos.length > 0) {
    const folder = await ensurePostFolder({
      cliente: t.projetoNome,
      postTitulo: t.postTitulo,
      dataPostagem: t.postData,
    });
    driveLink = folder.webViewLink;

    for (const file of arquivos) {
      const buf = Buffer.from(await file.arrayBuffer());
      await uploadFile({
        folderId: folder.folderId,
        name: file.name,
        mimeType: file.type,
        buffer: buf,
      });
      totalArquivos++;
    }

    await atualizarLinkDriveDoPost(t.postId, `Materiais — ${t.postTitulo}`, driveLink);
  }

  // O texto vem só como comentário no Notion — não escrevemos no corpo do post.
  const partes: string[] = [`✅ Tarefa "${t.tarefaTitulo}" — recebida do cliente.`];
  if (totalArquivos > 0 && driveLink) {
    partes.push(`📎 ${totalArquivos} arquivo${totalArquivos > 1 ? 's' : ''} no Drive: ${driveLink}`);
  }
  if (texto) {
    partes.push('');
    partes.push(`📝 Informações enviadas pelo cliente:`);
    partes.push(texto);
  }
  await comentarPost(t.postId, partes.join('\n'));

  await concluirTarefa(t.tarefaId);
  invalidarCachesAposMudanca();

  return NextResponse.json({ ok: true, driveLink, arquivos: totalArquivos });
}
