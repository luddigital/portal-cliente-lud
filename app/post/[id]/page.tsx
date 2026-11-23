import { notFound, redirect } from 'next/navigation';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth';
import {
  getPostComDetalhes,
  getTarefaComPost,
  findTarefaClienteProntaDoPost,
  lerComentariosDoPost,
  listColaboradores,
  listarTarefasDoPost,
  listPostsDoMes,
  getHorarioDoProjeto,
  type MaterialBloco,
  type RelacaoItem,
} from '@/lib/notion';
import {
  extractDriveFolderId,
  extractDriveFileId,
  listFolderFiles,
  listarMateriaisDoPost,
  type DriveFileResumido,
} from '@/lib/drive';
import { env } from '@/lib/env';
import { compararNoFluxo, ehTarefaDoCliente } from '@/lib/etapas-projeto';
import { statusPrazo } from '@/lib/prazoStatus';
import {
  lerConfigProgramacao,
  lerHistoricoComunicacao,
  lerHistoricoPrazos,
  registrarVisualizacao,
  type MudancaPrazo,
} from '@/lib/supabase';
import { PostPreview, type PreviewArquivo } from './PostPreview';
import { AprovacaoSimples } from './AprovacaoSimples';
import { EtapaPautaCards } from './EtapaPautaCards';
import { GaleriaMateriais } from './GaleriaMateriais';
import { PreviaPostModal } from '@/app/admin/aprovacoes/PreviaPostModal';
import {
  StatusDoPostChips,
  TodasTarefasCard,
  ComunicacaoCard,
  type ComentarioCliente,
} from './PostSidebarLud';
import { ComentariosLud } from './ComentariosLud';
import { AgoraEtapa, BotaoConcluirEtapa, CaixaProgramacao, type VizinhoFeed } from './NovoLud';
import { horaCurta } from './horaCurta';
import { SolicitarAlteracao } from './SolicitarAlteracao';
import { BotaoAtualizar } from '@/app/admin/_components/BotaoAtualizar';
import { notasDoPost, tarefasClienteDoHistorico } from '@/lib/historico-post';
import { BotaoLembreteWpp } from '@/app/admin/aprovacoes/BotaoLembreteWpp';
import { TarefaForm } from '../../tarefa/[id]/form';
import { HistoricoBox } from '../../_components/HistoricoBox';
import { Trilha } from '@/app/admin/_components/Trilha';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';

export const dynamic = 'force-dynamic';

/** Define o que o cliente pode fazer no post conforme a tarefa atual. */
function modoDoPost(titulo: string | null): 'aprovacao' | 'material' | 'leitura' {
  if (!titulo) return 'leitura';
  const t = titulo.toLowerCase();
  if (t.startsWith('aprovação') || t.startsWith('aprovacao')) return 'aprovacao';
  if (
    t.includes('materia') ||
    t.includes('conteúdo') ||
    t.includes('conteudo') ||
    t.includes('stories') ||
    t.includes('direcionamento') ||
    t.includes('prévi') ||
    t.includes('previa')
  ) {
    return 'material';
  }
  return 'aprovacao';
}

/**
 * Detecta o subtipo dentro do modo "material" pra decidir copy do form:
 *  - 'materiais'    → só upload (info já veio nos Conteúdos Prévios)
 *  - 'previas'      → upload + texto (informações iniciais do post)
 *  - 'stories'      → upload + texto (direcionamento dos stories)
 *  - 'outro'        → upload + texto (default conservador)
 */
function subtipoMaterial(titulo: string | null): 'materiais' | 'previas' | 'stories' | 'outro' {
  if (!titulo) return 'outro';
  const t = titulo.toLowerCase();
  if (t.includes('stories') || t.includes('direcionamento')) return 'stories';
  if (t.includes('prévi') || t.includes('previa') || t.includes('conteúdo') || t.includes('conteudo')) return 'previas';
  if (t.includes('materia')) return 'materiais';
  return 'outro';
}

/** É a etapa de aprovação de PAUTA (não da arte final)?
 *  Detecta títulos tipo "Pauta", "Aprovação | Pauta", "Aprovar pauta". */
function ehEtapaPauta(titulo: string | null): boolean {
  if (!titulo) return false;
  return /\bpauta\b/i.test(titulo);
}

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

/** Histórico de comentários do post — discreto, no fim da página. */
async function HistoricoComentarios({ postId }: { postId: string }) {
  // Nota interna da equipe nunca aparece aqui.
  const comentarios = (await lerComentariosDoPost(postId)).filter((c) => !c.texto.trim().startsWith('🔒'));
  return <HistoricoBox comentarios={comentarios} />;
}


/**
 * Comentários que vieram do cliente pelo portal (o portal grava no Notion com
 * prefixos fixos). Comentário da equipe fica de fora.
 */
function comentariosDoCliente(
  lista: { texto: string; criadoEm: string }[],
  equipe: Set<string>,
): ComentarioCliente[] {
  const out: ComentarioCliente[] = [];
  const corpo = (t: string) => t.split(/\n\s*\n/).slice(1).join(' ').trim();
  for (const c of lista) {
    const t = c.texto.trim();
    const m = t.match(/^💬\s*(\S+@\S+)\s*\n+([\s\S]*)$/);
    if (m) {
      const email = m[1].toLowerCase();
      if (equipe.has(email) || email.endsWith('@lud.digital')) continue;
      out.push({ quando: c.criadoEm, tipo: 'comentou', autor: email, trecho: m[2].trim() });
    } else if (/— aprovado pelo cliente/.test(t)) {
      out.push({ quando: c.criadoEm, tipo: 'aprovou', autor: null, trecho: corpo(t) });
    } else if (/— alteração solicitada pelo cliente/.test(t)) {
      out.push({ quando: c.criadoEm, tipo: 'alteracao', autor: null, trecho: corpo(t) });
    } else if (/— recebida do cliente/.test(t)) {
      out.push({ quando: c.criadoEm, tipo: 'enviou', autor: null, trecho: '' });
    }
  }
  return out;
}

function diffDias(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

/** Pasta do Drive vira a lista de arquivos dela; arquivo solto vira um item. */
async function resolverArquivosDoDrive(
  links: { name: string; url: string }[],
): Promise<PreviewArquivo[]> {
  // Todas as pastas ao mesmo tempo (antes era uma depois da outra), na ordem dos links.
  const listas = await Promise.all(
    links.map(async (link): Promise<PreviewArquivo[]> => {
      const folderId = extractDriveFolderId(link.url);
      if (folderId) {
        try {
          return (await listFolderFiles(folderId)).filter((f) => !f.isFolder);
        } catch (err: any) {
          console.warn('[post] erro listando pasta do Drive:', err?.message);
          return [];
        }
      }
      const fileId = extractDriveFileId(link.url);
      return [
        {
          id: fileId ?? link.url,
          name: link.name,
          mimeType: '',
          webViewLink: link.url,
          thumbnailLink: null,
          isFolder: false,
        },
      ];
    }),
  );
  return listas.flat();
}

export default async function PostDetalhePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tarefa?: string; from?: string; vista?: string; voltar?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  const ehColaborador = !!session.colaboradorId;

  // Dispara post + (tarefa por query, se houver) em paralelo. Quando vem do
  // /etapa/[stage] no portal cliente, sempre tem ?tarefa= — então a maioria
  // dos casos sai com 1 round-trip ao invés de 2.
  const [post, tarefaDoQuery] = await Promise.all([
    getPostComDetalhes(params.id),
    searchParams.tarefa
      ? getTarefaComPost(searchParams.tarefa)
      : Promise.resolve(null),
  ]);

  if (!post) notFound();
  if (
    !post.projetoId ||
    (!ehAdmin && !ehColaborador && !session.projetoIds.includes(post.projetoId))
  ) {
    notFound();
  }

  // Vista Cliente/Lud. — cliente só vê a dele. Admin/colab default = interno.
  const podeVerInterno = ehAdmin || ehColaborador;
  const vista: 'cliente' | 'interno' = !podeVerInterno
    ? 'cliente'
    : searchParams.vista === 'cliente'
      ? 'cliente'
      : 'interno';

  // Visão Lud.: a página é só o cabeçalho + a prévia (que busca os próprios dados, guardados).
  // Sai já, sem ler tarefas, Drive e histórico aqui (antes lia tudo isso e não usava).
  // (String(): o resto da função continua tipado pras duas vistas.)
  if (String(vista) === 'interno') {
    const voltarLud =
      typeof searchParams.voltar === 'string' && /^\/(?![\/\\])/.test(searchParams.voltar) ? searchParams.voltar : null;
    const voltarParaLud = voltarLud ?? (ehAdmin ? (post.projetoId ? `/admin/projetos/${post.projetoId}` : '/admin') : '/');
    const p = new URLSearchParams();
    if (searchParams.tarefa) p.set('tarefa', searchParams.tarefa);
    if (searchParams.from) p.set('from', searchParams.from);
    if (voltarLud) p.set('voltar', voltarLud);
    p.set('vista', 'cliente');
    return (
      <div className="min-h-screen pb-32">
        <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
          <div className="mx-auto flex max-w-3xl lg:max-w-7xl items-center justify-between gap-3 px-6 py-3">
            <Link href={voltarParaLud} className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink">
              ← Voltar
            </Link>
            <div className="flex items-center gap-3">
              {ehAdmin && <BotaoAtualizar variante="compacto" />}
              <div className="flex items-center gap-1 rounded-full bg-bgSoft p-1">
                <Link
                  href={`?${p.toString()}`}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold text-t3 transition hover:text-ink"
                >
                  Visão cliente
                </Link>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-ink shadow-sm">Visão Lud.</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">{post.projetoNome}</div>
            </div>
          </div>
        </header>
        <PreviaPostModal postId={post.id} tarefaId={searchParams.tarefa ?? null} pagina />
      </div>
    );
  }

  // O que não depende da tarefa sai já, junto com a detecção da tarefa
  // (antes ia em fila: tarefa → sidebar → Drive). Cada busca tem o próprio
  // catch: a promessa fica esperando enquanto a tarefa é lida.
  const historicoVazio = { visualizacoes: [], envios: [] };
  const extrasP = Promise.all([
    listarTarefasDoPost(post.id).catch(() => []),
    lerConfigProgramacao(post.id).catch(() => ({
      data: '',
      horario: '',
      plataformas: [],
      formato: '',
      legenda: '',
      atualizadoEm: null,
      atualizadoPor: null,
    })),
    vista === 'interno'
      ? lerHistoricoComunicacao(post.id).catch(() => historicoVazio)
      : Promise.resolve(historicoVazio),
    vista === 'interno' ? lerHistoricoPrazos(post.id).catch(() => [] as MudancaPrazo[]) : Promise.resolve([] as MudancaPrazo[]),
    vista === 'interno' ? listColaboradores().catch(() => []) : Promise.resolve([]),
    vista === 'interno' ? lerComentariosDoPost(post.id).catch(() => []) : Promise.resolve([]),
  ]);
  const arquivosP = resolverArquivosDoDrive(post.driveLinks).catch(() => [] as PreviewArquivo[]);

  // Carrega a tarefa específica que originou esse fluxo (se vier no query).
  // Se não vier, auto-detecta a tarefa cliente pendente desse post.
  let tarefaTitulo: string | null = null;
  let tarefaPrazo: string | null = null;
  let tarefaId: string | null = null;
  if (tarefaDoQuery && tarefaDoQuery.tarefa.postId === post.id) {
    tarefaId = tarefaDoQuery.tarefa.tarefaId;
    tarefaTitulo = tarefaDoQuery.tarefa.tarefaTitulo;
    tarefaPrazo = tarefaDoQuery.tarefa.tarefaPrazo;
  } else if (!searchParams.tarefa) {
    // Auto-detecta a tarefa cliente do post. Pro admin, se não houver tarefa
    // "pronta", aceita qualquer tarefa cliente aberta (pra sempre conseguir agir).
    let auto = await findTarefaClienteProntaDoPost(post.id);
    if (!auto && ehAdmin) {
      auto = await findTarefaClienteProntaDoPost(post.id, { exigirPronto: false });
    }
    if (auto) {
      const t = await getTarefaComPost(auto.tarefaId);
      if (t && t.tarefa.postId === post.id) {
        tarefaId = t.tarefa.tarefaId;
        tarefaTitulo = t.tarefa.tarefaTitulo;
        tarefaPrazo = t.tarefa.tarefaPrazo;
      }
    }
  }

  const isStory = post.formatoTipo === 'story';
  const etapaLabel = tarefaTitulo ?? (isStory ? 'Direcionamento de Stories' : 'Aprovação');
  const modo = modoDoPost(tarefaTitulo);
  // `voltar` vem do popup (página do projeto, aprovações…); só caminho interno.
  const voltarInterno =
    typeof searchParams.voltar === 'string' && /^\/(?![\/\\])/.test(searchParams.voltar)
      ? searchParams.voltar
      : null;
  // Sem ?voltar, o admin sobe na hierarquia (o projeto do post); /etapa é área do cliente.
  const voltarPara =
    voltarInterno ??
    (ehAdmin
      ? post.projetoId
        ? `/admin/projetos/${post.projetoId}`
        : '/admin'
      : searchParams.from
        ? `/etapa/${searchParams.from}`
        : '/');

  // Cliente só vê o post quando ele está liberado pra ele: tem uma tarefa do
  // cliente aberta e pronta (Aprovação, Materiais…) ou o post já foi postado.
  // Antes disso o post ainda está com a equipe e comentário ali não chega em ninguém.
  if (!podeVerInterno) {
    const liberadaPraCliente =
      post.status === 'Postado' || !!(await findTarefaClienteProntaDoPost(post.id).catch(() => null));
    if (!liberadaPraCliente) {
      return (
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="text-[40px]" aria-hidden="true">
            🛠️
          </span>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Esse post ainda está com a gente</h1>
          <p className="text-[14.5px] leading-relaxed text-t2">
            A equipe ainda está produzindo. Quando ele estiver pronto pra você ver, a gente avisa no grupo do WhatsApp.
          </p>
          <a href={voltarPara} className="rounded-full bg-ink px-5 py-2 text-[13.5px] font-bold text-white hover:opacity-90">
            Voltar
          </a>
        </main>
      );
    }
    await registrarVisualizacao(post.id, tarefaId, session.email);
  }

  // Preserva os outros params ao trocar de vista.
  function urlVista(v: 'cliente' | 'interno'): string {
    const params = new URLSearchParams();
    if (searchParams.tarefa) params.set('tarefa', searchParams.tarefa);
    if (searchParams.from) params.set('from', searchParams.from);
    if (voltarInterno) params.set('voltar', voltarInterno);
    params.set('vista', v);
    return `?${params.toString()}`;
  }

  // Programar só faz sentido se a arte já foi aprovada. Bloqueia se a
  // tarefa atual ainda é de aprovação/alteração.
  const statusLower = (post.status ?? '').toLowerCase();
  const bloqueadoProgramar =
    statusLower.includes('aprova') ||
    statusLower.includes('altera') ||
    statusLower.includes('arte') ||
    statusLower.includes('copy') ||
    statusLower.includes('briefing') ||
    statusLower.includes('curador') ||
    modo === 'material';

  // Dados extras da sidebar Lud. (já buscando desde o começo, em extrasP).
  const [tarefasDoPost, configProgramacao, historico, historicoPrazos, colaboradores, comentariosDoPost] = await extrasP;
  const emailsDaEquipe = new Set([
    ...env.auth.adminEmails,
    ...colaboradores.map((c) => (c.email ?? '').trim().toLowerCase()).filter(Boolean),
  ]);
  const comentariosCliente = comentariosDoCliente(comentariosDoPost, emailsDaEquipe);
  // Responsável da tarefa (Notion user) → página do colaborador.
  const colaboradorPorPessoa: Record<string, string> = {};
  for (const c of colaboradores) if (c.pessoaUserId) colaboradorPorPessoa[c.pessoaUserId] = c.id;

  // Arte (campo "Link do Google Drive") e materiais do cliente ficam separados:
  // a aprovação só mostra a arte; materiais aparecem na galeria.
  const precisaMateriais = modo === 'material' || vista === 'interno';
  const [arquivos, materiaisDosLinks, materiaisDaPasta] = await Promise.all([
    arquivosP,
    precisaMateriais ? resolverArquivosDoDrive(post.materiaisLinks) : Promise.resolve([]),
    precisaMateriais
      ? listarMateriaisDoPost({
          cliente: post.projetoNome,
          postTitulo: post.titulo,
          dataPostagem: post.data,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const materiais: PreviewArquivo[] = [];
  for (const m of [...materiaisDaPasta, ...materiaisDosLinks]) {
    if (!materiais.some((x) => x.id === m.id)) materiais.push(m);
  }

  // Fallback: enquanto o banco Formato do Notion não estiver compartilhado com a integration,
  // tenta inferir Reels/Story pelo padrão dos nomes de arquivo (ex: "sm_reels_*", "*_story_*").
  let formatoTipoDetectado = post.formatoTipo;
  if (formatoTipoDetectado === 'desconhecido' || formatoTipoDetectado === 'post') {
    const nomes = arquivos.map((a) => a.name.toLowerCase()).join(' ');
    if (/(^|[^a-z])reels?([^a-z]|$)/.test(nomes)) {
      formatoTipoDetectado = 'reels';
    } else if (/(^|[^a-z])stor(y|ies|ie)([^a-z]|$)/.test(nomes)) {
      formatoTipoDetectado = 'story';
    }
  }

  // Sem arte ainda, o que importa é o andamento: tarefas sobem pro topo.
  const semArte = modo !== 'material' && arquivos.length === 0;
  const cardTarefas = (
    <TodasTarefasCard
      tarefas={tarefasDoPost}
      colaboradores={ehAdmin ? colaboradorPorPessoa : {}}
      historico={historicoPrazos}
      podeEditarPrazo={ehAdmin}
      linkAdmin={ehAdmin}
    />
  );

  // Cliente pediu alteração → Luiza decide se é arte, copy ou as duas.
  const pedidoAlteracao = tarefasDoPost.find(
    (t) => t.titulo.trim() === 'Alteração | Post' && t.aberta && !t.finalizada,
  );
  const responsavelDe = (titulo: string) =>
    tarefasDoPost.filter((t) => t.titulo.trim() === titulo).find((t) => t.pessoaNome)?.pessoaNome ?? null;
  const painelAlteracao = ehAdmin ? (
    <SolicitarAlteracao
      postId={post.id}
      pedido={pedidoAlteracao ? { tarefaId: pedidoAlteracao.tarefaId, prazo: pedidoAlteracao.prazo } : null}
      comentarios={comentariosCliente}
      responsaveis={{ arte: responsavelDe('Arte'), copy: responsavelDe('Briefing & Copy') }}
    />
  ) : null;

  const dias = diffDias(tarefaPrazo);
  const spPrazo = tarefaPrazo ? statusPrazo({ dataEntrega: tarefaPrazo }) : null;
  const prazoLabel = spPrazo ? spPrazo.label : null;

  // ==========================================================================
  // VISÃO CLIENTE — layout ORIGINAL preservado. Não mudar.
  // Cliente vê essa página exatamente como antes. Admin/colab que abre
  // ?vista=cliente pra preview também cai aqui + ganha uma pill flutuante
  // discreta pra voltar pra visão Lud.
  // ==========================================================================
  if (vista === 'cliente') {
    return (
      <>
        <div className="min-h-screen pb-32 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:pb-0">
          <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white lg:shrink-0">
            <div className="mx-auto flex max-w-3xl lg:max-w-7xl items-center justify-between px-6 py-4 lg:py-2.5">
              <Link
                href="/"
                className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink"
              >
                ← Voltar
              </Link>
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                {post.projetoNome}
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-3xl lg:max-w-7xl px-6 py-8 space-y-6 lg:h-[calc(100dvh_-_49px)] lg:overflow-y-auto lg:py-4 lg:space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--cal-aprovacao-soft)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                {etapaLabel}
              </span>
              <FormatoPill formatoTipo={formatoTipoDetectado} qtd={arquivos.length} />
            </div>

            <h1 className="text-[22px] sm:text-[28px] lg:text-[20px] font-semibold tracking-[-0.03em] text-ink">{post.titulo}</h1>

            <div className="grid gap-2 text-[13px] sm:grid-cols-2">
              <InfoCard label="Data de postagem" value={fmtData(post.data)} />
              {prazoLabel && (
                <InfoCard
                  label="Prazo de aprovação"
                  value={prazoLabel}
                  urgent={dias !== null && dias <= 0}
                />
              )}
            </div>

            {(post.formato.length > 0 || post.funil.length > 0 || post.objetivo.length > 0) && (
              <dl className="card divide-y divide-[rgba(21,21,33,0.06)] overflow-hidden">
                {post.formato.length > 0 && <DetalheRow label="Formato" itens={post.formato} />}
                {post.funil.length > 0 && <DetalheRow label="Funil" itens={post.funil} />}
                {post.objetivo.length > 0 && <DetalheRow label="Objetivo" itens={post.objetivo} />}
              </dl>
            )}

            {(modo === 'material' ? materiais.length : arquivos.length) > 0 ? (
              modo === 'material' ? (
                // Fase de matéria-prima: mostra em GALERIA (não carrossel),
                // porque esses arquivos são o que o cliente enviou pra equipe
                // usar, não a arte pronta pra aprovação.
                <GaleriaMateriais
                  arquivos={materiais}
                  titulo="Materiais que você já enviou"
                  legenda="A equipe da Lud. vai usar esses arquivos pra produzir o post. Continue enviando mais abaixo se precisar."
                />
              ) : (
                <div>
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                    Pré-visualização
                  </div>
                  <PostPreview
                    arquivos={arquivos}
                    formatoTipo={formatoTipoDetectado}
                    postId={post.id}
                    tarefaId={modo === 'aprovacao' ? tarefaId : null}
                    tarefaTitulo={tarefaTitulo ?? 'Aprovação'}
                    legenda={post.legenda}
                    voltarPara={voltarPara}
                    aprovacaoColaborativa={post.aprovacaoColaborativa}
                  />
                </div>
              )
            ) : (
              post.ideiaDoPost && (
                <div className="card p-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                    Ideia do post
                  </div>
                  <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
                    {post.ideiaDoPost}
                  </p>
                </div>
              )
            )}

            {/* Não é a vez do cliente nesse post: sem tarefa aberta pra ele,
                a caixa de aprovação/comentário não aparece. Em vez de ficar
                mudo, explica que não precisa enviar nada agora. */}
            {!tarefaId && modo !== 'material' && (
              <div className="card !bg-[var(--cal-aprovacao-soft)] p-5">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-[18px] leading-none" aria-hidden>
                    ⏳
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold leading-snug text-ink">
                      Nada pra aprovar aqui por enquanto
                    </div>
                    <p className="mt-1.5 text-[13px] leading-[1.6] text-t2">
                      Este post ainda não está numa etapa de aprovação de vocês.
                      Não precisa enviar nada agora — quando for a sua vez de
                      aprovar ou pedir ajuste, os botões aparecem aqui
                      automaticamente. 🙌
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Etapa PAUTA: mostra info + materiais que a gente vai precisar
                (leitura) → LOGO ABAIXO caixa de aprovação (comentário
                responde as perguntas) → e depois o card opcional pra
                adiantar materiais. Só o Aprovar/Pedir alteração fecha
                a tarefa; adiantar materiais não. */}
            {modo === 'aprovacao' && ehEtapaPauta(tarefaTitulo) && tarefaId && (
              <EtapaPautaCards
                tarefaId={tarefaId}
                tarefaTitulo={tarefaTitulo ?? 'Aprovação'}
                voltarPara={voltarPara}
                aprovacaoColaborativa={post.aprovacaoColaborativa}
                informacoesNecessarias={post.informacoesNecessarias}
                materiaisNecessarios={post.materiaisNecessarios}
              />
            )}

            {modo === 'aprovacao' &&
              !ehEtapaPauta(tarefaTitulo) &&
              arquivos.length === 0 &&
              tarefaId && (
                <AprovacaoSimples
                  tarefaId={tarefaId}
                  tarefaTitulo={tarefaTitulo ?? 'Aprovação'}
                  voltarPara={voltarPara}
                  aprovacaoColaborativa={post.aprovacaoColaborativa}
                />
              )}

            {modo === 'material' &&
              subtipoMaterial(tarefaTitulo) === 'previas' &&
              post.informacoesNecessarias &&
              post.informacoesNecessarias.length > 0 && (
                <div className="space-y-3">
                  {post.informacoesNecessarias.map((m, i) => (
                    <div key={i} className="card p-5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 text-[18px] leading-none" aria-hidden>📣</span>
                        <div>
                          <div className="text-[14px] font-semibold leading-snug text-ink">
                            {m.cabecalho || 'Informações que precisamos pra esse post'}
                          </div>
                        </div>
                      </div>
                      {m.detalhes.length > 0 && (
                        <div className="mt-3 space-y-1.5 pl-7">
                          {m.detalhes.map((d, j) => (
                            <p key={j} className="whitespace-pre-line text-[13px] leading-[1.6] text-t1">{d}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            {modo === 'material' &&
              subtipoMaterial(tarefaTitulo) === 'materiais' &&
              post.materiaisNecessarios &&
              post.materiaisNecessarios.length > 0 && (
                <section>
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                    O que precisamos de você
                  </div>
                  <div className="space-y-3">
                    {post.materiaisNecessarios
                      .filter((m) => m.detalhes.length > 0)
                      .map((m, i) => (
                        <div key={i} className="card p-5">
                          {m.cabecalho && (
                            <div className="flex items-start gap-2.5">
                              <span className="mt-0.5 text-[18px] leading-none" aria-hidden>📝</span>
                              <div className="text-[14px] font-semibold leading-snug text-ink">
                                {m.cabecalho}
                              </div>
                            </div>
                          )}
                          <div className={`space-y-2 ${m.cabecalho ? 'mt-3 pl-7' : ''}`}>
                            {m.detalhes.map((d, j) => (
                              <p key={j} className="whitespace-pre-line text-[13px] leading-[1.6] text-t1">{d}</p>
                            ))}
                          </div>
                        </div>
                      ))}

                    {post.materiaisNecessarios.filter((m) => m.detalhes.length === 0).length > 0 && (
                      <div className="card p-5">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 text-[18px] leading-none" aria-hidden>🎬</span>
                          <div>
                            <div className="text-[14px] font-semibold text-ink">
                              Materiais que precisamos
                            </div>
                            <ul className="mt-2 space-y-1.5">
                              {post.materiaisNecessarios
                                .filter((m) => m.detalhes.length === 0)
                                .map((m, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-t1">
                                    <span className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full bg-t3" />
                                    <span>{m.cabecalho}</span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

            {modo === 'material' && tarefaId && (() => {
              const sub = subtipoMaterial(tarefaTitulo);
              const ehListaDeMateriais = (cab: string) => {
                const c = cab.toLowerCase();
                return /materia|fotos|vídeos|videos|kit|equipamento/.test(c);
              };
              const ehLinhaDeLista = (linha: string) => {
                const t = linha.trim();
                return /^[→•▸▪►⮕\-–]\s/.test(t);
              };
              const roteiroParaGravacao =
                sub === 'materiais' && post.materiaisNecessarios
                  ? post.materiaisNecessarios
                      .filter((m) => !ehListaDeMateriais(m.cabecalho ?? ''))
                      .flatMap((m) => m.detalhes)
                      .filter((d) => d.trim() && !ehLinhaDeLista(d))
                      .join('\n\n')
                      .trim()
                  : '';
              const props =
                sub === 'materiais'
                  ? {
                      mostrarTexto: false,
                      aceitarComentario: true,
                      aceitarLink: true,
                      permitirGravarVoz: !roteiroParaGravacao,
                      tituloUpload: roteiroParaGravacao ? 'Fotos e vídeos' : 'Fotos, vídeos e áudios',
                      ajudaUpload: roteiroParaGravacao
                        ? 'Quantos arquivos quiser. A gravação do voice over lá de cima já vai junto.'
                        : 'Quantos arquivos quiser. Também dá pra gravar uma mensagem de voz aqui.',
                      textoBotao: 'Enviar materiais',
                      textoVoiceOver: roteiroParaGravacao || undefined,
                    }
                  : sub === 'stories'
                    ? {
                        mostrarTexto: true,
                        aceitarLink: true,
                        permitirGravarVoz: true,
                        tituloUpload: 'Fotos e vídeos pros stories',
                        ajudaUpload: 'Quantos arquivos quiser, inclusive áudios e mensagens de voz.',
                        textoBotao: 'Enviar direcionamento',
                      }
                    : sub === 'previas'
                      ? {
                          mostrarTexto: true,
                          aceitarLink: true,
                          permitirGravarVoz: true,
                          tituloUpload: 'Fotos, vídeos e áudios',
                          ajudaUpload: 'Quantos arquivos quiser. Também dá pra gravar um áudio aqui.',
                          textoBotao: 'Enviar informações',
                        }
                      : {};
              return (
                <TarefaForm tarefaId={tarefaId} voltarPara={voltarPara} {...props} />
              );
            })()}

            <Suspense fallback={null}>
              <HistoricoComentarios postId={post.id} />
            </Suspense>
          </main>
        </div>

        {/* Pill flutuante discreta — só admin/colab que preview'ou como
            cliente vê esse botão. Cliente comum não vê nada. */}
        {podeVerInterno && (
          <Link
            href={urlVista('interno')}
            className="fixed bottom-4 right-4 z-30 rounded-full bg-ink px-4 py-2 text-[11px] font-semibold text-white shadow-lg transition hover:opacity-90"
          >
            ← Visão Lud.
          </Link>
        )}
      </>
    );
  }

  // ==========================================================================
  // VISÃO LUD. — mesma estrutura da vista cliente (coluna única), com cards
  // internos empilhados no fluxo: Status + Programar / Tarefas / Comentários.
  // Nada de grid 2 col ou sidebar sticky — parte do layout do cliente.
  // ==========================================================================
  const abertasNaOrdem = tarefasDoPost
    .filter((x) => x.aberta && !x.finalizada)
    .sort((a, b) => compararNoFluxo(a as any, b as any));
  const tarefaCliente = abertasNaOrdem.find((x) => ehTarefaDoCliente(x.titulo)) ?? null;
  // Tarefa atual = primeira aberta na Ordem do Notion (é ela que o Status Geral mostra).
  const tarefaAtual = abertasNaOrdem[0] ?? null;
  const prazoAtual = tarefaAtual?.prazo ?? null;
  const diasAtual = diffDias(prazoAtual);
  // Botão pro cliente só quando a vez é do cliente (ou de enviar pra ele).
  const vezDoCliente =
    !!tarefaCliente &&
    !!tarefaAtual &&
    (ehTarefaDoCliente(tarefaAtual.titulo) || /enviar post/i.test(tarefaAtual.titulo));
  // A tarefa atual vem da lista de tarefas (atualiza em segundos); a fórmula
  // "Status Geral" vem da página do post, que fica em cache por alguns minutos.
  const statusGeral = tarefaAtual?.titulo ?? post.statusGeral ?? null;

  // Histórico do post (mesma montagem do popup de prévia): comentários, alterações e envios.
  const notasDoHistorico = notasDoPost({
    comentarios: comentariosDoPost,
    equipe: emailsDaEquipe,
    tarefas: tarefasDoPost,
    envios: historico.envios,
  });
  const tarefasClienteHistorico = tarefasClienteDoHistorico(tarefasDoPost);

  // Alteração pronta e a nova aprovação esperando o cliente → reenviar.
  const reaprovacao =
    tarefaAtual && tarefaAtual.ordemUm === '03' && ehTarefaDoCliente(tarefaAtual.titulo) ? tarefaAtual : null;
  const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);
  const maisRecente = (lista: typeof tarefasDoPost) =>
    [...lista].sort((a, b) => ms(b.finalizadaEm) - ms(a.finalizadaEm))[0] ?? null;
  const ultimaAlteracao = reaprovacao
    ? maisRecente(
        tarefasDoPost.filter(
          (t) => /^altera[çc][ãa]o\s*\|/i.test(t.titulo.trim()) && !/\|\s*post/i.test(t.titulo) && t.status === 'Concluído',
        ),
      )
    : null;
  const ultimaAprovacaoInterna = ultimaAlteracao
    ? maisRecente(
        tarefasDoPost.filter(
          (t) =>
            t.ordemUm === '03' &&
            t.status === 'Concluído' &&
            t.titulo.trim() === ultimaAlteracao.titulo.trim().replace(/^altera[çc][ãa]o/i, 'Aprovação'),
        ),
      )
    : null;
  const marcoAlteracao = ultimaAprovacaoInterna?.finalizadaEm ?? ultimaAlteracao?.finalizadaEm ?? '';
  const reenvio = reaprovacao
    ? historico.envios
        .filter((e) => ms(e.enviadoEm) >= ms(marcoAlteracao))
        .sort((a, b) => ms(b.enviadoEm) - ms(a.enviadoEm))[0] ?? null
    : null;

  // Programação (opção 6): posts vizinhos do projeto no feed e o horário de Brasília.
  const dataProg = (configProgramacao.data || post.data || '').slice(0, 10) || null;
  const [vizinhosRaw, horarioProjeto] = await Promise.all([
    // Só os posts deste projeto, mês do post e os dois vizinhos (rápido e com cache).
    dataProg && post.projetoId
      ? Promise.all(
          [-1, 0, 1].map((k) => {
            const [y, m] = dataProg.split('-').map(Number);
            const d = new Date(Date.UTC(y, m - 1 + k, 15));
            return listPostsDoMes([post.projetoId!], d.getUTCFullYear(), d.getUTCMonth() + 1).catch(() => []);
          }),
        ).then((ls) => ls.flat())
      : Promise.resolve([]),
    post.projetoId ? getHorarioDoProjeto(post.projetoId).catch(() => null) : Promise.resolve(null),
  ]);
  const semTracoId = (x: string) => x.replace(/-/g, '');
  const feedProg: VizinhoFeed[] = vizinhosRaw
    .filter((v) => v.projetoId && post.projetoId && semTracoId(v.projetoId) === semTracoId(post.projetoId) && v.data)
    .map((v) => ({ id: v.id, titulo: v.titulo, data: v.data.slice(0, 10), esteAqui: semTracoId(v.id) === semTracoId(post.id) }))
    .sort((a, b) => b.data.localeCompare(a.data));
  if (dataProg && !feedProg.some((v) => v.esteAqui)) {
    feedProg.push({ id: post.id, titulo: post.titulo, data: dataProg, esteAqui: true });
    feedProg.sort((a, b) => b.data.localeCompare(a.data));
  }
  const statusProg = (post.status ?? '').toLowerCase();
  const situacaoProg: 'programado' | 'postado' | 'nao' = /postad|publicad/.test(statusProg)
    ? 'postado'
    : /agendad|programad/.test(statusProg)
      ? 'programado'
      : 'nao';

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl lg:max-w-7xl items-center justify-between gap-3 px-6 py-3">
          <Link
            href={voltarPara}
            className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink"
          >
            ← Voltar
          </Link>
          <div className="flex items-center gap-3">
            {ehAdmin && <BotaoAtualizar variante="compacto" />}
            {podeVerInterno && (
              <div className="flex items-center gap-1 rounded-full bg-bgSoft p-1">
                <Link
                  href={urlVista('cliente')}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold text-t3 transition hover:text-ink"
                >
                  Visão cliente
                </Link>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-ink shadow-sm">
                  Visão Lud.
                </span>
              </div>
            )}
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              {post.projetoNome}
            </div>
          </div>
        </div>
      </header>

      {/* Visão Lud.: o mesmo conteúdo da prévia (popup), em tamanho de página. */}
      <PreviaPostModal postId={post.id} tarefaId={searchParams.tarefa ?? null} pagina />
    </div>
  );
}

function quandoFoi(iso: string | null | undefined): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}

/** Alteração feita e aprovada por dentro; falta mandar a nova versão pro cliente. */
function CardAlteracaoConcluida({
  alteracao,
  aprovacaoInterna,
  reenvio,
  botao,
}: {
  alteracao: { titulo: string; pessoaNome: string | null; finalizadaEm: string | null } | null;
  aprovacaoInterna: { titulo: string; pessoaNome: string | null; finalizadaEm: string | null } | null;
  reenvio: string | null;
  botao: React.ReactNode;
}) {
  const linha = (rotulo: string, t: { pessoaNome: string | null; finalizadaEm: string | null }) =>
    [rotulo, t.pessoaNome?.split(' ')[0], quandoFoi(t.finalizadaEm)].filter(Boolean).join(' · ');
  return (
    <section className="card !bg-[var(--prazo-em-dia-soft)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--prazo-em-dia)]">
            Alteração concluída ✓
          </h2>
          <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-t2">
            {alteracao && <li>{linha(alteracao.titulo, alteracao)}</li>}
            {aprovacaoInterna && <li>{linha('Aprovada por dentro', aprovacaoInterna)}</li>}
            <li className={reenvio ? 'text-t2' : 'font-semibold text-ink'}>
              {reenvio
                ? `Reaprovação enviada pro cliente · ${quandoFoi(reenvio)}`
                : 'Falta mandar a nova versão pro cliente aprovar.'}
            </li>
          </ul>
        </div>
        <div className="shrink-0">{botao}</div>
      </div>
    </section>
  );
}

function DadoCabecalho({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-t3 lg:text-[10px]">{rotulo}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink lg:mt-0.5 lg:text-[16px]">{valor}</div>
    </div>
  );
}

/** Prazo de aprovação em destaque: vermelho (hoje/atrasado), laranja (1–2 dias), escuro (folga). */
function CardPrazo({
  dias,
  prazo,
  botao,
  rotulo = 'Prazo de aprovação',
  detalheExtra = null,
}: {
  dias: number | null;
  prazo: string;
  botao: React.ReactNode;
  rotulo?: string;
  detalheExtra?: string | null;
}) {
  const sp = statusPrazo({ dataEntrega: prazo });
  const fundo = sp.cor;
  const grande = `${sp.emoji} ${sp.texto}`;
  const detalhe =
    dias !== null && dias < 0
      ? `venceu ${fmtData(prazo)} · há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
      : dias !== null && dias > 1
        ? `até ${fmtData(prazo)}`
        : null;
  return (
    <div
      className="flex flex-col justify-between gap-4 rounded-[28px] px-7 py-6 text-white lg:flex-row lg:items-center lg:gap-3 lg:rounded-2xl lg:px-5 lg:py-3.5"
      style={{ background: fundo, color: '#fff' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] lg:text-[10px]">
          <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="truncate">{rotulo}</span>
        </div>
        <div className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.03em] lg:mt-1 lg:text-[20px]">{grande}</div>
        {(detalhe || detalheExtra) && (
          <div className="mt-1.5 text-[12.5px] opacity-85 lg:mt-1 lg:text-[11.5px]">
            {[detalhe, detalheExtra].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {botao && <div className="lg:shrink-0" style={{ color: fundo }}>{botao}</div>}
    </div>
  );
}

function InfoCard({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 flex items-center justify-between gap-3 ${
        urgent
          ? 'bg-hubRed text-white'
          : 'card'
      }`}
    >
      <span
        className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] ${
          urgent ? 'text-white/70' : 'text-t3'
        }`}
      >
        {label}
      </span>
      <span
        className={`min-w-0 text-right font-mono text-[12px] ${
          urgent ? 'text-white font-semibold' : 'text-t1'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function DetalheRow({ label, itens }: { label: string; itens: RelacaoItem[] }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <dt className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center gap-2">
        {itens.map((it) => (
          <span
            key={it.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(21,21,33,0.04)] px-2.5 py-1 text-[12px] text-ink"
          >
            {it.icon &&
              (it.icon.startsWith('http') ? (
                <Image
                  src={it.icon}
                  alt={it.name}
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 rounded-sm object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-[13px] leading-none">{it.icon}</span>
              ))}
            {it.name}
          </span>
        ))}
      </dd>
    </div>
  );
}

function MetaChip({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
        urgent
          ? 'bg-hubRed text-white'
          : 'bg-[rgba(21,21,33,0.04)] text-ink'
      }`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
          urgent ? 'text-white/80' : 'text-t3'
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-[11px] ${
          urgent ? 'font-semibold' : 'text-t1'
        }`}
      >
        {value}
      </span>
    </span>
  );
}

function MetaChipRelacao({ label, itens }: { label: string; itens: RelacaoItem[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-[rgba(21,21,33,0.04)] px-2.5 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </span>
      {itens.map((it) => (
        <span key={it.id} className="inline-flex items-center gap-1 text-[11px] text-ink">
          {it.icon &&
            (it.icon.startsWith('http') ? (
              <Image
                src={it.icon}
                alt={it.name}
                width={12}
                height={12}
                className="h-3 w-3 rounded-sm object-contain"
                unoptimized
              />
            ) : (
              <span className="text-[11px] leading-none">{it.icon}</span>
            ))}
          {it.name}
        </span>
      ))}
    </span>
  );
}

const FORMATO_PILL: Record<
  'post' | 'reels' | 'story' | 'desconhecido',
  { label: string; bg: string; color: string }
> = {
  post: { label: 'Carrossel', bg: 'var(--cal-agendado-soft)', color: 'var(--cal-agendado)' },
  reels: { label: 'Reels', bg: 'var(--cal-alteracao-soft)', color: 'var(--cal-alteracao)' },
  story: { label: 'Stories', bg: 'var(--cal-aprovacao-soft)', color: 'var(--cal-aprovacao)' },
  desconhecido: { label: 'Post', bg: 'var(--cal-rascunho-soft)', color: 'var(--cal-rascunho)' },
};

function formatoResumo(
  formatoNotion: RelacaoItem[],
  formatoTipo: 'post' | 'reels' | 'story' | 'desconhecido',
  qtd: number,
): string {
  const nome =
    formatoNotion.length > 0
      ? formatoNotion.map((f) => f.name).join(', ')
      : FORMATO_PILL[formatoTipo].label;
  if (qtd === 0) return nome;
  if (formatoTipo === 'post') return `${nome} · ${qtd} ${qtd === 1 ? 'card' : 'cards'}`;
  if (formatoTipo === 'story') return `${nome} · ${qtd} ${qtd === 1 ? 'tela' : 'telas'}`;
  return nome;
}

function FormatoPill({
  formatoTipo,
  qtd,
}: {
  formatoTipo: 'post' | 'reels' | 'story' | 'desconhecido';
  qtd: number;
}) {
  const info = FORMATO_PILL[formatoTipo];
  const sufixo =
    formatoTipo === 'post'
      ? ` · ${qtd} ${qtd === 1 ? 'card' : 'cards'}`
      : formatoTipo === 'story'
        ? ` · ${qtd} ${qtd === 1 ? 'tela' : 'telas'}`
        : '';
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em]"
      style={{ background: info.bg, color: info.color }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {info.label}
      {sufixo && <span className="font-normal opacity-70">{sufixo}</span>}
    </span>
  );
}

/** Seções "Informações que precisamos" + "Materiais que precisamos" —
 *  usado tanto na etapa de MATERIAIS/PRÉVIAS (padrão) quanto na etapa de
 *  PAUTA (pra o cliente já ver o que a gente vai precisar dele). */
function SecoesInfoEMateriais({
  informacoesNecessarias,
  materiaisNecessarios,
}: {
  informacoesNecessarias: MaterialBloco[] | null;
  materiaisNecessarios: MaterialBloco[] | null;
}) {
  const temInfo = informacoesNecessarias && informacoesNecessarias.length > 0;
  const materiaisComDetalhes = materiaisNecessarios?.filter((m) => m.detalhes.length > 0) ?? [];
  const materiaisSoTitulo = materiaisNecessarios?.filter((m) => m.detalhes.length === 0) ?? [];
  const temMateriais = materiaisComDetalhes.length > 0 || materiaisSoTitulo.length > 0;
  if (!temInfo && !temMateriais) return null;

  return (
    <section>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
        O que precisamos de você
      </div>
      <div className="space-y-3">
        {temInfo &&
          informacoesNecessarias!.map((m, i) => (
            <div key={`info-${i}`} className="card p-5">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[18px] leading-none" aria-hidden>📣</span>
                <div className="text-[14px] font-semibold leading-snug text-ink">
                  {m.cabecalho || 'Informações que precisamos pra esse post'}
                </div>
              </div>
              {m.detalhes.length > 0 && (
                <div className="mt-3 space-y-1.5 pl-7">
                  {m.detalhes.map((d, j) => (
                    <p key={j} className="whitespace-pre-line text-[13px] leading-[1.6] text-t1">
                      {d}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}

        {materiaisComDetalhes.map((m, i) => (
          <div key={`mat-${i}`} className="card p-5">
            {m.cabecalho && (
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[18px] leading-none" aria-hidden>📝</span>
                <div className="text-[14px] font-semibold leading-snug text-ink">
                  {m.cabecalho}
                </div>
              </div>
            )}
            <div className={`space-y-2 ${m.cabecalho ? 'mt-3 pl-7' : ''}`}>
              {m.detalhes.map((d, j) => (
                <p key={j} className="whitespace-pre-line text-[13px] leading-[1.6] text-t1">
                  {d}
                </p>
              ))}
            </div>
          </div>
        ))}

        {materiaisSoTitulo.length > 0 && (
          <div className="card p-5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[18px] leading-none" aria-hidden>🎬</span>
              <div>
                <div className="text-[14px] font-semibold text-ink">
                  Materiais que precisamos
                </div>
                <ul className="mt-2 space-y-1.5">
                  {materiaisSoTitulo.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-t1">
                      <span className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full bg-t3" />
                      <span>{m.cabecalho}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
