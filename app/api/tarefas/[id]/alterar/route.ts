import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  adicionarLinkDriveAoPost,
  pedirAlteracao,
  getTarefaComPost,
  invalidarCachesAposMudanca,
} from '@/lib/notion';
import { ensurePostFolder, uploadFile } from '@/lib/drive';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Cliente pede alteração na aprovação. Aceita 2 formatos:
 *  - JSON  { comentario }                — modo antigo, sem arquivo
 *  - FormData { comentario, arquivos[] } — modo novo, permite anexar
 *    fotos/vídeos que ele quer trocar (sobe pro Drive do post).
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
    let arquivos: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      comentario = ((form.get('comentario') as string | null) ?? '').trim();
      arquivos = form
        .getAll('arquivos')
        .filter(
          (f): f is File => f instanceof File && f.size > 0,
        );
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        comentario?: string;
      };
      comentario = (body.comentario ?? '').trim();
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

    // Sobe os arquivos anexados (fotos/vídeos que o cliente quer trocar)
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

    // Cabeçalho do comentário sinaliza os anexos pra equipe encontrar
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
