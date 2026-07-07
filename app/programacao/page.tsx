import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  getPostComDetalhes,
  listAllProjetos,
  listPostsDoMes,
} from '@/lib/notion';
import { extractDriveFolderId, listFolderFiles } from '@/lib/drive';
import { classificarProjeto } from '@/lib/projetoServico';
import { ProgramacaoView } from './ProgramacaoView';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SERVICOS_SOCIAL = new Set(['Instagram', 'TikTok', 'Stories']);

/** Pega o fileId da primeira imagem do post (via Drive folder link). */
async function primeiraThumbnail(postId: string): Promise<string | null> {
  try {
    const detail = await getPostComDetalhes(postId);
    if (!detail?.driveLinks?.length) return null;
    for (const link of detail.driveLinks) {
      const folderId = extractDriveFolderId(link.url);
      if (!folderId) continue;
      const files = await listFolderFiles(folderId);
      const imagem = files.find(
        (f) => !f.isFolder && (f.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name)),
      );
      if (imagem) return imagem.id;
      const primeiro = files.find((f) => !f.isFolder);
      if (primeiro) return primeiro.id;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: { projetoId?: string; year?: string; month?: string };
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

  const projetos = (await listAllProjetos()).filter((p) =>
    SERVICOS_SOCIAL.has(classificarProjeto(p.nome)),
  );
  if (projetos.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-[18px] font-semibold text-ink">
          Nenhum projeto de social media ativo
        </h1>
        <p className="mt-2 text-[13px] text-t2">
          A programação só cobre projetos de Instagram, TikTok e Stories.
        </p>
      </main>
    );
  }

  const projetoIdSelecionado =
    (searchParams.projetoId?.trim() && projetos.find((p) => p.id === searchParams.projetoId!.trim())?.id) ||
    projetos[0].id;

  const hoje = new Date();
  const year = parseInt(searchParams.year ?? '', 10) || hoje.getFullYear();
  const month = parseInt(searchParams.month ?? '', 10) || hoje.getMonth() + 1;

  const posts = await listPostsDoMes([projetoIdSelecionado], year, month);

  // Batch fetch de thumbnails — 1 Drive folder lookup por post, em paralelo.
  // Cada chamada é cached por post; recarregar a mesma página é instantâneo.
  const thumbEntries = await Promise.all(
    posts.map(async (p) => [p.id, await primeiraThumbnail(p.id)] as const),
  );
  const thumbnails: Record<string, string | null> = Object.fromEntries(thumbEntries);

  return (
    <ProgramacaoView
      projetos={projetos}
      projetoIdSelecionado={projetoIdSelecionado}
      year={year}
      month={month}
      posts={posts}
      thumbnails={thumbnails}
    />
  );
}
