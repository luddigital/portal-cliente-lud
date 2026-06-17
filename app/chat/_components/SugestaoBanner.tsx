'use client';

import { useState } from 'react';
import type { WhatsappSugestao } from '@/lib/supabase';

type Props = {
  sugestao: WhatsappSugestao;
  onAprovar: (texto: string) => Promise<void>;
  onRejeitar: () => Promise<void>;
  onEditar: (texto: string) => void;
};

/**
 * Rascunho proposto pela Claude. Aparece acima do campo de mensagem.
 * O time decide: Aprovar e enviar / Editar (joga no campo) / Descartar.
 */
export function SugestaoBanner({ sugestao, onAprovar, onRejeitar, onEditar }: Props) {
  const [processando, setProcessando] = useState<null | 'aprovar' | 'rejeitar'>(null);

  async function aprovar() {
    if (processando) return;
    setProcessando('aprovar');
    try {
      await onAprovar(sugestao.texto);
    } finally {
      setProcessando(null);
    }
  }

  async function rejeitar() {
    if (processando) return;
    setProcessando('rejeitar');
    try {
      await onRejeitar();
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="border-t border-navy/15 bg-navy/[0.04] px-3 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-navy">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 6.9 18.2l1.9-5.8L4 8.8h6.1L12 3z" />
          </svg>
          Sugestão da Claude · revise antes de enviar
        </div>

        <div className="rounded-2xl border border-navy/15 bg-white px-4 py-2.5 text-[13px] text-ink whitespace-pre-wrap">
          {sugestao.texto}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={aprovar}
            disabled={!!processando}
            className="rounded-full bg-navy px-4 py-1.5 text-[12px] font-medium text-white transition hover:bg-ink disabled:opacity-40"
          >
            {processando === 'aprovar' ? 'Enviando…' : 'Aprovar e enviar'}
          </button>
          <button
            onClick={() => onEditar(sugestao.texto)}
            disabled={!!processando}
            className="rounded-full border border-navy/30 px-4 py-1.5 text-[12px] font-medium text-navy transition hover:bg-navy/5 disabled:opacity-40"
          >
            Editar
          </button>
          <button
            onClick={rejeitar}
            disabled={!!processando}
            className="rounded-full px-4 py-1.5 text-[12px] font-medium text-t3 transition hover:text-hubRed disabled:opacity-40"
          >
            {processando === 'rejeitar' ? 'Descartando…' : 'Descartar'}
          </button>
        </div>
      </div>
    </div>
  );
}
