'use client';

import { useState } from 'react';
import { CalendarMes } from './CalendarMes';
import type { PostCalendario } from '@/lib/notion';

export type MesCalendario = {
  year: number;
  month: number;
  posts: PostCalendario[];
};

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function CalendarNavigator({ meses }: { meses: MesCalendario[] }) {
  const [idx, setIdx] = useState(0);
  if (meses.length === 0) return null;
  const atual = meses[idx];

  const podeAnterior = idx > 0;
  const podeProximo = idx < meses.length - 1;
  const labelAtual = `${MESES_PT[atual.month - 1]} ${atual.year}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={!podeAnterior}
          aria-label="Mês anterior"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(21,21,33,0.08)] bg-white text-[14px] text-ink transition hover:border-navy/40 disabled:opacity-30"
        >
          ‹
        </button>
        <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{labelAtual}</div>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(meses.length - 1, i + 1))}
          disabled={!podeProximo}
          aria-label="Próximo mês"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(21,21,33,0.08)] bg-white text-[14px] text-ink transition hover:border-navy/40 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <CalendarMes year={atual.year} month={atual.month} posts={atual.posts} />

      {meses.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {meses.map((m, i) => (
            <button
              key={`${m.year}-${m.month}`}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ir para ${MESES_PT[m.month - 1]} ${m.year}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-5 bg-ink' : 'w-1.5 bg-[rgba(21,21,33,0.2)]'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
