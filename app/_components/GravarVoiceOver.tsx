'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Teleprompter + gravador de voice over.
 *
 * - Quebra o texto em frases (split por . ! ?)
 * - Mostra a frase ATUAL em destaque, anteriores/próximas dimmed
 * - Cliente clica "Próxima" conforme vai falando
 * - Botão de gravar usa MediaRecorder API (webm/opus, funciona em qualquer
 *   navegador moderno)
 * - Ao parar, devolve o Blob via onGravacao() — TarefaForm anexa no envio
 */

function dividirEmFrases(texto: string): string[] {
  // Mantém pontuação no fim da frase. Quebra por . ! ? seguido de espaço
  // ou nova linha. Filtra fragmentos < 4 caracteres (lixo).
  const trim = texto.replace(/\s+/g, ' ').trim();
  const partes = trim.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length >= 4);
  return partes;
}

function fmtTempo(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function GravarVoiceOver({
  texto,
  onGravacao,
}: {
  /** Roteiro (voice over). Quando vazio/ausente vira "mensagem de voz livre"
   *  — só botão de gravar, sem teleprompter. */
  texto?: string;
  onGravacao: (file: File) => void;
}) {
  const frases = texto ? dividirEmFrases(texto) : [];
  const modoLivre = frases.length === 0;
  const [idx, setIdx] = useState(0);
  const [gravando, setGravando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpa stream ao desmontar
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function iniciar() {
    setErro(null);
    // Pré-check: MediaRecorder suportado?
    if (typeof MediaRecorder === 'undefined') {
      setErro(
        'Esse navegador não grava áudio. Tenta pelo Chrome ou Safari atualizado, ou grava no celular e manda o arquivo aqui embaixo.',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro(
        'Esse navegador não deixou usar o microfone. Atualiza a página e tenta de novo.',
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      // Ordem de preferência: mp4 primeiro (Safari só aceita isso; Chrome também aceita),
      // depois webm. Isso maximiza compatibilidade com <audio> em todos os browsers.
      const candidatos = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      const mime = candidatos.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = (e: any) => {
        setErro(
          `Erro na gravação: ${e?.error?.message ?? e?.message ?? 'desconhecido'}`,
        );
        setGravando(false);
      };
      rec.onstop = () => {
        const tipo = rec.mimeType || mime || 'audio/webm';
        const ext = tipo.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(chunksRef.current, { type: tipo });

        // Validação crítica: se o blob saiu vazio ou minúsculo, o arquivo
        // não presta e o cliente ia enviar lixo. Avisa pra regravar.
        if (blob.size < 1024) {
          setErro(
            'A gravação saiu vazia. Confere se o microfone está liberado e tenta de novo.',
          );
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return;
        }

        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        const dataStr = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const file = new File([blob], `voice-over-${dataStr}.${ext}`, {
          type: tipo,
        });
        onGravacao(file);
        // Para o stream
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      // start(1000) força ondataavailable a cada 1s — essencial no Safari,
      // que senão só dispara no stop() e pode perder chunks.
      rec.start(1000);
      setGravando(true);
      setTempo(0);
      const inicio = Date.now();
      intervalRef.current = setInterval(() => {
        setTempo((Date.now() - inicio) / 1000);
      }, 250);
    } catch (e: any) {
      setErro(
        e?.name === 'NotAllowedError'
          ? 'O microfone está bloqueado. Clica no cadeado ao lado do endereço do site, libera o microfone e tenta de novo.'
          : e?.name === 'NotFoundError'
            ? 'Não achei nenhum microfone. Confere se o do computador ou do celular está funcionando.'
            : (e?.message ?? 'Não consegui acessar o microfone.'),
      );
    }
  }

  function parar() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Flush dos dados pendentes antes de parar — garante que o último
    // chunk de áudio seja incluído. Importante no Safari que lazily
    // bufferiza.
    try {
      if (mediaRef.current?.state === 'recording') {
        mediaRef.current.requestData();
      }
    } catch {
      /* alguns browsers antigos não têm requestData — ignora */
    }
    mediaRef.current?.stop();
    mediaRef.current = null;
    setGravando(false);
  }

  function regravar() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTempo(0);
    setIdx(0);
  }

  const fraseAtual = modoLivre ? null : frases[idx];
  const fraseAnterior = !modoLivre && idx > 0 ? frases[idx - 1] : null;
  const fraseProxima =
    !modoLivre && idx < frases.length - 1 ? frases[idx + 1] : null;

  return (
    <div className="card overflow-hidden p-0">
      {/* header com botão de gravar SEMPRE visível à direita */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(21,21,33,0.06)] px-5 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            {modoLivre ? 'Mensagem de voz' : 'Gravar voice over'}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold text-ink">
            {modoLivre
              ? 'Grave um áudio se preferir'
              : `Frase ${idx + 1} de ${frases.length}`}
            {gravando && (
              <span className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--prazo-atrasado)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                REC {fmtTempo(tempo)}
              </span>
            )}
            {previewUrl && !gravando && (
              <span className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--prazo-em-dia)]">
                ✓ Gravado · {fmtTempo(tempo)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!gravando && !previewUrl && (
            <button
              type="button"
              onClick={iniciar}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--prazo-atrasado)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white" /> Gravar
            </button>
          )}
          {gravando && (
            <button
              type="button"
              onClick={parar}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              <span className="h-2.5 w-2.5 bg-white" /> Parar
            </button>
          )}
          {previewUrl && !gravando && (
            <button
              type="button"
              onClick={regravar}
              className="rounded-full border border-[rgba(21,21,33,0.1)] bg-white px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-bgSoft"
            >
              ↻ Regravar
            </button>
          )}
        </div>
      </div>

      {/* Preview em linha dedicada — não cortado */}
      {previewUrl && !gravando && (
        <div className="border-b border-[rgba(21,21,33,0.06)] bg-mauve/5 px-5 py-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mauve">
            Prévia da sua gravação
          </div>
          <audio src={previewUrl} controls className="h-10 w-full" />
        </div>
      )}

      {/* teleprompter — só quando há roteiro */}
      {!modoLivre && (
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {fraseAnterior && (
            <p className="line-clamp-2 text-[14px] leading-relaxed text-t3/70">
              {fraseAnterior}
            </p>
          )}
          <p className="mt-2 text-[20px] font-medium leading-snug text-ink sm:text-[22px]">
            {fraseAtual}
          </p>
          {fraseProxima && (
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-t3/70">
              {fraseProxima}
            </p>
          )}

          {/* navegação de frases */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="rounded-full border border-[rgba(21,21,33,0.1)] bg-white px-4 py-2 text-[12px] font-medium text-ink transition hover:bg-bgSoft disabled:opacity-30"
            >
              ← Anterior
            </button>
            <div className="flex-1 px-2">
              <div className="h-1 overflow-hidden rounded-full bg-bgSoft">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${((idx + 1) / frases.length) * 100}%`,
                    background: 'var(--prazo-em-dia)',
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIdx((i) => Math.min(frases.length - 1, i + 1))}
              disabled={idx === frases.length - 1}
              className="rounded-full border border-[rgba(21,21,33,0.1)] bg-white px-4 py-2 text-[12px] font-medium text-ink transition hover:bg-bgSoft disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {/* rodapé: dica + mensagem de erro */}
      <div className="border-t border-[rgba(21,21,33,0.06)] bg-bgSoft/40 px-5 py-3">
        {erro && (
          <p className="mb-2 rounded-md bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] text-[var(--prazo-atrasado)]">
            {erro}
          </p>
        )}
        <p className="text-[11px] text-t3">
          {gravando
            ? 'Gravando… passa pra próxima frase conforme for lendo.'
            : previewUrl
              ? 'Pronto! A gravação já vai junto no envio. Se quiser refazer, clica em ↻ Regravar.'
              : 'Clica em Gravar pra começar. O áudio já vai junto no envio.'}
        </p>
      </div>
    </div>
  );
}
