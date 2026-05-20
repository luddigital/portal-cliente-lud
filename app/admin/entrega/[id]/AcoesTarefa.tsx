'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Modo = 'idle' | 'aprovando' | 'alterando' | 'concluindo';

/**
 * Ações da tarefa no painel do post (página de entrega).
 * Tarefa comum: só "Concluir". Tarefa de aprovação: campo de comentário +
 * "Aprovar" e "Pedir alteração" — igual ao fluxo de aprovação do cliente.
 */
export function AcoesTarefa({
  tarefaId,
  aprovacao,
  onConcluido,
}: {
  tarefaId: string;
  aprovacao: boolean;
  onConcluido: () => void;
}) {
  const router = useRouter();
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<Modo>('idle');
  const [error, setError] = useState<string | null>(null);

  function falhou(msg: string) {
    setError(msg);
    setLoading(false);
    setModo('idle');
  }

  async function concluir() {
    setLoading(true);
    setModo('concluindo');
    setError(null);
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/concluir`, { method: 'POST' });
      if (!res.ok) throw new Error('Não consegui concluir a tarefa.');
      onConcluido();
      router.refresh();
    } catch (e: any) {
      falhou(e.message);
    }
  }

  async function aprovar() {
    setLoading(true);
    setModo('aprovando');
    setError(null);
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/aprovar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Erro ${res.status}`);
      onConcluido();
      router.refresh();
    } catch (e: any) {
      falhou(e.message);
    }
  }

  async function pedirAlteracao() {
    if (comentario.trim().length < 3) {
      setError('Conta o que precisa ajustar (mínimo 3 caracteres).');
      return;
    }
    setLoading(true);
    setModo('alterando');
    setError(null);
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/alterar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Erro ${res.status}`);
      onConcluido();
      router.refresh();
    } catch (e: any) {
      falhou(e.message);
    }
  }

  // Tarefa comum — só concluir.
  if (!aprovacao) {
    return (
      <div className="space-y-2">
        {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}
        <button
          type="button"
          onClick={concluir}
          disabled={loading}
          className="w-full rounded-full py-2.5 text-[13px] font-semibold transition disabled:opacity-50"
          style={{
            background: 'var(--prazo-em-dia-soft)',
            color: 'var(--prazo-em-dia)',
          }}
        >
          {modo === 'concluindo' ? 'Concluindo…' : '✓ Concluir tarefa'}
        </button>
      </div>
    );
  }

  // Tarefa de aprovação — comentário + aprovar / pedir alteração.
  const temComentario = comentario.trim() !== '';
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Comentário
        </label>
        <textarea
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Recado pra equipe — opcional pra aprovar, necessário pra pedir alteração."
          className="input mt-1 resize-y text-[13px]"
          disabled={loading}
        />
      </div>

      {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={aprovar}
          disabled={loading}
          className="flex-1 rounded-full py-2.5 text-[13px] font-semibold transition disabled:opacity-50"
          style={
            temComentario
              ? { background: 'var(--prazo-em-dia-soft)', color: 'var(--prazo-em-dia)' }
              : { background: 'var(--prazo-em-dia)', color: '#fff' }
          }
        >
          {modo === 'aprovando' ? 'Aprovando…' : '✓ Aprovar'}
        </button>
        <button
          type="button"
          onClick={pedirAlteracao}
          disabled={loading}
          className="flex-1 rounded-full py-2.5 text-[13px] font-semibold transition disabled:opacity-50"
          style={
            temComentario
              ? { background: 'var(--prazo-hoje)', color: '#fff' }
              : { background: 'var(--prazo-hoje-soft)', color: 'var(--prazo-hoje)' }
          }
        >
          {modo === 'alterando' ? 'Enviando…' : '✎ Pedir alteração'}
        </button>
      </div>
    </div>
  );
}
