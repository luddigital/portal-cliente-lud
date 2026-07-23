import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  getPostComDetalhes,
} from '@/lib/notion';
import { extractDriveFolderId, extractDriveFileId, listFolderFiles } from '@/lib/drive';
import { lerConfigProgramacao } from '@/lib/supabase';
import type { PreviewArquivo } from '@/app/post/[id]/PostPreview';
import { ConfigProgramacao } from './ConfigProgramacao';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function ProgramarPostPage({
  params,
}: {
  params: { postId: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  const postId = params.postId?.trim();
  if (!postId) notFound();

  const [post, config] = await Promise.all([
    getPostComDetalhes(postId),
    lerConfigProgramacao(postId),
  ]);
  if (!post) notFound();

  // Todos os arquivos do Drive (pra mostrar o post inteiro no preview,
  // igual o cliente vê na aprovação)
  const arquivos: PreviewArquivo[] = [];
  for (const link of post.driveLinks ?? []) {
    const folderId = extractDriveFolderId(link.url);
    if (folderId) {
      try {
        const files = await listFolderFiles(folderId);
        for (const f of files) {
          if (!f.isFolder) arquivos.push(f);
        }
      } catch {
        /* pula essa pasta */
      }
      continue;
    }
    const fileId = extractDriveFileId(link.url);
    if (fileId) {
      arquivos.push({
        id: fileId,
        name: link.name,
        mimeType: '',
        webViewLink: link.url,
        thumbnailLink: null,
        isFolder: false,
      });
    }
  }

  return (
    <ConfigProgramacao
      postId={post.id}
      titulo={post.titulo}
      dataPostagem={post.data ?? ''}
      projetoNome={post.projetoNome}
      formatoTipo={post.formatoTipo}
      legendaOriginal={post.legenda ?? ''}
      arquivos={arquivos}
      configInicial={config}
    />
  );
}
