import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getPostComDetalhes, listColaboradores, listarTarefasDoPost } from '@/lib/notion';
import { extractDriveFileId, extractDriveFolderId, listFolderFiles } from '@/lib/drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Preview enxuto de um post pra renderizar num modal/popup rápido na página
 * de aprovações. Não é a página inteira — só o essencial pra decidir se
 * aprova direto ou precisa abrir a página completa.
 *
 * GET /api/post/[id]/preview → { titulo, legenda, formatoTipo, arquivos: [...] }
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const post = await getPostComDetalhes(params.id);
  if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 });

  // Permissão: admin bypassa; cliente só vê posts dos próprios projetos.
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (
    !ehAdmin &&
    (!post.projetoId || !session.projetoIds.includes(post.projetoId))
  ) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  // Resolve arquivos (igual ao fluxo da página do post)
  type Arquivo = {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
  };
  const arquivos: Arquivo[] = [];
  for (const link of post.driveLinks) {
    const folderId = extractDriveFolderId(link.url);
    if (folderId) {
      try {
        const files = await listFolderFiles(folderId);
        for (const f of files) {
          if (f.isFolder) continue;
          arquivos.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType ?? '',
            webViewLink: f.webViewLink,
          });
        }
      } catch {
        /* pula pasta com erro */
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
      });
    }
  }

  // Tarefas internas só pra admin.
  const [brutas, colaboradores] = ehAdmin
    ? await Promise.all([
        listarTarefasDoPost(post.id).catch(() => []),
        listColaboradores().catch(() => []),
      ])
    : [[], []];
  const tarefas = brutas.map((t) => ({
    ...t,
    aberta: t.aberta && !t.finalizada,
    pessoa: t.pessoaNome,
  }));
  // Responsável (Notion user) → página do colaborador.
  const colaboradorPorPessoa: Record<string, string> = {};
  for (const c of colaboradores) if (c.pessoaUserId) colaboradorPorPessoa[c.pessoaUserId] = c.id;

  return NextResponse.json({
    titulo: post.titulo,
    legenda: post.legenda ?? '',
    formatoTipo: post.formatoTipo,
    dataPostagem: post.data,
    formato:
      post.formato.map((f) => f.name).join(', ') ||
      ({ post: 'Carrossel', reels: 'Reels', story: 'Stories', desconhecido: '' } as const)[post.formatoTipo],
    status: post.status,
    arquivos,
    tarefas,
    colaboradores: colaboradorPorPessoa,
  });
}
