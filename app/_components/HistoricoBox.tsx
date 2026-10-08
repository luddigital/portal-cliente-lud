'use client';

import { useState } from 'react';

export type ComentarioItem = {
  id: string;
  texto: string;
  criadoEm: string;
};

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} · ${hh}:${min}`;
}

const VISIVEIS = 5;

/**
 * Histórico de comentários do post: aberto, mais recentes primeiro. Os
 * clientes não achavam a versão recolhida no fim da página.
 */
export function HistoricoBox({ comentarios }: { comentarios: ComentarioItem[] }) {
  const [verTodos, setVerTodos] = useState(false);
  if (!comentarios || comentarios.length === 0) return null;

  const ordenados = [...comentarios].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const lista = verTodos ? ordenados : ordenados.slice(0, VISIVEIS);

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Histórico de comentários
        </h2>
        <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[11px] font-semibold text-t2">
          {comentarios.length}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] text-t3">Tudo o que foi conversado sobre esse post, do mais recente pro mais antigo.</p>
      <ul className="mt-4 space-y-4">
        {lista.map((c) => (
          <li key={c.id} className="border-l-2 border-[rgba(21,21,33,0.15)] pl-3">
            <div className="text-[11px] font-medium text-t3">{fmtDataHora(c.criadoEm)}</div>
            <p className="mt-1 whitespace-pre-line text-[13.5px] leading-[1.55] text-ink">{c.texto}</p>
          </li>
        ))}
      </ul>
      {ordenados.length > VISIVEIS && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          className="mt-4 text-[12px] font-semibold text-t2 underline transition hover:text-ink"
        >
          {verTodos ? 'Mostrar menos' : `Ver todos os ${ordenados.length} comentários`}
        </button>
      )}
    </section>
  );
}
