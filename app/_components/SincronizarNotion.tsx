'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Estado = 'idle' | 'sincronizando' | 'ok' | 'erro';

/**
 * Botão "Sincronizar com o Notion" — só a equipe vê (renderizado condicional
 * na home). Limpa os caches do portal via /api/sincronizar e recarrega os
 * dados na hora com startTransition(() => router.refresh()), sem sair da página.
 */
export function SincronizarNotion() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>('idle');
  const [pending, startTransition] = useTransition();

  async function sincronizar() {
    if (estado === 'sincronizando' || pending) return;
    setEstado('sincronizando');
    try {
      const r = await fetch('/api/sincronizar', { method: 'POST' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Recarrega os Server Components com os caches já limpos.
      startTransition(() => router.refresh());
      setEstado('ok');
      setTimeout(() => setEstado('idle'), 2500);
    } catch {
      setEstado('erro');
      setTimeout(() => setEstado('idle'), 3000);
    }
  }

  const label =
    estado === 'sincronizando' || pending
      ? 'Sincronizando…'
      : estado === 'ok'
        ? 'Sincronizado'
        : estado === 'erro'
          ? 'Erro — tentar de novo'
          : 'Sincronizar';

  const girando = estado === 'sincronizando' || pending;

  return (
    <button
      type="button"
      onClick={sincronizar}
      disabled={girando}
      title="Limpa os caches e relê tudo do Notion na hora"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition disabled:cursor-wait ${
        estado === 'ok'
          ? 'border-[var(--cal-publicado)] bg-[var(--cal-publicado-soft)] text-[var(--cal-publicado)]'
          : estado === 'erro'
            ? 'border-[var(--cal-alteracao)] bg-[var(--cal-alteracao-soft)] text-[var(--cal-alteracao)]'
            : 'border-[rgba(21,21,33,0.13)] bg-white text-ink hover:bg-bgSoft'
      }`}
    >
      <span
        aria-hidden
        className={`text-[13px] leading-none ${girando ? 'animate-spin' : ''}`}
      >
        {estado === 'ok' ? '✓' : '↻'}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
