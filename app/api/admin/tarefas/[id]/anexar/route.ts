import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  adicionarLinkDriveAoPost,
  atualizarLinkDriveDoPost,
  comentarPost,
  getTarefaComPost,
  invalidarCachesAposMudanca,
} from '@/lib/notion';
import { ensurePostFolder, uploadFile } from '@/lib/drive';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Admin anexa materiais a um post sem concluir a tarefa.
 *
 * Aceita 2 modos via FormData:
 *  - `arquivos[]`: sobe direto pro Drive da Lud e adiciona link no post
 *  - `linkUrl` (+ `linkNome` opcional): só anexa um link externo
 *
 * Diferente de /api/tarefas/[id]/submit (que conclui a tarefa do cliente),
 * esse aqui mantém a tarefa aberta — admin só quer registrar o material
 * que recebeu por fora (whatsapp etc).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
    if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    const data = await getTarefaComPost(params.id);
    if (!data)
      return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 });
    const t = data.tarefa;

    const form = await req.formData();
    const linkUrl = (form.get('linkUrl') as string | null)?.trim() ?? '';
    const linkNome =
      (form.get('linkNome') as string | null)?.trim() ||
      `Materiais — ${t.postTitulo}`;
    const arquivos = form
      .getAll('arquivos')
      .filter((f): f is File => f instanceof File && f.size === 0 ? false : f instanceof File);

    if (!linkUrl && arquivos.length === 0) {
      return NextResponse.json(
        { error: 'Anexe pelo menos um arquivo ou cole um link.' },
        { status: 400 },
      );
    }

    let driveLink: string | null = null;
    let totalArquivos = 0;

    // 1) Upload de arquivos — coloca na pasta do post no Drive da Lud
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

      // Atualiza o link da pasta no post (substituindo — Drive sempre só 1
      // pasta principal por post)
      await atualizarLinkDriveDoPost(
        t.postId,
        `Materiais — ${t.postTitulo}`,
        driveLink,
      );
    }

    // 2) Link externo (admin colou de Drive/dropbox/etc) — adiciona sem
    //    sobrescrever os existentes
    if (linkUrl) {
      await adicionarLinkDriveAoPost(t.postId, linkNome, linkUrl);
    }

    // Registra no histórico do post
    const partes: string[] = [
      `📎 ${session.email} anexou material via admin.`,
    ];
    if (totalArquivos > 0 && driveLink) {
      partes.push(
        `${totalArquivos} arquivo${totalArquivos > 1 ? 's' : ''} no Drive: ${driveLink}`,
      );
    }
    if (linkUrl) {
      partes.push(`Link adicionado: ${linkUrl}`);
    }
    await comentarPost(t.postId, partes.join('\n'));

    invalidarCachesAposMudanca();
    return NextResponse.json({
      ok: true,
      driveLink,
      arquivos: totalArquivos,
      linkAdicionado: !!linkUrl,
    });
  } catch (err: any) {
    console.error('[admin anexar] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) {
      try {
        msg = JSON.parse(err.body).message ?? msg;
      } catch {}
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
