import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  adicionarLinkDriveAoPost,
  pedirAlteracao,
  getTarefaComPost,
  invalidarCachesAposMudanca,
} from '@/lib/notion';
import { ensurePostFolder } from '@/lib/drive';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Cliente pede alteração na aprovação. Aceita 2 formatos:
 *  - JSON  { comentario, arquivosCount?, driveLink? } — modo padrão.
 *    Se veio com arquivosCount > 0, o /anexar já subiu os arquivos,
 *    só falta registrar o link no post + fechar a tarefa.
 *  - FormData { comentario, arquivos[] } — modo legado (fallback).
 *    Mantido pra não quebrar clientes antigos ou casos com 1 arquivo pequeno.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const contentType = req.headers.get('content-type') ?? '';
    let comentario = '';
    let arquivosPreEnviados = 0;
    let driveLinkPreEnviado: string | null = null;
    let arquivosFormData: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      comentario = ((form.get('comentario') as string | null) ?? '').trim();
      arquivosFormData = form
        .getAll('arquivos')
        .filter((f): f is File => f instanceof File && f.size > 0);
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        comentario?: string;
        arquivosCount?: number;
        driveLink?: string;
      };
      comentario = (body.comentario ?? '').trim();
      arquivosPreEnviados = Math.max(0, Number(body.arquivosCount ?? 0));
      driveLinkPreEnviado = body.driveLink ?? null;
    }

    if (comentario.length < 3) {
      return NextResponse.json(
        { error: 'Conta o que precisa ajustar (mínimo 3 caracteres).' },
        { status: 400 },
      );
    }

    const data = await getTarefaComPost(params.id);
    if (!data)
      return NextResponse.json(
        { error: 'tarefa não encontrada' },
        { status: 404 },
      );
    const t = data.tarefa;
    const ehAdmin = env.auth.adminEmails.includes(
      session.email.trim().toLowerCase(),
    );
    if (
      !ehAdmin &&
      (!t.projetoId || !session.projetoIds.includes(t.projetoId))
    ) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    // Modo legado: subir arquivos aqui mesmo (só chega se cliente antigo).
    let driveLink: string | null = driveLinkPreEnviado;
    let totalArquivos = arquivosPreEnviados;
    if (arquivosFormData.length > 0) {
      const { uploadFile } = await import('@/lib/drive');
      const folder = await ensurePostFolder({
        cliente: t.projetoNome,
        postTitulo: t.postTitulo,
        dataPostagem: t.postData,
      });
      driveLink = folder.webViewLink;
      for (const file of arquivosFormData) {
        const buf = Buffer.from(await file.arrayBuffer());
        await uploadFile({
          folderId: folder.folderId,
          name: file.name,
          mimeType: file.type,
          buffer: buf,
        });
        totalArquivos++;
      }
    }

    // Se veio pré-enviado sem link, resolve a pasta (idempotente).
    if (totalArquivos > 0 && !driveLink) {
      const folder = await ensurePostFolder({
        cliente: t.projetoNome,
        postTitulo: t.postTitulo,
        dataPostagem: t.postData,
      });
      driveLink = folder.webViewLink;
    }

    if (totalArquivos > 0 && driveLink) {
      try {
        await adicionarLinkDriveAoPost(
          t.postId,
          `Alteração pedida pelo cliente — ${t.postTitulo}`,
          driveLink,
        );
      } catch (err: any) {
        console.warn(
          '[alterar] falhou adicionar link do Drive:',
          err?.message,
        );
      }
    }

    const partes: string[] = [];
    if (totalArquivos > 0 && driveLink) {
      partes.push(
        `📎 ${totalArquivos} arquivo${totalArquivos > 1 ? 's' : ''} anexado${totalArquivos > 1 ? 's' : ''} no Drive: ${driveLink}`,
      );
      partes.push('');
    }
    partes.push(comentario);

    await pedirAlteracao(params.id, partes.join('\n'));
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, arquivos: totalArquivos, driveLink });
  } catch (err: any) {
    console.error('[alterar] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) {
      try {
        msg = JSON.parse(err.body).message ?? msg;
      } catch {}
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
