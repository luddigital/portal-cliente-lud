'use client';

import { useEffect, useState } from 'react';
import { compararNoFluxo } from '@/lib/etapas-projeto';
import type { TarefaDoPost } from '@/lib/notion';
import { TodasTarefasCard } from '@/app/post/[id]/PostSidebarLud';

type Arquivo = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};
type Tarefa = TarefaDoPost & { pessoa: string | null };
type Preview = {
  titulo: string;
  legenda: string;
  formatoTipo: string;
  dataPostagem: string | null;
  formato: string;
  status: string | null;
  arquivos: Arquivo[];
  tarefas: Tarefa[];
  colaboradores?: Record<string, string>;
};

const DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function dataPostagemTexto(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} (${DIA_SEMANA[dia]})`;
}


function prazoCurto(iso: string | null): { texto: string; atrasada: boolean } {
  if (!iso) return { texto: 'sem prazo', atrasada: false };
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(y, m - 1, d).getTime() - hoje.getTime()) / 86_400_000);
  const data = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  if (dias === 0) return { texto: `${data} · hoje`, atrasada: false };
  if (dias === 1) return { texto: `${data} · amanhã`, atrasada: false };
  if (dias < 0) return { texto: data, atrasada: true };
  return { texto: data, atrasada: false };
}

function TarefasResumo({ tarefas: iniciais }: { tarefas: Tarefa[] }) {
  const [tarefas, setTarefas] = useState(iniciais);
  // Concluídas aqui no popup: guardam o status anterior pro "desfazer".
  const [agora, setAgora] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setTarefas(iniciais), [iniciais]);

  if (tarefas.length === 0) return null;
  const abertas = tarefas
    .filter((t) => t.aberta || t.tarefaId in agora)
    .sort((a, b) => compararNoFluxo(a as any, b as any));
  const concluidas = tarefas.filter((t) => !t.aberta).length;
  const pct = Math.round((concluidas / tarefas.length) * 100);
  const visiveis = abertas.slice(0, 6);

  async function concluir(t: Tarefa) {
    setSalvando(t.tarefaId);
    setErro(null);
    try {
      const res = await fetch(`/api/tarefas/${t.tarefaId}/concluir`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setTarefas((ts) => ts.map((x) => (x.tarefaId === t.tarefaId ? { ...x, aberta: false } : x)));
      setAgora((a) => ({ ...a, [t.tarefaId]: t.status }));
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui concluir.');
    } finally {
      setSalvando(null);
    }
  }

  async function desfazer(t: Tarefa) {
    setSalvando(t.tarefaId);
    setErro(null);
    try {
      const res = await fetch(`/api/tarefas/${t.tarefaId}/reabrir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: agora[t.tarefaId] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setTarefas((ts) => ts.map((x) => (x.tarefaId === t.tarefaId ? { ...x, aberta: true } : x)));
      setAgora((a) => {
        const n = { ...a };
        delete n[t.tarefaId];
        return n;
      });
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui desfazer.');
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">Tarefas</div>
        <span className="font-mono text-[10.5px] text-t3">
          {concluidas}/{tarefas.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-bgSoft">
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>
      {visiveis.length > 0 ? (
        <ul className="space-y-0.5">
          {visiveis.map((t) => {
            const p = prazoCurto(t.prazo);
            const feita = !t.aberta;
            const ocupada = salvando === t.tarefaId;
            return (
              <li key={t.tarefaId} className="flex items-baseline gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => (feita ? desfazer(t) : concluir(t))}
                  disabled={ocupada}
                  title={feita ? 'Desfazer' : 'Concluir tarefa'}
                  aria-label={feita ? `Desfazer conclusão de ${t.titulo}` : `Concluir ${t.titulo}`}
                  className={`group shrink-0 leading-none transition ${feita ? 'text-ink' : 'text-t3 hover:text-ink'} disabled:opacity-40`}
                >
                  {ocupada ? '…' : feita ? '✓' : (
                    <>
                      <span className="group-hover:hidden">○</span>
                      <span className="hidden group-hover:inline">✓</span>
                    </>
                  )}
                </button>
                <span
                  className={`min-w-0 flex-1 truncate ${feita ? 'text-t3 line-through' : 'text-ink'}`}
                  title={t.titulo}
                >
                  {t.titulo}
                </span>
                {feita ? (
                  <button
                    type="button"
                    onClick={() => desfazer(t)}
                    disabled={ocupada}
                    className="shrink-0 text-[11px] text-t3 underline hover:text-ink"
                  >
                    desfazer
                  </button>
                ) : (
                  <>
                    {t.pessoa && <span className="shrink-0 text-[11px] text-t3">{t.pessoa.split(' ')[0]}</span>}
                    <span
                      className={`shrink-0 font-mono text-[10.5px] ${
                        p.atrasada ? 'font-semibold text-[var(--prazo-atrasado)]' : 'text-t2'
                      }`}
                    >
                      {p.atrasada ? `atrasada · ${p.texto}` : p.texto}
                    </span>
                  </>
                )}
              </li>
            );
          })}
          {abertas.length > visiveis.length && (
            <li className="text-[11px] text-t3">+{abertas.length - visiveis.length} em aberto</li>
          )}
        </ul>
      ) : (
        <p className="text-[12px] text-t2">Tudo concluído ✓</p>
      )}
      {erro && <p className="text-[11px] font-semibold text-ink">{erro}</p>}
      {concluidas > 0 && visiveis.length > 0 && (
        <p className="text-[11px] text-t3">
          ✓ {concluidas} {concluidas === 1 ? 'concluída' : 'concluídas'}
        </p>
      )}
    </div>
  );
}

function tipoArquivo(mime: string, nome: string): 'imagem' | 'video' | 'audio' | 'outro' {
  const m = mime.toLowerCase();
  const n = nome.toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(n)) return 'imagem';
  if (m.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(n)) return 'video';
  if (m.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(n)) return 'audio';
  return 'outro';
}

export function PreviaPostModal({
  postId,
  tarefaId,
  fechar,
}: {
  postId: string;
  tarefaId?: string | null;
  fechar: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  // Página completa volta pra onde o popup foi aberto (projeto, aprovações…).
  const hrefCompleto = (() => {
    const q = new URLSearchParams();
    if (tarefaId) q.set('tarefa', tarefaId);
    if (typeof window !== 'undefined') q.set('voltar', window.location.pathname + window.location.search);
    const qs = q.toString();
    return `/post/${postId}${qs ? `?${qs}` : ''}`;
  })();
  const [erro, setErro] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/post/${postId}/preview`, {
          cache: 'no-store',
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
        if (!cancelado) setPreview(j);
      } catch (e: any) {
        if (!cancelado) setErro(e?.message ?? 'erro');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [postId]);

  // ESC fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar();
      if (preview && preview.arquivos.length > 1) {
        if (e.key === 'ArrowLeft')
          setAtivo((i) => Math.max(0, i - 1));
        if (e.key === 'ArrowRight')
          setAtivo((i) => Math.min(preview.arquivos.length - 1, i + 1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fechar, preview]);

  const arquivoAtivo = preview?.arquivos[ativo] ?? null;
  const semArte = !!preview && preview.arquivos.length === 0;
  const tipo = arquivoAtivo
    ? tipoArquivo(arquivoAtivo.mimeType, arquivoAtivo.name)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={fechar}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(21,21,33,0.08)] px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Pré-visualização do post
            </div>
            <div className="mt-0.5 truncate text-[15px] font-semibold text-ink">
              {preview?.titulo ?? 'Carregando…'}
            </div>
            {preview && (preview.dataPostagem || preview.formato || preview.status) && (
              <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-[11.5px] text-t3">
                {preview.dataPostagem && (
                  <span>
                    Postagem <span className="font-medium text-t1">{dataPostagemTexto(preview.dataPostagem)}</span>
                  </span>
                )}
                {preview.formato && <span>· {preview.formato}</span>}
                {preview.status && <span>· {preview.status}</span>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={hrefCompleto}
              title="Abrir página completa"
              aria-label="Abrir página completa"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-2.5 text-[11px] font-semibold text-ink transition hover:bg-bgSoft"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
              </svg>
              <span className="hidden sm:inline">Abrir completo</span>
            </a>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[18px] text-t3 transition hover:bg-bgSoft hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto">
          {erro && (
            <div className="m-6 rounded-lg bg-[var(--prazo-atrasado-soft)] p-4 text-[13px] text-[var(--prazo-atrasado)]">
              {erro}
            </div>
          )}
          {!preview && !erro && (
            <div className="flex h-[360px] items-center justify-center text-[13px] text-t3">
              Carregando preview…
            </div>
          )}
          {preview && (
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              {/* Mídia — sem arte ainda, as tarefas ocupam o lugar dela */}
              <div className="space-y-3">
                {semArte ? (
                  preview.tarefas.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11.5px] text-t3">Arte ainda não anexada. Andamento do post:</p>
                      <div className="rounded-xl border border-[rgba(21,21,33,0.08)] p-4">
                        <TodasTarefasCard
                          tarefas={preview.tarefas}
                          colaboradores={preview.colaboradores ?? {}}
                          podeEditarPrazo
                          semMoldura
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[260px] items-center justify-center rounded-xl bg-bgSoft text-[13px] text-t3">
                      Nenhum arquivo anexado ao post ainda.
                    </div>
                  )
                ) : (
                  <>
                    <div className="relative overflow-hidden rounded-xl bg-ink">
                      <div
                        className={`relative w-full ${
                          tipo === 'video'
                            ? 'aspect-video'
                            : 'aspect-square'
                        }`}
                      >
                        {arquivoAtivo && tipo === 'imagem' && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/drive/preview/${arquivoAtivo.id}`}
                            alt={arquivoAtivo.name}
                            className="absolute inset-0 h-full w-full object-contain"
                          />
                        )}
                        {arquivoAtivo && tipo === 'video' && (
                          <video
                            src={`/api/drive/preview/${arquivoAtivo.id}`}
                            controls
                            playsInline
                            preload="metadata"
                            className="absolute inset-0 h-full w-full"
                          />
                        )}
                        {arquivoAtivo && tipo === 'audio' && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-mauve/15 px-6">
                            <span className="text-[48px]">🎙</span>
                            <audio
                              src={`/api/drive/preview/${arquivoAtivo.id}`}
                              controls
                              preload="metadata"
                              className="w-full max-w-md"
                            />
                          </div>
                        )}
                        {arquivoAtivo && tipo === 'outro' && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                            <span className="text-[48px]">📎</span>
                            <span className="text-[11px]">
                              {arquivoAtivo.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Setas */}
                      {preview.arquivos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAtivo((i) => Math.max(0, i - 1))}
                            disabled={ativo === 0}
                            className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[18px] font-bold text-ink shadow transition hover:bg-white disabled:opacity-30"
                            aria-label="Anterior"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAtivo((i) =>
                                Math.min(preview.arquivos.length - 1, i + 1),
                              )
                            }
                            disabled={ativo === preview.arquivos.length - 1}
                            className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[18px] font-bold text-ink shadow transition hover:bg-white disabled:opacity-30"
                            aria-label="Próximo"
                          >
                            ›
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                            {ativo + 1} / {preview.arquivos.length}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Thumbs */}
                    {preview.arquivos.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto">
                        {preview.arquivos.map((a, i) => {
                          const t = tipoArquivo(a.mimeType, a.name);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setAtivo(i)}
                              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border-2 transition ${
                                i === ativo
                                  ? 'border-ink'
                                  : 'border-transparent opacity-60 hover:opacity-100'
                              }`}
                            >
                              {t === 'imagem' ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`/api/drive/preview/${a.id}`}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-bgSoft text-[16px]">
                                  {t === 'video'
                                    ? '▶'
                                    : t === 'audio'
                                      ? '🎙'
                                      : '📎'}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Legenda + tarefas */}
              <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                  Legenda
                </div>
                {preview.legenda ? (
                  <div className="whitespace-pre-line rounded-lg bg-bgSoft/60 p-3 text-[13px] leading-[1.55] text-ink">
                    {preview.legenda}
                  </div>
                ) : (
                  <div className="rounded-lg bg-bgSoft/60 p-3 text-[12px] italic text-t3">
                    Sem legenda definida.
                  </div>
                )}
              </div>
              {!semArte && <TarefasResumo tarefas={preview.tarefas ?? []} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
