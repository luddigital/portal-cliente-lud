'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const PRESETS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
];

/**
 * Filtro de período das seções de vendas/tráfego. Escreve o período na URL
 * (?dias=N ou ?inicio=&fim=) e o server component refaz a busca. Mantém o
 * resto da query intacto.
 */
export function FiltroPeriodo() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const inicioAtual = params.get('inicio') ?? '';
  const fimAtual = params.get('fim') ?? '';
  const ehCustom = !!(inicioAtual && fimAtual);
  const diasAtual = ehCustom ? null : Number(params.get('dias')) || 30;

  const [inicio, setInicio] = useState(inicioAtual);
  const [fim, setFim] = useState(fimAtual);

  function aplicarPreset(dias: number) {
    const q = new URLSearchParams(params.toString());
    q.set('dias', String(dias));
    q.delete('inicio');
    q.delete('fim');
    router.push(`${pathname}?${q.toString()}`);
  }

  function aplicarCustom() {
    if (!inicio || !fim) return;
    const q = new URLSearchParams(params.toString());
    q.set('inicio', inicio);
    q.set('fim', fim);
    q.delete('dias');
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="card flex flex-wrap items-end gap-4 p-4">
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
          Período
        </div>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => {
            const ativo = !ehCustom && diasAtual === p.dias;
            return (
              <button
                key={p.dias}
                type="button"
                onClick={() => aplicarPreset(p.dias)}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition"
                style={{
                  background: ativo ? 'var(--navy)' : 'var(--bgSoft)',
                  color: ativo ? '#fff' : 'var(--t2)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <label className="block">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            De
          </div>
          <input
            type="date"
            value={inicio}
            max={fim || undefined}
            onChange={(e) => setInicio(e.target.value)}
            className="rounded-lg border border-[rgba(21,21,33,0.12)] bg-white px-2.5 py-1.5 text-[12px] text-ink focus:border-navy focus:outline-none"
          />
        </label>
        <label className="block">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            Até
          </div>
          <input
            type="date"
            value={fim}
            min={inicio || undefined}
            onChange={(e) => setFim(e.target.value)}
            className="rounded-lg border border-[rgba(21,21,33,0.12)] bg-white px-2.5 py-1.5 text-[12px] text-ink focus:border-navy focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={aplicarCustom}
          disabled={!inicio || !fim}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition disabled:opacity-40"
          style={{ background: ehCustom ? 'var(--navy)' : 'var(--mauve, #8485A3)' }}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
