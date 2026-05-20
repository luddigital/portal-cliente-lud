import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPostComDetalhes, lerComentariosDoPost } from '@/lib/notion';
import {
  extractDriveFolderId,
  extractDriveFileId,
  listFolderFiles,
} from '@/lib/drive';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Arquivo = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink: string | null;
  isFolder: boolean;
};

/**
 * Detalhe de um post pro admin (usado no modal da página de entrega).
 * Devolve formato, legenda, link do Drive e os arquivos de arte resolvidos.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
    if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    const post = await getPostComDetalhes(params.id);
    if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 });

    const arquivos: Arquivo[] = [];
    for (const link of post.driveLinks) {
      const folderId = extractDriveFolderId(link.url);
      if (folderId) {
        try {
          const files = await listFolderFiles(folderId);
          for (const f of files) if (!f.isFolder) arquivos.push(f);
        } catch (err: any) {
          console.warn('[admin/post] erro listando pasta Drive:', err?.message);
        }
        continue;
      }
      const fileId = extractDriveFileId(link.url);
      arquivos.push({
        id: fileId ?? link.url,
        name: link.name,
        mimeType: '',
        webViewLink: link.url,
        thumbnailLink: null,
        isFolder: false,
      });
    }

    // Infere Reels/Stories pelo nome dos arquivos quando o formato é genérico.
    let formatoTipo = post.formatoTipo;
    if (formatoTipo === 'desconhecido' || formatoTipo === 'post') {
      const nomes = arquivos.map((a) => a.name.toLowerCase()).join(' ');
      if (/(^|[^a-z])reels?([^a-z]|$)/.test(nomes)) formatoTipo = 'reels';
      else if (/(^|[^a-z])stor(y|ies|ie)([^a-z]|$)/.test(nomes)) formatoTipo = 'story';
    }

    const comentarios = await lerComentariosDoPost(params.id);

    return NextResponse.json({
      titulo: post.titulo,
      data: post.data,
      formatoTipo,
      formatoNomes: post.formato.map((f) => f.name),
      funil: post.funil.map((f) => f.name),
      objetivo: post.objetivo.map((o) => o.name),
      ideiaDoPost: post.ideiaDoPost,
      legenda: post.legenda,
      driveLinks: post.driveLinks,
      arquivos,
      comentarios,
    });
  } catch (err: any) {
    console.error('[admin/post] erro:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro inesperado' }, { status: 500 });
  }
}
