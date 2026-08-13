import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth';
import {
  getPostComDetalhes,
  getTarefaComPost,
  findTarefaClienteProntaDoPost,
  lerComentariosDoPost,
  listarTarefasDoPost,
  type MaterialBloco,
  type RelacaoItem,
} from '@/lib/notion';
import {
  extractDriveFolderId,
  extractDriveFileId,
  listFolderFiles,
  type DriveFileResumido,
} from '@/lib/drive';
import { env } from '@/lib/env';
import { PostPreview, type PreviewArquivo } from './PostPreview';
import { AprovacaoSimples } from './AprovacaoSimples';
import { TarefasDoPostPanel } from './TarefasDoPostPanel';
import { PostSidebarLud } from './PostSidebarLud';
import { TarefaForm } from '../../tarefa/[id]/form';
import { HistoricoBox } from '../../_components/HistoricoBox';

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
  const comentarios = await lerComentariosDoPost(postId);
  return <HistoricoBox comentarios={comentarios} />;
}

/** Painel admin de Tarefas do post — visível só pra equipe interna. */
async function TarefasDoPostSection({ postId }: { postId: string }) {
  const tarefas = await listarTarefasDoPost(postId);
  return <TarefasDoPostPanel tarefas={tarefas} />;
}

function diffDias(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function PostDetalhePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tarefa?: string; from?: string; vista?: string };
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
  const voltarPara = searchParams.from ? `/etapa/${searchParams.from}` : '/';

  // Vista Cliente/Lud. — cliente só vê a dele. Admin/colab default = interno.
  const podeVerInterno = ehAdmin || ehColaborador;
  const vista: 'cliente' | 'interno' = !podeVerInterno
    ? 'cliente'
    : searchParams.vista === 'cliente'
      ? 'cliente'
      : 'interno';

  // Preserva os outros params ao trocar de vista.
  function urlVista(v: 'cliente' | 'interno'): string {
    const params = new URLSearchParams();
    if (searchParams.tarefa) params.set('tarefa', searchParams.tarefa);
    if (searchParams.from) params.set('from', searchParams.from);
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

  // Resolve arquivos do Drive: se for pasta, lista o conteúdo; se for arquivo, monta um item.
  const arquivos: PreviewArquivo[] = [];
  for (const link of post.driveLinks) {
    const folderId = extractDriveFolderId(link.url);
    if (folderId) {
      try {
        const files = await listFolderFiles(folderId);
        for (const f of files) {
          if (f.isFolder) continue;
          arquivos.push(f);
        }
      } catch (err: any) {
        console.warn('[post] erro listando pasta do Drive:', err?.message);
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
      continue;
    }
    // arquivo direto (Notion CDN, etc) — usa o url como id
    arquivos.push({
      id: link.url,
      name: link.name,
      mimeType: '',
      webViewLink: link.url,
      thumbnailLink: null,
      isFolder: false,
    });
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

  const dias = diffDias(tarefaPrazo);
  const prazoLabel =
    !tarefaPrazo
      ? null
      : dias === null
      ? fmtData(tarefaPrazo)
      : dias < 0
      ? `Era pra ${fmtData(tarefaPrazo)}`
      : dias === 0
      ? 'Hoje'
      : dias === 1
      ? 'Amanhã'
      : `Em ${dias} dias`;

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

            {arquivos.length > 0 ? (
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
            ) : (
              (post.ideiaDoPost || post.bodyCompleto || post.legenda) && (
                <div className="card p-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                    Ideia do post
                  </div>
                  <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
                    {post.ideiaDoPost ?? post.bodyCompleto ?? post.legenda}
                  </p>
                </div>
              )
            )}

            {/* Etapa PAUTA: mostra info + materiais que a gente vai precisar
                (leitura) → LOGO ABAIXO caixa de aprovação (comentário
                responde as perguntas) → e depois o card opcional pra
                adiantar materiais. Só o Aprovar/Pedir alteração fecha
                a tarefa; adiantar materiais não. */}
            {modo === 'aprovacao' && ehEtapaPauta(tarefaTitulo) && tarefaId && (
              <>
                <SecoesInfoEMateriais
                  informacoesNecessarias={post.informacoesNecessarias}
                  materiaisNecessarios={post.materiaisNecessarios}
                />
                <AprovacaoSimples
                  tarefaId={tarefaId}
                  tarefaTitulo={tarefaTitulo ?? 'Aprovação'}
                  voltarPara={voltarPara}
                  aprovacaoColaborativa={post.aprovacaoColaborativa}
                />
                <div className="card border-dashed p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[16px]" aria-hidden>📎</span>
                    <div>
                      <div className="text-[13px] font-semibold text-ink">
                        Já quer adiantar materiais? (opcional)
                      </div>
                      <div className="text-[11px] text-t2">
                        Cole aqui arquivos, texto ou link. Aprovar a pauta acima
                        é o que finaliza essa etapa.
                      </div>
                    </div>
                  </div>
                  <TarefaForm
                    tarefaId={tarefaId}
                    voltarPara={voltarPara}
                    naoFinalizarTarefa
                    mostrarTexto
                    aceitarLink
                    aceitarComentario={false}
                    permitirGravarVoz
                    tituloUpload="Fotos, vídeos e áudios"
                    ajudaUpload="Anexe quantas fotos e vídeos quiser (cada um até 450 MB). Áudios também — ou grava uma mensagem de voz aqui embaixo."
                    textoBotao="📎 Anexar materiais"
                  />
                </div>
              </>
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
                      tituloUpload: 'Outros arquivos (opcional)',
                      ajudaUpload: roteiroParaGravacao
                        ? 'Fotos, vídeos e outros áudios sem limite de quantidade. A gravação do voice over feita acima já está incluída.'
                        : 'Anexe quantas fotos e vídeos quiser (cada um até 450 MB). Áudios também — ou grava uma mensagem de voz aqui embaixo.',
                      textoBotao: 'Enviar materiais',
                      textoVoiceOver: roteiroParaGravacao || undefined,
                    }
                  : sub === 'stories'
                    ? {
                        mostrarTexto: true,
                        aceitarLink: true,
                        permitirGravarVoz: true,
                        tituloUpload: 'Fotos e vídeos pros stories',
                        ajudaUpload:
                          'Anexe quantas artes e arquivos quiser. Áudios e mensagens de voz também.',
                        textoBotao: 'Enviar direcionamento',
                      }
                    : sub === 'previas'
                      ? {
                          mostrarTexto: true,
                          aceitarLink: true,
                          permitirGravarVoz: true,
                          tituloUpload: 'Fotos, vídeos e áudios',
                          ajudaUpload:
                            'Sem limite de quantidade — cada arquivo até 450 MB. Pode gravar um áudio aqui também.',
                          textoBotao: 'Enviar informações',
                        }
                      : {};
              return (
                <TarefaForm tarefaId={tarefaId} voltarPara={voltarPara} {...props} />
              );
            })()}

            {ehAdmin && (
              <Suspense
                fallback={<div className="h-[120px] rounded-2xl bg-bgSoft animate-pulse" />}
              >
                <TarefasDoPostSection postId={post.id} />
              </Suspense>
            )}

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

  return (
    <div className="min-h-screen pb-32">
      {/* HEADER — unificado + toggle de vista pra Lud. */}
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="min-w-0">
            <Link
              href={voltarPara}
              className="text-[11px] text-mauve transition hover:text-ink"
            >
              ← Voltar
            </Link>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                {post.projetoNome}
              </span>
              <span className="text-[10px] text-t3">·</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
                {etapaLabel}
              </span>
            </div>
          </div>
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
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-5">
        {/* Título + meta-bar horizontal (data, prazo, formato) */}
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.03em] text-ink">
            {post.titulo}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            <FormatoPill formatoTipo={formatoTipoDetectado} qtd={arquivos.length} />
            <MetaChip label="Data" value={fmtData(post.data)} />
            {prazoLabel && (
              <MetaChip
                label="Prazo"
                value={prazoLabel}
                urgent={dias !== null && dias <= 0}
              />
            )}
            {post.formato.length > 0 && (
              <MetaChipRelacao label="Formato" itens={post.formato} />
            )}
            {post.funil.length > 0 && (
              <MetaChipRelacao label="Funil" itens={post.funil} />
            )}
            {post.objetivo.length > 0 && (
              <MetaChipRelacao label="Objetivo" itens={post.objetivo} />
            )}
          </div>
        </div>

        {/* GRID PRINCIPAL: preview à esquerda + sidebar Lud. à direita. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0 space-y-5">
            {/* Preview em modo readonly — aprovação/comentários ficam
                na sidebar Lud. (não faz sentido a equipe usar o painel
                que é do cliente). */}
            {arquivos.length > 0 ? (
              <PostPreview
                arquivos={arquivos}
                formatoTipo={formatoTipoDetectado}
                postId={post.id}
                tarefaId={null}
                tarefaTitulo={tarefaTitulo ?? 'Aprovação'}
                legenda={post.legenda}
                voltarPara={voltarPara}
                aprovacaoColaborativa={post.aprovacaoColaborativa}
              />
            ) : (
              (post.ideiaDoPost || post.bodyCompleto || post.legenda) && (
                <div className="card p-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                    Ideia do post
                  </div>
                  <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
                    {post.ideiaDoPost ?? post.bodyCompleto ?? post.legenda}
                  </p>
                </div>
              )
            )}

            {/* Formulários/ações do cliente (aprovação simples, materiais,
                voice over) NÃO renderizam na visão Lud. — a equipe interna
                não faz essas ações. Vira lugar do preview + sidebar. */}
          </div>

          {/* SIDEBAR LUD. — programar, comentários geral+interno, tarefas */}
          <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
            <PostSidebarLud
              postId={post.id}
              tarefaId={tarefaId}
              status={post.status}
              bloqueadoProgramar={bloqueadoProgramar}
            />
            {ehAdmin && (
              <Suspense
                fallback={
                  <div className="h-[120px] rounded-2xl bg-bgSoft animate-pulse" />
                }
              >
                <TarefasDoPostSection postId={post.id} />
              </Suspense>
            )}
          </aside>
        </div>

        {/* histórico de comentários — discreto, no fim da página */}
        <Suspense fallback={null}>
          <HistoricoComentarios postId={post.id} />
        </Suspense>
      </main>
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
      className={`rounded-2xl p-3 flex items-center justify-between ${
        urgent
          ? 'bg-hubRed text-white'
          : 'card'
      }`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
          urgent ? 'text-white/70' : 'text-t3'
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-[12px] ${
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
