'use client';

import { useRef, useState } from 'react';

type Props = {
  onEnviar: (texto: string) => Promise<void>;
  enviando: boolean;
};

export function MessageInput({ onEnviar, enviando }: Props) {
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  function ajustarAltura() {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function submeter() {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    if (ref.current) ref.current.style.height = 'auto';
    await onEnviar(t);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submeter();
      }}
      className="border-t border-[rgba(21,21,33,0.08)] bg-white px-3 py-3"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={ref}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            ajustarAltura();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submeter();
            }
          }}
          rows={1}
          placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          disabled={enviando}
          className="flex-1 resize-none rounded-2xl border border-[rgba(21,21,33,0.12)] bg-bgSoft px-4 py-2.5 text-[13px] text-ink outline-none transition placeholder:text-t3 focus:border-navy/40 focus:bg-white"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white transition hover:bg-ink disabled:opacity-40"
          aria-label="Enviar"
        >
          {enviando ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="32"
                strokeDashoffset="8"
              />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 11l18-8-8 18-2-8-8-2z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
