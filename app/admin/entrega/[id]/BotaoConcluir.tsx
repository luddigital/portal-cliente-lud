'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';

/**
 * Botão compacto de concluir tarefa — usado na linha da tarefa na página
 * de entrega. Marca a tarefa como Concluída no Notion e recarrega a lista.
 */
export function BotaoConcluir({ tarefaId }: { tarefaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function concluir(e: React.MouseEvent) {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/concluir`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      avisarConcluida(tarefaId);
      router.refresh();
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={concluir}
      disabled={loading}
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50"
      style={{
        background: error ? 'var(--prazo-atrasado-soft)' : 'var(--prazo-em-dia-soft)',
        color: error ? 'var(--prazo-atrasado)' : 'var(--prazo-em-dia)',
      }}
    >
      {loading ? 'Concluindo…' : error ? 'Erro · tentar de novo' : '✓ Concluir'}
    </button>
  );
}
