'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export type ProjetoOpcao = { id: string; nome: string };

export function ProjetoSwitcher({
  projetos,
  ativoId,
}: {
  projetos: ProjetoOpcao[];
  ativoId: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [aberto]);

  const ativo = projetos.find((p) => p.id === ativoId);

  async function escolher(id: string) {
    if (id === ativoId) {
      setAberto(false);
      return;
    }
    try {
      const res = await fetch('/api/projetos/escolher', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return;
      setAberto(false);
      startTransition(() => {
        startTransition(() => router.refresh());
      });
    } catch {
      /* ignora */
    }
  }

  if (projetos.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((s) => !s)}
        className="flex items-center gap-2 rounded-full border border-[rgba(21,21,33,0.08)] bg-white px-3 py-1.5 text-[12px] font-medium text-ink transition hover:border-navy/30 hover:bg-bgSoft"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
          Projeto
        </span>
        <span className="max-w-[180px] truncate sm:max-w-[260px]">
          {ativo?.nome ?? 'Selecionar…'}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-t3 transition ${aberto ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-[280px] overflow-hidden rounded-xl border border-[rgba(21,21,33,0.08)] bg-white shadow-[0_8px_24px_rgba(21,21,33,0.12)]">
          <div className="border-b border-[rgba(21,21,33,0.06)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            Trocar de projeto
          </div>
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {projetos.map((p) => {
              const ativo = p.id === ativoId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => escolher(p.id)}
                    disabled={pending}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition ${
                      ativo
                        ? 'bg-bgSoft font-semibold text-ink'
                        : 'text-t1 hover:bg-bgSoft'
                    } disabled:opacity-50`}
                  >
                    <span className="truncate">{p.nome}</span>
                    {ativo && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-navy"
                      >
                        <path d="M5 12l5 5 9-11" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
