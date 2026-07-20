import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  getPostComDetalhes,
} from '@/lib/notion';
import { extractDriveFolderId, listFolderFiles } from '@/lib/drive';
import { lerConfigProgramacao } from '@/lib/supabase';
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

  // Primeira thumb do Drive (pra preview do arquivo no form)
  let thumbFileId: string | null = null;
  for (const link of post.driveLinks ?? []) {
    const folderId = extractDriveFolderId(link.url);
    if (!folderId) continue;
    try {
      const files = await listFolderFiles(folderId);
      const imagem = files.find(
        (f) => !f.isFolder && (f.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name)),
      );
      if (imagem) { thumbFileId = imagem.id; break; }
      const primeiro = files.find((f) => !f.isFolder);
      if (primeiro) { thumbFileId = primeiro.id; break; }
    } catch {
      /* pula essa pasta */
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
      thumbFileId={thumbFileId}
      configInicial={config}
    />
  );
}
