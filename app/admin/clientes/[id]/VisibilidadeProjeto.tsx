'use client';

import { useState } from 'react';

/** Chave "Aparece pro cliente" de um projeto (fica dentro do card do projeto). */
export function VisibilidadeProjeto({ projetoId, visivelInicial }: { projetoId: string; visivelInicial: boolean }) {
  const [visivel, setVisivel] = useState(visivelInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);

  async function alternar(e: React.MouseEvent) {
    // O card inteiro é um link pro projeto: o clique na chave não navega.
    e.preventDefault();
    e.stopPropagation();
    if (salvando) return;
    const novo = !visivel;
    setVisivel(novo);
    setSalvando(true);
    setErro(false);
    try {
      const r = await fetch(`/api/admin/projetos/${projetoId}/visibilidade`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visivel: novo }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setVisivel(!novo);
      setErro(true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={visivel}
      onClick={alternar}
      disabled={salvando}
      title={visivel ? 'A cliente vê esse projeto no portal' : 'Escondido da cliente no portal'}
      className="flex shrink-0 items-center gap-2 rounded-full px-1 py-1 text-[11.5px] font-semibold text-t2 transition hover:text-ink disabled:opacity-60"
    >
      <span className={erro ? 'text-[var(--prazo-atrasado)]' : ''}>
        {erro ? 'não salvou' : visivel ? 'Aparece pro cliente' : 'Escondido do cliente'}
      </span>
      <span
        className={`relative h-[18px] w-[32px] rounded-full transition ${visivel ? 'bg-[var(--prazo-em-dia)]' : 'bg-[#D5D5DB]'}`}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${visivel ? 'left-[16px]' : 'left-[2px]'}`}
        />
      </span>
    </button>
  );
}
