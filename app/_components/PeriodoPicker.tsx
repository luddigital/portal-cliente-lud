'use client';

import { useEffect, useRef, useState } from 'react';

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const off = (x.getDay() + 6) % 7; // segunda-feira = 0
  x.setDate(x.getDate() - off);
  return x;
}
function fmtBr(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y?.slice(2) ?? ''}`;
}

type PresetKey =
  | '7d'
  | '28d'
  | '90d'
  | 'semana'
  | 'mes'
  | 'ano'
  | 'semanaPassada'
  | 'mesPassado'
  | 'max';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '7d', label: 'Últimos 7 dias' },
  { key: '28d', label: 'Últimos 28 dias' },
  { key: '90d', label: 'Últimos 90 dias' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mês' },
  { key: 'ano', label: 'Este ano' },
  { key: 'semanaPassada', label: 'Semana passada' },
  { key: 'mesPassado', label: 'Mês passado' },
  { key: 'max', label: 'Máximo (1 ano)' },
];

function rangeDe(key: PresetKey): [string, string] {
  const t = new Date();
  switch (key) {
    case '7d':
      return [isoLocal(addDays(t, -7)), isoLocal(t)];
    case '28d':
      return [isoLocal(addDays(t, -28)), isoLocal(t)];
    case '90d':
      return [isoLocal(addDays(t, -90)), isoLocal(t)];
    case 'semana':
      return [isoLocal(inicioSemana(t)), isoLocal(t)];
    case 'mes':
      return [isoLocal(new Date(t.getFullYear(), t.getMonth(), 1)), isoLocal(t)];
    case 'ano':
      return [isoLocal(new Date(t.getFullYear(), 0, 1)), isoLocal(t)];
    case 'semanaPassada': {
      const ini = addDays(inicioSemana(t), -7);
      return [isoLocal(ini), isoLocal(addDays(ini, 6))];
    }
    case 'mesPassado': {
      const ini = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const fim = new Date(t.getFullYear(), t.getMonth(), 0);
      return [isoLocal(ini), isoLocal(fim)];
    }
    case 'max':
      return [isoLocal(addDays(t, -365)), isoLocal(t)];
  }
}

export function PeriodoPicker({
  since,
  until,
  onApply,
}: {
  since: string;
  until: string;
  onApply: (since: string, until: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [dSince, setDSince] = useState(since);
  const [dUntil, setDUntil] = useState(until);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) {
      setDSince(since);
      setDUntil(until);
    }
  }, [aberto, since, until]);

  useEffect(() => {
    if (!aberto) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [aberto]);

  const presetAtivo = PRESETS.find((p) => {
    const [s, u] = rangeDe(p.key);
    return s === dSince && u === dUntil;
  })?.key;

  const hojeISO = isoLocal(new Date());

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-bgSoft"
      >
        <span aria-hidden>📅</span>
        {fmtBr(since)} – {fmtBr(until)}
        <span className="text-t3" aria-hidden>
          ▾
        </span>
      </button>

      {aberto && (
        <div className="absolute z-30 mt-2 w-[min(92vw,520px)] rounded-2xl border border-[rgba(21,21,33,0.1)] bg-white p-4 shadow-[0_12px_40px_rgba(21,21,33,0.14)]">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-col gap-0.5 sm:w-[190px]">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    const [s, u] = rangeDe(p.key);
                    setDSince(s);
                    setDUntil(u);
                  }}
                  className={`rounded-lg px-3 py-2 text-left text-[13px] transition ${
                    presetAtivo === p.key
                      ? 'bg-ink font-semibold text-white'
                      : 'text-t2 hover:bg-bgSoft hover:text-ink'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex-1 border-t border-[rgba(21,21,33,0.08)] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
                Personalizado
              </div>
              <div className="mt-2 space-y-2">
                <label className="block text-[12px] text-t2">
                  De
                  <input
                    type="date"
                    value={dSince}
                    max={dUntil}
                    onChange={(e) => setDSince(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
                  />
                </label>
                <label className="block text-[12px] text-t2">
                  Até
                  <input
                    type="date"
                    value={dUntil}
                    min={dSince}
                    max={hojeISO}
                    onChange={(e) => setDUntil(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[12px] text-t3">
              {fmtBr(dSince)} – {fmtBr(dUntil)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-full px-4 py-2 text-[12px] font-semibold text-t2 transition hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(dSince, dUntil);
                  setAberto(false);
                }}
                className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
