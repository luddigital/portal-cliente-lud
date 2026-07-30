'use client';

import { useState } from 'react';

function fmtBR(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** Data de postagem editável — click abre <input type="date">, blur/change
 *  persiste no Notion via /api/pauta/[postId]/props. */
export function DataEditavel({
  postId,
  dataInicial,
}: {
  postId: string;
  dataInicial: string;
}) {
  const [data, setData] = useState(dataInicial);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(novoISO: string) {
    if (!novoISO || novoISO === data) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/pauta/${postId}/props`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: novoISO }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `Erro ${res.status}`);
      setData(novoISO);
      setEditando(false);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <span className="inline-flex items-center gap-2">
        <input
          type="date"
          defaultValue={data}
          autoFocus
          disabled={salvando}
          onBlur={(e) => salvar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditando(false);
            if (e.key === 'Enter') salvar((e.target as HTMLInputElement).value);
          }}
          className="font-mono text-[12px] text-ink border border-navy rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
        {salvando && <span className="text-[10.5px] text-t3">salvando…</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="font-mono text-ink hover:bg-bgSoft rounded px-1 -mx-1 transition"
        title="Clique pra editar a data"
      >
        {fmtBR(data)}
      </button>
      {erro && <span className="text-[10.5px] text-hubRed">{erro}</span>}
    </span>
  );
}
