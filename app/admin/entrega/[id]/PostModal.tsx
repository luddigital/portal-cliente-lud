'use client';

import { useEffect, useState } from 'react';
import { AcoesTarefa } from './AcoesTarefa';
import { HistoricoBox, type ComentarioItem } from '../../../_components/HistoricoBox';

type Arquivo = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};

type PostDetalhe = {
  titulo: string;
  data: string | null;
  formatoTipo: 'post' | 'reels' | 'story' | 'desconhecido';
  formatoNomes: string[];
  funil: string[];
  objetivo: string[];
  ideiaDoPost: string | null;
  legenda: string | null;
  driveLinks: { name: string; url: string }[];
  arquivos: Arquivo[];
  comentarios: ComentarioItem[];
};

const FORMATO_LABEL: Record<PostDetalhe['formatoTipo'], string> = {
  post: 'Carrossel',
  reels: 'Reels',
  story: 'Stories',
  desconhecido: 'Post',
};

function fmtData(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

/** Detecta se a tarefa é uma aprovação de pauta. */
function ehPauta(titulo: string): boolean {
  return /pauta/i.test(titulo);
}

/** Detecta se a tarefa é de aprovação (tem opção de pedir alteração). */
function ehAprovacao(titulo: string): boolean {
  return /aprova/i.test(titulo);
}

function isVideo(name: string, mime: string): boolean {
  if (mime.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)$/i.test(name);
}

function isImage(name: string, mime: string): boolean {
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(name);
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
      {children}
    </div>
  );
}

/** Propriedades do post em boxes, no topo do painel. */
function InfoBoxes({ data }: { data: PostDetalhe }) {
  const boxes: { label: string; valor: string }[] = [
    { label: 'Formato', valor: FORMATO_LABEL[data.formatoTipo] },
  ];
  const d = fmtData(data.data);
  if (d) boxes.push({ label: 'Data', valor: d });
  if (data.funil.length) boxes.push({ label: 'Funil', valor: data.funil.join(' · ') });
  if (data.objetivo.length) {
    boxes.push({ label: 'Objetivo', valor: data.objetivo.join(' · ') });
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {boxes.map((b) => (
        <div
          key={b.label}
          className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-bgSoft px-3 py-2.5"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            {b.label}
          </div>
          <div className="mt-1 text-[12.5px] font-medium text-ink">{b.valor}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Painel de detalhe do post na página de entrega.
 * As propriedades do post ficam em boxes no topo. O corpo muda conforme a
 * etapa (pauta mostra a ideia; demais mostram arte/Drive/legenda). Tarefas
 * de aprovação têm campo de comentário + aprovar/pedir alteração.
 */
export function PostModal({
  postId,
  tarefaId,
  tarefaTitulo,
  onClose,
}: {
  postId: string;
  tarefaId: string;
  tarefaTitulo: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PostDetalhe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(0);

  const pauta = ehPauta(tarefaTitulo);
  const aprovacao = ehAprovacao(tarefaTitulo);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/admin/post/${postId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
        return json as PostDetalhe;
      })
      .then((json) => {
        if (!cancelado) setData(json);
      })
      .catch((e) => {
        if (!cancelado) setError(e.message);
      });
    return () => {
      cancelado = true;
    };
  }, [postId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const arquivos = data?.arquivos ?? [];
  const arqAtivo = arquivos[ativo];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-[0_8px_40px_rgba(21,21,33,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(21,21,33,0.08)] px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              {tarefaTitulo}
            </div>
            <div className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
              {data?.titulo ?? 'Carregando…'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-bgSoft px-2.5 py-1 text-[13px] text-t2 transition hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded-lg bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] font-medium text-[var(--prazo-atrasado)]">
              {error}
            </div>
          )}

          {!data && !error && (
            <div className="space-y-3">
              <div className="h-16 animate-pulse rounded-xl bg-bgSoft" />
              <div className="h-[240px] animate-pulse rounded-xl bg-bgSoft" />
              <div className="h-20 animate-pulse rounded-xl bg-bgSoft" />
            </div>
          )}

          {data && (
            <>
              {/* Informações do post — em boxes no topo */}
              <InfoBoxes data={data} />

              {pauta ? (
                <div>
                  <SecLabel>Ideia do post</SecLabel>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[1.6] text-ink">
                    {data.ideiaDoPost || (
                      <span className="text-t3">Sem ideia cadastrada.</span>
                    )}
                  </p>
                </div>
              ) : (
                <>
                  {/* Arte */}
                  {arquivos.length > 0 ? (
                    <div>
                      <SecLabel>Arte</SecLabel>
                      <div className="relative mt-1.5 overflow-hidden rounded-xl border border-[rgba(21,21,33,0.08)] bg-black">
                        {arqAtivo && isVideo(arqAtivo.name, arqAtivo.mimeType) ? (
                          <video
                            key={arqAtivo.id}
                            src={`/api/drive/preview/${arqAtivo.id}`}
                            controls
                            playsInline
                            className="mx-auto max-h-[55vh] w-full object-contain"
                          />
                        ) : arqAtivo && isImage(arqAtivo.name, arqAtivo.mimeType) ? (
                          <img
                            key={arqAtivo.id}
                            src={`/api/drive/preview/${arqAtivo.id}`}
                            alt={arqAtivo.name}
                            className="mx-auto max-h-[55vh] w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center text-[12px] text-white/70">
                            Pré-visualização não disponível
                          </div>
                        )}

                        {arquivos.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setAtivo((a) => Math.max(0, a - 1))}
                              disabled={ativo === 0}
                              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1 text-[14px] shadow-sm transition hover:bg-white disabled:opacity-30"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAtivo((a) =>
                                  Math.min(arquivos.length - 1, a + 1),
                                )
                              }
                              disabled={ativo === arquivos.length - 1}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1 text-[14px] shadow-sm transition hover:bg-white disabled:opacity-30"
                            >
                              ›
                            </button>
                            <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
                              {ativo + 1} / {arquivos.length}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-bgSoft px-3 py-4 text-center text-[12px] text-t3">
                      Nenhuma arte anexada ainda.
                    </div>
                  )}

                  {/* Link do Drive */}
                  {data.driveLinks.length > 0 && (
                    <div>
                      <SecLabel>Drive</SecLabel>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {data.driveLinks.map((l) => (
                          <a
                            key={l.url}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[rgba(21,21,33,0.12)] bg-white px-3 py-2 text-[13px] font-medium text-ink transition hover:bg-bgSoft"
                          >
                            📁 Abrir no Drive ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legenda */}
                  <div>
                    <SecLabel>Legenda</SecLabel>
                    <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[1.6] text-ink">
                      {data.legenda || (
                        <span className="text-t3">Sem legenda cadastrada.</span>
                      )}
                    </p>
                  </div>
                </>
              )}

              {/* Ações */}
              <div className="border-t border-[rgba(21,21,33,0.08)] pt-3">
                <AcoesTarefa
                  tarefaId={tarefaId}
                  aprovacao={aprovacao}
                  onConcluido={onClose}
                />
              </div>

              <HistoricoBox comentarios={data.comentarios} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
