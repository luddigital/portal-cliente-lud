'use client';

import { useState } from 'react';

/**
 * Card de legenda do post. O cliente pode editar e salvar a legenda direto
 * no Notion. Sem edição: mostra o texto. Editando: textarea + salvar/cancelar.
 */
export function LegendaEditavel({
  postId,
  legendaInicial,
}: {
  postId: string;
  legendaInicial: string;
}) {
  const [legenda, setLegenda] = useState(legendaInicial);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(legendaInicial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function comecarEdicao() {
    setRascunho(legenda);
    setError(null);
    setSalvo(false);
    setEditando(true);
  }

  function cancelar() {
    setRascunho(legenda);
    setError(null);
    setEditando(false);
  }

  async function salvar() {
    const texto = rascunho.trim();
    if (!texto) {
      setError('A legenda não pode ficar vazia.');
      return;
    }
    if (texto === legenda.trim()) {
      setEditando(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/post/${postId}/legenda`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ legenda: texto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setLegenda(texto);
      setEditando(false);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Legenda
        </div>
        {!editando && (
          <button
            type="button"
            onClick={comecarEdicao}
            className="text-[12px] font-medium text-navy transition hover:text-ink"
          >
            ✏️ Editar
          </button>
        )}
      </div>

      {editando ? (
        <div className="mt-3 space-y-2.5">
          <textarea
            rows={8}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            className="input resize-y text-[14px] leading-[1.6]"
            disabled={loading}
            autoFocus
          />
          {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={loading}
              className="btn-primary justify-center"
            >
              {loading ? 'Salvando…' : 'Salvar legenda'}
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={loading}
              className="btn-ghost justify-center"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
            {legenda}
          </p>
          {salvo && (
            <p className="mt-2 text-[12px] font-medium text-[var(--prazo-em-dia)]">
              ✓ Legenda atualizada
            </p>
          )}
        </>
      )}
    </div>
  );
}
