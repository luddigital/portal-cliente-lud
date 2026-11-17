import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { lerSecoesDoPost, lerCopyDoPost, lerInfoDoPostEsteira, getHorarioDoProjeto, getPostComDetalhes, getProjetoNome, lerComentariosDoPost, listColaboradores, listarTarefasDoPost } from '@/lib/notion';
import { lerHistoricoComunicacao } from '@/lib/supabase';
import { notasDoPost, tarefasClienteDoHistorico } from '@/lib/historico-post';
import { compararNoFluxo } from '@/lib/etapas-projeto';
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

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  // Tarefas, equipe e comentários só precisam do id: saem junto com o post
  // (antes era tudo em fila, um depois do outro). Tarefas internas só pra admin.
  type Extras = [
    Awaited<ReturnType<typeof listarTarefasDoPost>>,
    Awaited<ReturnType<typeof listColaboradores>>,
    Awaited<ReturnType<typeof lerComentariosDoPost>>,
  ];
  const extrasP: Promise<Extras> = ehAdmin
    ? Promise.all([
        listarTarefasDoPost(params.id).catch(() => []),
        listColaboradores().catch(() => []),
        lerComentariosDoPost(params.id).catch(() => []),
      ])
    : Promise.resolve([[], [], []] as Extras);

  const post = await getPostComDetalhes(params.id);
  if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 });

  // Permissão: admin bypassa; cliente só vê posts dos próprios projetos.
  if (
    !ehAdmin &&
    (!post.projetoId || !session.projetoIds.includes(post.projetoId))
  ) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  // Resolve arquivos (igual ao fluxo da página do post), todas as pastas ao mesmo tempo.
  type Arquivo = {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
  };
  const arquivosDoLink = async (link: { name: string; url: string }): Promise<Arquivo[]> => {
    const folderId = extractDriveFolderId(link.url);
    if (folderId) {
      try {
        const files = await listFolderFiles(folderId);
        return files
          .filter((f) => !f.isFolder)
          .map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType ?? '', webViewLink: f.webViewLink }));
      } catch {
        return []; // pula pasta com erro
      }
    }
    const fileId = extractDriveFileId(link.url);
    return fileId ? [{ id: fileId, name: link.name, mimeType: '', webViewLink: link.url }] : [];
  };

  const historicoVazio = { visualizacoes: [], envios: [] };
  // Nome do projeto e horário saem junto (antes eram buscados só no fim, depois de tudo).
  const projetoP = post.projetoId
    ? Promise.all([getProjetoNome(post.projetoId).catch(() => null), getHorarioDoProjeto(post.projetoId).catch(() => null)])
    : Promise.resolve([null, null] as const);
  // Briefing e copy (só equipe): mesmos blocos da página completa, em versão curta no popup.
  const briefingP = ehAdmin
    ? Promise.all([lerInfoDoPostEsteira(params.id).catch(() => null), lerCopyDoPost(params.id).catch(() => null)])
    : Promise.resolve([null, null] as const);
  // Todas as seções da página do Notion (só equipe): o popup mostra tudo, sem "ver mais".
  const secoesP = ehAdmin ? lerSecoesDoPost(params.id).catch(() => []) : Promise.resolve([]);
  const [listas, historico, [brutas, colaboradores, comentarios], [projetoNome, hora], [info, copy], secoes] = await Promise.all([
    Promise.all(post.driveLinks.map(arquivosDoLink)),
    ehAdmin ? lerHistoricoComunicacao(post.id).catch(() => historicoVazio) : Promise.resolve(historicoVazio),
    extrasP,
    projetoP,
    briefingP,
    secoesP,
  ]);
  const arquivos: Arquivo[] = listas.flat();
  // Histórico resumido do popup: mesma montagem da página do post.
  const equipe = new Set([
    ...env.auth.adminEmails,
    ...colaboradores.map((c) => (c.email ?? '').trim().toLowerCase()).filter(Boolean),
  ]);
  const notas = ehAdmin ? notasDoPost({ comentarios, equipe, tarefas: brutas, envios: historico.envios }) : [];
  const tarefasCliente = ehAdmin ? tarefasClienteDoHistorico(brutas) : [];
  const tarefas = brutas.map((t) => ({
    ...t,
    aberta: t.aberta && !t.finalizada,
    pessoa: t.pessoaNome,
  }));
  // Responsável (Notion user) → página do colaborador.
  const colaboradorPorPessoa: Record<string, string> = {};
  for (const c of colaboradores) if (c.pessoaUserId) colaboradorPorPessoa[c.pessoaUserId] = c.id;

  // Nome do projeto e horário de postagem (sempre de Brasília) pra prévia.
  return NextResponse.json({
    titulo: post.titulo,
    projetoNome: projetoNome ?? undefined,
    hora,
    legenda: post.legenda ?? '',
    formatoTipo: post.formatoTipo,
    dataPostagem: post.data,
    formato:
      post.formato.map((f) => f.name).join(', ') ||
      ({ post: 'Carrossel', reels: 'Reels', story: 'Stories', desconhecido: '' } as const)[post.formatoTipo],
    // Etapa como no Notion: primeira tarefa aberta na Ordem ("Alteração | Arte");
    // sem tarefa aberta, a fórmula Status Geral ou o Status do post.
    status:
      tarefas.filter((t) => t.aberta).sort((a, b) => compararNoFluxo(a as any, b as any))[0]?.titulo ??
      post.statusGeral ??
      post.status,
    arquivos,
    tarefas,
    colaboradores: colaboradorPorPessoa,
    historico: ehAdmin ? historico : null,
    notas,
    tarefasCliente,
    ideia: info?.ideia ?? null,
    briefing: info?.briefing ?? null,
    roteiro: copy?.voice ?? null,
    cards: copy?.carrossel ?? null,
    secoes,
  });
}
