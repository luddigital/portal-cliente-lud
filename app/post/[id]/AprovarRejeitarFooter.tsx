'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Modo = 'idle' | 'aprovando' | 'pedindoAlteracao';

export function AprovarRejeitarFooter({
  tarefaId,
  tarefaTitulo,
}: {
  tarefaId: string;
  tarefaTitulo: string;
}) {
  const router = useRouter();
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<Modo>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'aprovado' | 'alteracao' | null>(null);

  async function aprovar() {
    setLoading(true);
    setError(null);
    setModo('aprovando');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/aprovar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setDone('aprovado');
      setTimeout(() => router.push('/'), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setModo('idle');
    }
  }

  async function pedirAlteracao() {
    if (comentario.trim().length < 3) {
      setError('Conta o que precisa ajustar (mínimo 3 caracteres).');
      return;
    }
    setLoading(true);
    setError(null);
    setModo('pedindoAlteracao');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/alterar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setDone('alteracao');
      setTimeout(() => router.push('/'), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setModo('idle');
    }
  }

  if (done) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgba(21,21,33,0.08)] bg-white px-6 py-5 shadow-[0_-4px_20px_rgba(21,21,33,0.05)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-[14px] font-semibold text-ink">
            {done === 'aprovado' ? '✅ Aprovado pelo cliente' : '🔁 Alteração solicitada'}
          </div>
          <p className="mt-1 text-[12px] text-mauve">
            {done === 'aprovado'
              ? 'A gente segue daqui.'
              : 'A gente vai ajustar e te avisa quando estiver pronto.'}
          </p>
          <p className="mt-2 text-[11px] text-t3">Voltando pro dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgba(21,21,33,0.08)] bg-white px-6 py-4 shadow-[0_-4px_20px_rgba(21,21,33,0.05)]">
      <div className="mx-auto max-w-3xl space-y-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Comentário (opcional pra aprovar, obrigatório pra pedir alteração)
          </label>
          <textarea
            rows={2}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Conta o que achou, o que ajustar, ou só dá um OK."
            className="input mt-1 resize-y text-[13px]"
            disabled={loading}
          />
        </div>

        {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-t3">{tarefaTitulo}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pedirAlteracao}
              disabled={loading}
              className="btn-ghost"
            >
              {modo === 'pedindoAlteracao' ? 'Enviando…' : 'Pedir alteração'}
            </button>
            <button
              type="button"
              onClick={aprovar}
              disabled={loading}
              className="btn-primary"
              style={{ background: 'var(--cal-publicado)' }}
            >
              {modo === 'aprovando' ? 'Aprovando…' : '✓ Aprovar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
