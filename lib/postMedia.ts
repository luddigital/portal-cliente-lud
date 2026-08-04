import {
  type DriveFileResumido,
  extractDriveFileId,
  extractDriveFolderId,
  listFolderFiles,
} from './drive';
import { getPostComDetalhes } from './notion';
import { urlMidiaPublica } from './midiaPublica';

/**
 * Resolve a arte de um post (arquivos no Drive) em mídia pronta pra publicar
 * no Instagram: lista os arquivos em ordem, classifica imagem/vídeo, decide o
 * formato (IMAGE única / CAROUSEL / REELS) e gera URLs públicas assinadas —
 * porque a Meta baixa a mídia de uma URL pública.
 */

export type MidiaTipo = 'image' | 'video';
export type FormatoIG = 'IMAGE' | 'CAROUSEL' | 'REELS';

export type MidiaItem = {
  fileId: string;
  nome: string;
  tipo: MidiaTipo;
  url: string;
};

export type PostMidia = {
  formato: FormatoIG;
  itens: MidiaItem[];
  legenda: string;
};

const RE_IMAGEM = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;
const RE_VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv)$/i;

function ehImagemOuVideo(f: DriveFileResumido): boolean {
  const mt = (f.mimeType || '').toLowerCase();
  if (mt.startsWith('image/') || mt.startsWith('video/')) return true;
  return RE_IMAGEM.test(f.name) || RE_VIDEO.test(f.name);
}

function tipoDoArquivo(f: DriveFileResumido): MidiaTipo {
  const mt = (f.mimeType || '').toLowerCase();
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('image/')) return 'image';
  if (RE_VIDEO.test(f.name)) return 'video';
  return 'image';
}

export async function resolverMidiaDoPost(
  postId: string,
): Promise<PostMidia | { erro: string }> {
  const detail = await getPostComDetalhes(postId);
  if (!detail) return { erro: 'post não encontrado' };

  // Junta todos os arquivos das pastas/links de Drive do post.
  const arquivos: DriveFileResumido[] = [];
  for (const link of detail.driveLinks ?? []) {
    const folderId = extractDriveFolderId(link.url);
    if (folderId) {
      try {
        const files = await listFolderFiles(folderId);
        for (const f of files) if (!f.isFolder) arquivos.push(f);
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

  // Só imagem/vídeo, ordenados por nome (é a ordem do carrossel — usa ordenação
  // numérica pra "2" vir antes de "10").
  const midia = arquivos
    .filter(ehImagemOuVideo)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));

  if (midia.length === 0) {
    return { erro: 'nenhuma imagem ou vídeo encontrado na arte do post' };
  }

  const itens: MidiaItem[] = await Promise.all(
    midia.map(async (f) => ({
      fileId: f.id,
      nome: f.name,
      tipo: tipoDoArquivo(f),
      url: await urlMidiaPublica(f.id),
    })),
  );

  // Decide o formato pro Instagram.
  const temVideo = itens.some((i) => i.tipo === 'video');
  let formato: FormatoIG;
  if (detail.formatoTipo === 'reels' || (temVideo && itens.length === 1)) {
    formato = 'REELS';
  } else if (itens.length > 1) {
    formato = 'CAROUSEL';
  } else {
    formato = 'IMAGE';
  }

  return { formato, itens, legenda: detail.legenda ?? '' };
}
