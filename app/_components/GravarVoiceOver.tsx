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
  texto: string;
  onGravacao: (file: File) => void;
}) {
  const frases = dividirEmFrases(texto);
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const tipo = rec.mimeType || 'audio/webm';
        const ext = tipo.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(chunksRef.current, { type: tipo });
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
      rec.start();
      setGravando(true);
      setTempo(0);
      const inicio = Date.now();
      intervalRef.current = setInterval(() => {
        setTempo((Date.now() - inicio) / 1000);
      }, 250);
    } catch (e: any) {
      setErro(
        e?.name === 'NotAllowedError'
          ? 'Precisamos da permissão de microfone do navegador pra gravar.'
          : (e?.message ?? 'Não consegui acessar o microfone.'),
      );
    }
  }

  function parar() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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

  if (frases.length === 0) {
    return null;
  }

  const fraseAtual = frases[idx];
  const fraseAnterior = idx > 0 ? frases[idx - 1] : null;
  const fraseProxima = idx < frases.length - 1 ? frases[idx + 1] : null;

  return (
    <div className="card overflow-hidden p-0">
      {/* header com botão de gravar SEMPRE visível à direita */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(21,21,33,0.06)] px-5 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Gravar voice over
          </div>
          <div className="mt-0.5 text-[13px] font-semibold text-ink">
            Frase {idx + 1} de {frases.length}
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
            <>
              <audio src={previewUrl} controls className="h-9 max-w-[200px]" />
              <button
                type="button"
                onClick={regravar}
                className="rounded-full border border-[rgba(21,21,33,0.1)] bg-white px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-bgSoft"
              >
                ↻ Regravar
              </button>
            </>
          )}
        </div>
      </div>

      {/* teleprompter */}
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

      {/* rodapé: dica + mensagem de erro */}
      <div className="border-t border-[rgba(21,21,33,0.06)] bg-bgSoft/40 px-5 py-3">
        {erro && (
          <p className="mb-2 rounded-md bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] text-[var(--prazo-atrasado)]">
            {erro}
          </p>
        )}
        <p className="text-[11px] text-t3">
          {gravando
            ? 'Falando… avance as frases conforme for lendo.'
            : previewUrl
              ? 'Pronto! A gravação já está anexada ao envio abaixo. Se quiser refazer, clique em ↻ Regravar.'
              : 'Clique em Gravar pra começar. O áudio fica anexado ao envio automaticamente.'}
        </p>
      </div>
    </div>
  );
}
