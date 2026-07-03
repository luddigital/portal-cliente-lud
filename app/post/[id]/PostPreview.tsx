'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LegendaEditavel } from './LegendaEditavel';

export type PreviewArquivo = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink: string | null;
  isFolder: boolean;
};

type Modo = 'idle' | 'aprovando' | 'pedindoAlteracao' | 'comentando';

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
  postId,
  tarefaId,
  tarefaTitulo,
  legenda,
  voltarPara = '/',
  aprovacaoColaborativa = false,
}: {
  arquivos: PreviewArquivo[];
  formatoTipo: FormatoTipo;
  postId: string;
  tarefaId: string | null;
  tarefaTitulo: string;
  legenda?: string | null;
  voltarPara?: string;
  aprovacaoColaborativa?: boolean;
}) {
  const info = FORMATO_INFO[formatoTipo] ?? FORMATO_INFO.desconhecido;
  const router = useRouter();
  const [ativo, setAtivo] = useState(0);

  const [comentarioGeral, setComentarioGeral] = useState('');

  // Carrossel: marcação por card (t = índice). Reels/vídeo: por timestamp em s.
  const isCarrossel = formatoTipo === 'post' && arquivos.length > 1;
  const [marcacoes, setMarcacoes] = useState<{ t: number; texto: string }[]>([]);
  const [pausadoEm, setPausadoEm] = useState<number | null>(null);
  const [textoPausa, setTextoPausa] = useState('');

  // Textarea inline pra comentário do card ATIVO (só carrossel)
  const [textoCardAtivo, setTextoCardAtivo] = useState('');

  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<Modo>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'aprovado' | 'alteracao' | null>(null);

  // Status do rascunho: 'limpo' | 'salvando' | 'salvo' | 'erro'
  const [statusRascunho, setStatusRascunho] = useState<
    'limpo' | 'salvando' | 'salvo' | 'erro'
  >('limpo');
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(null);

  const ativoArq = arquivos[ativo];

  // Persistência do rascunho — Supabase (cross-device). Se falhar, cai pro
  // localStorage como fallback do mesmo device (offline etc).
  const storageKey = tarefaId ? `lud:coment:${tarefaId}` : null;
  const rascunhoCarregado = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load inicial: tenta Supabase, cai pra localStorage se der erro/vazio
  useEffect(() => {
    if (!tarefaId) {
      rascunhoCarregado.current = true;
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const r = await fetch(
          `/api/rascunho/aprovacao?tarefaId=${encodeURIComponent(tarefaId)}`,
        );
        if (!ativo) return;
        if (r.ok) {
          const j = await r.json();
          const temSupabase =
            (typeof j.comentarioGeral === 'string' && j.comentarioGeral.length > 0) ||
            (Array.isArray(j.marcacoes) && j.marcacoes.length > 0);
          if (temSupabase) {
            setComentarioGeral(j.comentarioGeral ?? '');
            setMarcacoes(Array.isArray(j.marcacoes) ? j.marcacoes : []);
            if (j.atualizadoEm) setUltimoSalvo(j.atualizadoEm);
            rascunhoCarregado.current = true;
            return;
          }
        }
      } catch {
        /* Supabase indisponível — segue pro fallback */
      }
      // Fallback: localStorage
      if (storageKey) {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.comentarioGeral === 'string') {
              setComentarioGeral(parsed.comentarioGeral);
            }
            if (Array.isArray(parsed.marcacoes)) {
              setMarcacoes(parsed.marcacoes);
            }
          }
        } catch {
          /* ignora rascunho corrompido */
        }
      }
      rascunhoCarregado.current = true;
    })();
    return () => {
      ativo = false;
    };
  }, [tarefaId, storageKey]);

  // Auto-save debounced no Supabase + espelho local
  useEffect(() => {
    if (!tarefaId || !rascunhoCarregado.current) return;
    // Sempre espelha no localStorage (rápido, offline-friendly)
    if (storageKey) {
      try {
        if (comentarioGeral.trim() === '' && marcacoes.length === 0) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({ comentarioGeral, marcacoes }),
          );
        }
      } catch {
        /* localStorage indisponível */
      }
    }
    // Debounce 800ms pro Supabase
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatusRascunho('limpo');
    debounceRef.current = setTimeout(async () => {
      setStatusRascunho('salvando');
      try {
        const r = await fetch('/api/rascunho/aprovacao', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tarefaId, comentarioGeral, marcacoes }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setStatusRascunho('salvo');
        setUltimoSalvo(new Date().toISOString());
      } catch {
        setStatusRascunho('erro');
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tarefaId, storageKey, comentarioGeral, marcacoes]);

  function limparRascunho() {
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ok */
      }
    }
    if (tarefaId) {
      fetch(`/api/rascunho/aprovacao?tarefaId=${encodeURIComponent(tarefaId)}`, {
        method: 'DELETE',
      }).catch(() => {
        /* silencioso */
      });
    }
  }

  // Adicionar/atualizar comentário no card ativo (carrossel). Chamado
  // pelo botão + adicionar / Enter — limpa o textarea depois.
  function salvarCardAtivo() {
    const texto = textoCardAtivo.trim();
    if (!texto) return;
    setMarcacoes((m) => {
      const outros = m.filter((x) => x.t !== ativo);
      return [...outros, { t: ativo, texto }].sort((a, b) => a.t - b.t);
    });
    setTextoCardAtivo('');
  }

  // Auto-save do textoCardAtivo — cada tecla, debounced 500ms. Assim se o
  // cliente digita e sai sem apertar "+ adicionar", não perde o comentário.
  const cardAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isCarrossel) return;
    if (cardAutoSaveRef.current) clearTimeout(cardAutoSaveRef.current);
    cardAutoSaveRef.current = setTimeout(() => {
      const texto = textoCardAtivo.trim();
      setMarcacoes((m) => {
        const outros = m.filter((x) => x.t !== ativo);
        if (!texto) return outros;
        return [...outros, { t: ativo, texto }].sort((a, b) => a.t - b.t);
      });
    }, 500);
    return () => {
      if (cardAutoSaveRef.current) clearTimeout(cardAutoSaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoCardAtivo, ativo, isCarrossel]);

  // Limpa estado de pausa ao trocar de slide; pré-carrega comentário existente
  // desse card na textarea inline (se houver)
  useEffect(() => {
    setPausadoEm(null);
    setTextoPausa('');
    if (isCarrossel) {
      const existente = marcacoes.find((m) => m.t === ativo);
      setTextoCardAtivo(existente?.texto ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, isCarrossel]);

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

  // Consolida o que vai pro Notion: marcações + comentário geral. Formato
  // depende do tipo: carrossel usa "Card N:", vídeo usa "[MM:SS]".
  const comentarioFinal = (() => {
    const partes: string[] = [];
    if (marcacoes.length > 0) {
      partes.push(
        marcacoes
          .map((m) =>
            isCarrossel
              ? `Card ${m.t + 1}: ${m.texto}`
              : `[${fmtTime(m.t)}] ${m.texto}`,
          )
          .join('\n'),
      );
    }
    const geral = comentarioGeral.trim();
    if (geral) partes.push(isCarrossel && marcacoes.length > 0 ? `Geral: ${geral}` : geral);
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
      limparRascunho();
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
      limparRascunho();
      setDone('alteracao');
      setTimeout(() => router.push(voltarPara), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setModo('idle');
    }
  }

  async function comentarSemEncerrar() {
    if (!tarefaId) return;
    if (comentarioFinal.length < 2) {
      setError('Escreve algo antes de comentar.');
      return;
    }
    setLoading(true);
    setError(null);
    setModo('comentando');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/comentar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentarioFinal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      limparRascunho();
      setComentarioGeral('');
      setMarcacoes([]);
      // Não navega — fica na página pra outros opinarem
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
    <div
      className={
        tarefaId
          ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(340px,32%,420px)] lg:gap-6 lg:items-start'
          : ''
      }
    >
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
        <LegendaEditavel postId={postId} legendaInicial={legenda} />
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
      </div>

      {tarefaId && (
        <div className="mt-6 lg:mt-0">
        <div className="card sticky bottom-2 sm:bottom-6 lg:bottom-auto lg:top-6 z-20 space-y-3 border border-[rgba(21,21,33,0.08)] bg-white p-4 sm:p-5 shadow-[0_4px_20px_rgba(21,21,33,0.06)]">
          {(comentarioGeral || marcacoes.length > 0) && !done && (
            <div className="flex items-center justify-between gap-2 border-b border-[rgba(21,21,33,0.06)] pb-2 text-[10px] text-t3">
              <span
                style={{
                  color:
                    statusRascunho === 'erro'
                      ? 'var(--prazo-atrasado)'
                      : statusRascunho === 'salvando'
                        ? 'var(--prazo-chegando)'
                        : 'var(--t3)',
                }}
              >
                {statusRascunho === 'salvando'
                  ? '💾 Salvando…'
                  : statusRascunho === 'erro'
                    ? '⚠️ Erro ao salvar (rascunho fica local)'
                    : statusRascunho === 'salvo'
                      ? '✓ Rascunho salvo'
                      : ultimoSalvo
                        ? `Rascunho de ${new Date(ultimoSalvo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                        : '💾 Rascunho automático'}
              </span>
              <span className="text-t3">Volte quando quiser</span>
            </div>
          )}

          {marcacoes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {marcacoes.map((m, i) => (
                <li
                  key={i}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-ink ${
                    isCarrossel && m.t === ativo
                      ? 'bg-[var(--cal-aprovacao-soft)]'
                      : 'bg-bgSoft'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => isCarrossel && setAtivo(m.t)}
                    className="font-mono text-[10px] font-semibold text-mauve transition hover:text-ink"
                    title={isCarrossel ? 'Ir pra esse card' : undefined}
                  >
                    {isCarrossel ? `Card ${m.t + 1}` : fmtTime(m.t)}
                  </button>
                  <span className="max-w-[200px] truncate">{m.texto}</span>
                  <button
                    type="button"
                    onClick={() => {
                      removerMarcacao(i);
                      if (isCarrossel && m.t === ativo) setTextoCardAtivo('');
                    }}
                    className="text-t3 transition hover:text-hubRed"
                    aria-label="Remover marcação"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isCarrossel && (
            <div className="rounded-xl border border-[rgba(21,21,33,0.1)] bg-bgSoft/60 p-2.5 space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                  Card {ativo + 1} de {arquivos.length}
                </span>
                <span className="text-t2">
                  {marcacoes.some((m) => m.t === ativo)
                    ? 'Editando comentário desse card'
                    : 'Comentar nesse card'}
                </span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={textoCardAtivo}
                  onChange={(e) => setTextoCardAtivo(e.target.value)}
                  placeholder="O que ajustar nesse card?"
                  className="input flex-1 text-[12px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textoCardAtivo.trim()) {
                      e.preventDefault();
                      salvarCardAtivo();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={salvarCardAtivo}
                  disabled={!textoCardAtivo.trim()}
                  className="btn-ghost shrink-0 text-[12px] disabled:opacity-40"
                >
                  {marcacoes.some((m) => m.t === ativo) ? 'atualizar' : '+ adicionar'}
                </button>
              </div>
            </div>
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
            <label className="label">
              {aprovacaoColaborativa ? 'Comentário da equipe' : 'Comentário geral (opcional)'}
            </label>
            <textarea
              rows={aprovacaoColaborativa ? 6 : 3}
              value={comentarioGeral}
              onChange={(e) => setComentarioGeral(e.target.value)}
              placeholder={
                aprovacaoColaborativa
                  ? 'Escreve seu feedback. Vários da equipe podem opinar — só Aprovar/Reprovar fecham o post.'
                  : 'Algum recado pra equipe?'
              }
              className="input resize-y text-[13px]"
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
              if (aprovacaoColaborativa) {
                // Modo TKRA: vários da equipe podem opinar; só Aprovar/Reprovar fecham.
                return (
                  <div className="space-y-5">
                    {/* Bloco 1: comentar */}
                    <button
                      type="button"
                      onClick={comentarSemEncerrar}
                      disabled={loading || !temComentario}
                      className="btn-primary w-full justify-center whitespace-nowrap"
                    >
                      {modo === 'comentando' ? 'Enviando…' : '💬 Enviar comentário'}
                    </button>

                    {/* Separador com rótulo */}
                    <div className="relative pt-1">
                      <div className="absolute inset-x-0 top-1/2 h-px bg-[rgba(21,21,33,0.08)]" />
                      <div className="relative mx-auto inline-flex w-full justify-center">
                        <span className="bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
                          Quando o feedback estiver final
                        </span>
                      </div>
                    </div>

                    {/* Bloco 2: encerrar */}
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={aprovar}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--prazo-em-dia)' }}
                      >
                        {modo === 'aprovando' ? 'Aprovando…' : '✓ Aprovar'}
                      </button>
                      <button
                        type="button"
                        onClick={pedirAlteracao}
                        disabled={loading || !temComentario}
                        className="inline-flex items-center justify-center gap-2 rounded-[10px] border px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                        style={{
                          background: 'var(--prazo-hoje-soft)',
                          color: 'var(--prazo-hoje)',
                          borderColor: 'var(--prazo-hoje)',
                        }}
                      >
                        {modo === 'pedindoAlteracao' ? 'Enviando…' : '✏️ Reprovar'}
                      </button>
                    </div>
                  </div>
                );
              }
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

                  <div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={aprovar}
                        disabled={loading}
                        className={`${temComentario ? 'btn-ghost' : 'btn-primary'} w-full justify-center whitespace-nowrap`}
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
                        className={`${temComentario ? 'btn-primary' : 'btn-ghost'} w-full justify-center whitespace-nowrap`}
                        style={
                          temComentario
                            ? { background: 'var(--prazo-hoje)' }
                            : undefined
                        }
                      >
                        {modo === 'pedindoAlteracao'
                          ? 'Enviando…'
                          : temComentario
                            ? '✏️ Enviar alteração'
                            : 'Pedir alteração'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
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

