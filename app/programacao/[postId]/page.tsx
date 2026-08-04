import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  getHorarioDoProjeto,
  getPostComDetalhes,
} from '@/lib/notion';
import { extractDriveFolderId, extractDriveFileId, listFolderFiles } from '@/lib/drive';
import { lerConfigProgramacao } from '@/lib/supabase';
import type { PreviewArquivo } from '@/app/post/[id]/PostPreview';
import { ConfigProgramacao } from './ConfigProgramacao';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Converte o "Time" do projeto (texto livre no Notion: "12h", "6H55", "10h30",
 *  "9", "12:00") em "HH:MM". Retorna null se não der pra entender. */
function parseHorario(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /(\d{1,2})\s*(?:[h:]\s*(\d{1,2}))?/i.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = m[2] != null ? Number(m[2]) : 0;
  if (h > 23 || mm > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Subtrai `min` minutos de um horário "HH:MM", com wrap no dia (23:57 etc). */
function menosMinutos(hhmm: string, min: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const total = (Number(m[1]) * 60 + Number(m[2]) - min + 1440) % 1440;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

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

  // Horário padrão vem da propriedade "Time" do projeto no Notion (texto livre
  // tipo "12h") — 5 min de antecedência. Projeto sem "Time" (ou não parseável)
  // cai no padrão 10:00 -> 09:55.
  const timeProjeto = post.projetoId ? await getHorarioDoProjeto(post.projetoId) : null;
  const horarioBase = parseHorario(timeProjeto) ?? '10:00';
  const horarioDefault = menosMinutos(horarioBase, 5);

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
      horarioDefault={horarioDefault}
    />
  );
}
