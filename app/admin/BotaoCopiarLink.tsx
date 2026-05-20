'use client';

import { useState } from 'react';

export function BotaoCopiarLink({ email }: { email: string }) {
  const [estado, setEstado] = useState<'idle' | 'gerando' | 'copiado' | 'erro'>('idle');

  async function copiar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEstado('gerando');
    try {
      const res = await fetch('/api/admin/gerar-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      await navigator.clipboard.writeText(data.url);
      setEstado('copiado');
      setTimeout(() => setEstado('idle'), 2500);
    } catch (err) {
      console.error(err);
      setEstado('erro');
      setTimeout(() => setEstado('idle'), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      disabled={estado === 'gerando'}
      title="Gera um link de acesso de 7 dias e copia pra área de transferência"
      className="text-[11px] text-mauve transition hover:text-ink disabled:opacity-50"
    >
      {estado === 'gerando'
        ? 'gerando…'
        : estado === 'copiado'
          ? '✓ link copiado'
          : estado === 'erro'
            ? 'erro'
            : '📋 copiar link'}
    </button>
  );
}
