'use client';

import { useState } from 'react';

/**
 * Card da Ideia/Briefing do post — visível pra time da Lud. (admin ou
 * colaborador). Cliente NÃO vê o botão de editar. Salva direto no Notion
 * via /api/post/[id]/ideia.
 */
export function IdeiaEditavel({
  postId,
  ideiaInicial,
  podeEditar,
}: {
  postId: string;
  ideiaInicial: string;
  podeEditar: boolean;
}) {
  const [ideia, setIdeia] = useState(ideiaInicial);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(ideiaInicial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function comecarEdicao() {
    setRascunho(ideia);
    setError(null);
    setSalvo(false);
    setEditando(true);
  }

  function cancelar() {
    setRascunho(ideia);
    setError(null);
    setEditando(false);
  }

  async function salvar() {
    const texto = rascunho.trim();
    if (!texto) {
      setError('A ideia não pode ficar vazia.');
      return;
    }
    if (texto === ideia.trim()) {
      setEditando(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/post/${postId}/ideia`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setIdeia(texto);
      setEditando(false);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Se cliente e não tem ideia, não renderiza nada (comportamento antigo)
  if (!podeEditar && !ideia.trim()) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Ideia do post
        </div>
        {podeEditar && !editando && (
          <button
            type="button"
            onClick={comecarEdicao}
            className="text-[12px] font-medium text-navy transition hover:text-ink"
          >
            ✏️ {ideia.trim() ? 'Editar' : 'Escrever ideia'}
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
            placeholder="Descreva a ideia do post — o ângulo, o tom, o que o cliente vai ver…"
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
              {loading ? 'Salvando…' : 'Salvar'}
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
      ) : ideia.trim() ? (
        <>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
            {ideia}
          </p>
          {salvo && (
            <p className="mt-2 text-[12px] font-medium text-[var(--prazo-em-dia)]">
              ✓ Ideia atualizada
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-[13px] italic text-t3">
          — nenhuma ideia escrita ainda. Clique em &quot;Escrever ideia&quot; pra começar.
        </p>
      )}
    </div>
  );
}
