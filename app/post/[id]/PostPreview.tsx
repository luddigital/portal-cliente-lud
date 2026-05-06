'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type PreviewArquivo = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink: string | null;
  isFolder: boolean;
};

type Modo = 'idle' | 'aprovando' | 'pedindoAlteracao';

function isImage(mime: string, name: string): boolean {
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(name);
}

function isVideo(mime: string, name: string): boolean {
  if (mime.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v)$/i.test(name);
}

function fmtTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}


export type FormatoTipo = 'post' | 'reels' | 'story' | 'desconhecido';

const FORMATO_INFO: Record<
  FormatoTipo,
  { label: string; cardLabel: string; aspect: string; bg: string; accent: string }
> = {
  post: {
    label: 'Carrossel',
    cardLabel: 'card',
    aspect: 'aspect-square',
    bg: 'bg-bgSoft',
    accent: 'var(--cal-agendado)',
  },
  reels: {
    label: 'Reels',
    cardLabel: 'momento',
    aspect: 'aspect-[9/16]',
    bg: 'bg-black',
    accent: 'var(--cal-alteracao)',
  },
  story: {
    label: 'Stories',
    cardLabel: 'tela',
    aspect: 'aspect-[9/16]',
    bg: 'bg-bgSoft',
    accent: 'var(--cal-aprovacao)',
  },
  desconhecido: {
    label: 'Post',
    cardLabel: 'card',
    aspect: 'aspect-square',
    bg: 'bg-bgSoft',
    accent: 'var(--cal-rascunho)',
  },
};

export function PostPreview({
  arquivos,
  formatoTipo,
  tarefaId,
  tarefaTitulo,
  legenda,
  voltarPara = '/',
}: {
  arquivos: PreviewArquivo[];
  formatoTipo: FormatoTipo;
  tarefaId: string | null;
  tarefaTitulo: string;
  legenda?: string | null;
  voltarPara?: string;
}) {
  const info = FORMATO_INFO[formatoTipo] ?? FORMATO_INFO.desconhecido;
  const router = useRouter();
  const [ativo, setAtivo] = useState(0);

  const [comentarioGeral, setComentarioGeral] = useState('');

  // Marcações por timestamp (vídeo) — capturadas quando o vídeo é pausado
  const [marcacoes, setMarcacoes] = useState<{ t: number; texto: string }[]>([]);
  const [pausadoEm, setPausadoEm] = useState<number | null>(null);
  const [textoPausa, setTextoPausa] = useState('');

  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<Modo>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'aprovado' | 'alteracao' | null>(null);

  const ativoArq = arquivos[ativo];

  // Limpa estado de pausa ao trocar de slide
  useEffect(() => {
    setPausadoEm(null);
    setTextoPausa('');
  }, [ativo]);

  function adicionarMarcacao() {
    if (pausadoEm === null) return;
    const texto = textoPausa.trim();
    if (!texto) return;
    setMarcacoes((m) => [...m, { t: pausadoEm, texto }].sort((a, b) => a.t - b.t));
    setTextoPausa('');
  }

  function removerMarcacao(idx: number) {
    setMarcacoes((m) => m.filter((_, i) => i !== idx));
  }

  // Consolida o que vai pro Notion: marcações + comentário geral
  const comentarioFinal = (() => {
    const partes: string[] = [];
    if (marcacoes.length > 0) {
      partes.push(
        marcacoes.map((m) => `[${fmtTime(m.t)}] ${m.texto}`).join('\n'),
      );
    }
    const geral = comentarioGeral.trim();
    if (geral) partes.push(geral);
    return partes.join('\n\n').trim();
  })();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      }
      if (e.key === 'ArrowLeft') setAtivo((a) => Math.max(0, a - 1));
      if (e.key === 'ArrowRight') setAtivo((a) => Math.min(arquivos.length - 1, a + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [arquivos.length]);

  async function aprovar() {
    if (!tarefaId) return;
    setLoading(true);
    setError(null);
    setModo('aprovando');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/aprovar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentarioFinal || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setDone('aprovado');
      setTimeout(() => router.push(voltarPara), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setModo('idle');
    }
  }

  async function pedirAlteracao() {
    if (!tarefaId) return;
    if (comentarioFinal.length < 3) {
      setError('Conta o que precisa ajustar antes de pedir alteração.');
      return;
    }
    setLoading(true);
    setError(null);
    setModo('pedindoAlteracao');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/alterar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentarioFinal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setDone('alteracao');
      setTimeout(() => router.push(voltarPara), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setModo('idle');
    }
  }

  if (arquivos.length === 0) {
    return (
      <div className="card p-6 text-center text-[13px] text-mauve">
        Nenhum arquivo de pré-visualização anexado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Carousel
        arquivos={arquivos}
        ativo={ativo}
        setAtivo={setAtivo}
        aspect={info.aspect}
        bg={info.bg}
        onVideoPause={(t) => setPausadoEm(t)}
        onVideoPlay={() => setPausadoEm(null)}
      />

      {legenda && (
        <div className="card p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Legenda
          </div>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
            {legenda}
          </p>
        </div>
      )}

      {ativoArq && (
        <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-t3">
          <span className="truncate">{ativoArq.name}</span>
          <a
            href={ativoArq.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-mauve transition hover:text-ink"
          >
            abrir no Drive ↗
          </a>
        </div>
      )}

      {tarefaId && (
        <div className="card sticky bottom-2 sm:bottom-6 z-20 space-y-3 border border-[rgba(21,21,33,0.08)] bg-white p-4 sm:p-5 shadow-[0_4px_20px_rgba(21,21,33,0.06)]">
          {marcacoes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {marcacoes.map((m, i) => (
                <li
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-bgSoft px-2.5 py-1 text-[11px] text-ink"
                >
                  <span className="font-mono text-[10px] font-semibold text-mauve">
                    {fmtTime(m.t)}
                  </span>
                  <span className="max-w-[200px] truncate">{m.texto}</span>
                  <button
                    type="button"
                    onClick={() => removerMarcacao(i)}
                    className="text-t3 transition hover:text-hubRed"
                    aria-label="Remover marcação"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pausadoEm !== null && (
            <div className="rounded-xl border border-navy/30 bg-bgSoft p-2.5 space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                  📍 {fmtTime(pausadoEm)}
                </span>
                <span className="text-t2">Comentar nesse momento</span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={textoPausa}
                  onChange={(e) => setTextoPausa(e.target.value)}
                  placeholder="O que ajustar nesse trecho?"
                  className="input flex-1 text-[12px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textoPausa.trim()) {
                      e.preventDefault();
                      adicionarMarcacao();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={adicionarMarcacao}
                  disabled={!textoPausa.trim()}
                  className="btn-ghost shrink-0 text-[12px] disabled:opacity-40"
                >
                  + adicionar
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Comentário geral (opcional)
            </label>
            <textarea
              rows={2}
              value={comentarioGeral}
              onChange={(e) => setComentarioGeral(e.target.value)}
              placeholder="Algum recado pra equipe?"
              className="input mt-1 resize-y text-[13px]"
              disabled={loading || !!done}
            />
          </div>

          {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}

          {done ? (
            <div className="text-center">
              <div className="text-[14px] font-semibold text-ink">
                {done === 'aprovado' ? '✅ Aprovado pelo cliente' : '🔁 Alteração solicitada'}
              </div>
              <p className="mt-1 text-[12px] text-mauve">
                {done === 'aprovado'
                  ? 'A gente segue daqui.'
                  : 'A gente vai ajustar e te avisa quando estiver pronto.'}
              </p>
              <p className="mt-2 text-[11px] text-t3">
                {voltarPara === '/' ? 'Voltando pro dashboard…' : 'Voltando pra etapa…'}
              </p>
            </div>
          ) : (
            (() => {
              const temComentario =
                marcacoes.length > 0 || comentarioGeral.trim() !== '';
              const totalMarcs = marcacoes.length;
              return (
                <div className="space-y-2.5">
                  <div
                    className="rounded-lg px-3 py-2 text-[12px] leading-snug"
                    style={{
                      background: temComentario
                        ? 'var(--prazo-hoje-soft)'
                        : 'var(--prazo-em-dia-soft)',
                      color: temComentario
                        ? 'var(--prazo-hoje)'
                        : 'var(--prazo-em-dia)',
                    }}
                  >
                    {temComentario ? (
                      <>
                        Você adicionou{' '}
                        <b>
                          {totalMarcs > 0
                            ? `${totalMarcs} marcação${totalMarcs === 1 ? '' : 'ões'}`
                            : ''}
                          {totalMarcs > 0 && comentarioGeral.trim() ? ' + ' : ''}
                          {comentarioGeral.trim() ? 'um comentário' : ''}
                        </b>
                        . Clique em <b>Enviar pedido de alteração</b> pra mandar
                        pra equipe ajustar.
                      </>
                    ) : (
                      <>Tudo certo com o material? Clique em <b>Aprovar</b> pra liberar a postagem.</>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="hidden sm:inline text-[11px] text-t3">{tarefaTitulo}</span>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={aprovar}
                        disabled={loading}
                        className={`${temComentario ? 'btn-ghost' : 'btn-primary'} w-full sm:w-auto justify-center`}
                        style={
                          temComentario
                            ? undefined
                            : { background: 'var(--prazo-em-dia)' }
                        }
                      >
                        {modo === 'aprovando' ? 'Aprovando…' : '✓ Aprovar'}
                      </button>
                      <button
                        type="button"
                        onClick={pedirAlteracao}
                        disabled={loading}
                        className={`${temComentario ? 'btn-primary' : 'btn-ghost'} w-full sm:w-auto justify-center`}
                        style={
                          temComentario
                            ? { background: 'var(--prazo-hoje)' }
                            : undefined
                        }
                      >
                        {modo === 'pedindoAlteracao'
                          ? 'Enviando…'
                          : temComentario
                            ? '✏️ Enviar pedido de alteração'
                            : 'Pedir alteração'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

function Carousel({
  arquivos,
  ativo,
  setAtivo,
  aspect,
  bg,
  onVideoPause,
  onVideoPlay,
}: {
  arquivos: PreviewArquivo[];
  ativo: number;
  setAtivo: (n: number) => void;
  aspect: string;
  bg: string;
  onVideoPause?: (currentTime: number) => void;
  onVideoPlay?: () => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const totalIndicadoresVisiveis = Math.min(arquivos.length, 12);

  // Mantém o slide ativo sincronizado com o scroll horizontal (drag/swipe).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    function onScroll() {
      if (!el) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return;
        const w = el.clientWidth;
        if (w === 0) return;
        const idx = Math.round(el.scrollLeft / w);
        if (idx !== ativo && idx >= 0 && idx < arquivos.length) setAtivo(idx);
      });
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
    };
  }, [ativo, arquivos.length, setAtivo]);

  // Quando ativo muda por seta/teclado, scrolla pro slide certo.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const target = w * ativo;
    if (Math.abs(el.scrollLeft - target) > 4) {
      el.scrollTo({ left: target, behavior: 'smooth' });
    }
  }, [ativo]);

  function ir(delta: number) {
    setAtivo(Math.max(0, Math.min(arquivos.length - 1, ativo + delta)));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={trackRef}
          className={`flex snap-x snap-mandatory overflow-x-auto rounded-2xl border border-[rgba(21,21,33,0.08)] ${bg} [scroll-behavior:smooth] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {arquivos.map((a, idx) => (
            <div
              key={a.id}
              className={`shrink-0 basis-full snap-center ${aspect} relative ${bg}`}
            >
              <SlidePreview
                arquivo={a}
                prioridade={idx === ativo}
                isActive={idx === ativo}
                onVideoPause={onVideoPause}
                onVideoPlay={onVideoPlay}
              />
            </div>
          ))}
        </div>

        {arquivos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => ir(-1)}
              disabled={ativo === 0}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1.5 text-[14px] shadow-sm transition hover:bg-white disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => ir(1)}
              disabled={ativo === arquivos.length - 1}
              aria-label="Próximo"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1.5 text-[14px] shadow-sm transition hover:bg-white disabled:opacity-30"
            >
              ›
            </button>
            <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
              {ativo + 1} / {arquivos.length}
            </div>
          </>
        )}
      </div>

      {arquivos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: totalIndicadoresVisiveis }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAtivo(i)}
              aria-label={`Ir para o card ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === ativo ? 'w-5 bg-ink' : 'w-1.5 bg-[rgba(21,21,33,0.2)]'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlidePreview({
  arquivo,
  prioridade,
  isActive,
  onVideoPause,
  onVideoPlay,
}: {
  arquivo: PreviewArquivo;
  prioridade: boolean;
  isActive: boolean;
  onVideoPause?: (currentTime: number) => void;
  onVideoPlay?: () => void;
}) {
  const ehVideo = isVideo(arquivo.mimeType, arquivo.name);
  const ehImagem = isImage(arquivo.mimeType, arquivo.name);
  const [imgFalhou, setImgFalhou] = useState(false);

  // URL servida pelo nosso proxy (autenticado server-side com a refresh token do Drive).
  // Funciona pro browser do cliente sem precisar de login Google.
  const proxySrc = `/api/drive/preview/${arquivo.id}`;

  if (ehVideo) {
    return (
      <video
        src={proxySrc}
        controls
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full bg-black object-contain"
        onPause={(e) => {
          // Ignora eventos de pause "naturais" no fim do vídeo
          const v = e.currentTarget;
          if (isActive && !v.ended && onVideoPause) {
            onVideoPause(v.currentTime);
          }
        }}
        onPlay={() => {
          if (isActive && onVideoPlay) onVideoPlay();
        }}
      />
    );
  }
  if (ehImagem) {
    if (imgFalhou) {
      return (
        <iframe
          src={`https://drive.google.com/file/d/${arquivo.id}/preview`}
          className="absolute inset-0 h-full w-full"
          allow="autoplay"
          allowFullScreen
        />
      );
    }
    return (
      <img
        src={proxySrc}
        alt={arquivo.name}
        className="absolute inset-0 h-full w-full object-contain"
        loading={prioridade ? 'eager' : 'lazy'}
        onError={() => setImgFalhou(true)}
      />
    );
  }
  return (
    <iframe
      src={`https://drive.google.com/file/d/${arquivo.id}/preview`}
      className="absolute inset-0 h-full w-full"
      allow="autoplay"
      allowFullScreen
    />
  );
}

