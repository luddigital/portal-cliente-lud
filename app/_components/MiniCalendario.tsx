'use client';

import { useState } from 'react';

/**
 * Calendário custom no estilo do design system da Lud. — substitui o date
 * picker nativo do navegador. Semana começa na SEGUNDA e o dia de HOJE fica
 * bem destacado. Devolve a data escolhida em ISO (AAAA-MM-DD) via onPick.
 */

const DOW = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function parseISO(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function MiniCalendario({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (iso: string) => void;
}) {
  const hoje = new Date();
  const hojeISO = ymd(hoje);
  const sel = parseISO(value);
  const [visao, setVisao] = useState(() => {
    const base = sel ?? hoje;
    return { ano: base.getFullYear(), mes: base.getMonth() };
  });

  const primeiro = new Date(visao.ano, visao.mes, 1);
  // Offset com a semana começando na SEGUNDA (getDay: 0=dom..6=sáb).
  const offset = (primeiro.getDay() + 6) % 7;
  const diasNoMes = new Date(visao.ano, visao.mes + 1, 0).getDate();

  const celulas: (number | null)[] = [];
  for (let i = 0; i < offset; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);

  function mudarMes(delta: number) {
    setVisao((v) => {
      const d = new Date(v.ano, v.mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }

  return (
    <div className="w-[252px] rounded-xl border border-[rgba(21,21,33,0.1)] bg-white p-3 shadow-[0_8px_30px_rgba(21,21,33,0.12)]">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12.5px] font-semibold capitalize text-ink">
          {MESES[visao.mes]} {visao.ano}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            aria-label="Mês anterior"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[14px] text-t2 transition hover:bg-bgSoft hover:text-ink"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            aria-label="Próximo mês"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[14px] text-t2 transition hover:bg-bgSoft hover:text-ink"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DOW.map((d) => (
          <div
            key={d}
            className="py-1 text-[10px] font-semibold uppercase tracking-[0.02em] text-t3"
          >
            {d}
          </div>
        ))}
        {celulas.map((d, i) => {
          if (d === null) return <div key={`v-${i}`} />;
          const iso = ymd(new Date(visao.ano, visao.mes, d));
          const ehHoje = iso === hojeISO;
          const ehSel = value === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] transition ${
                ehSel
                  ? 'bg-ink font-semibold text-white'
                  : ehHoje
                    ? 'bg-[rgba(49,61,101,0.1)] font-bold text-navy ring-1 ring-inset ring-navy'
                    : 'text-ink hover:bg-bgSoft'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[rgba(21,21,33,0.06)] pt-2">
        <button
          type="button"
          onClick={() => {
            setVisao({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
            onPick(hojeISO);
          }}
          className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-navy transition hover:bg-bgSoft"
        >
          Hoje
        </button>
        <span className="text-[10px] text-t3">semana começa na segunda</span>
      </div>
    </div>
  );
}
