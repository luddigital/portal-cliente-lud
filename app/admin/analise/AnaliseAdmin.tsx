'use client';

import { useEffect, useState } from 'react';
import type { IgAccount, IgAnalytics } from '@/lib/instagram';
import { AnalisePainel } from '@/app/_components/AnalisePainel';

const PRESETS = [
  { dias: 7, label: '7d' },
  { dias: 14, label: '14d' },
  { dias: 30, label: '30d' },
  { dias: 60, label: '60d' },
  { dias: 90, label: '90d' },
];

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasAtrasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function AnaliseAdmin({ accounts }: { accounts: IgAccount[] }) {
  const [igId, setIgId] = useState(accounts[0]?.igUserId ?? '');
  const [modo, setModo] = useState<'preset' | 'custom'>('preset');
  const [presetDias, setPresetDias] = useState(30);
  const [since, setSince] = useState(diasAtrasISO(30));
  const [until, setUntil] = useState(hojeISO());
  const [data, setData] = useState<IgAnalytics | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!igId) return;
    let ativo = true;
    setCarregando(true);
    setErro('');
    const qs =
      modo === 'preset'
        ? `igId=${encodeURIComponent(igId)}&dias=${presetDias}`
        : `igId=${encodeURIComponent(igId)}&since=${since}&until=${until}`;
    fetch(`/api/instagram/analytics?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (!ativo) return;
        if (j.error) setErro(j.error);
        else setData(j.analytics);
      })
      .catch((e) => ativo && setErro(String(e?.message ?? e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [igId, modo, presetDias, since, until]);

  if (accounts.length === 0) {
    return (
      <p className="text-[13px] text-t3">
        Nenhuma conta Instagram encontrada no Business Manager conectado.
      </p>
    );
  }

  function escolherPreset(d: number) {
    setModo('preset');
    setPresetDias(d);
    setSince(diasAtrasISO(d));
    setUntil(hojeISO());
  }

  function aplicarCustom() {
    setModo('custom');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={igId}
          onChange={(e) => setIgId(e.target.value)}
          className="rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
        >
          {accounts.map((c) => (
            <option key={c.igUserId} value={c.igUserId}>
              @{c.username} {c.pageName ? `(${c.pageName})` : ''}
            </option>
          ))}
        </select>

        {/* presets rápidos */}
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.dias}
              onClick={() => escolherPreset(p.dias)}
              className={`rounded-full px-3 py-1.5 text-[12px] transition ${
                modo === 'preset' && presetDias === p.dias
                  ? 'bg-ink font-semibold text-white'
                  : 'bg-bgSoft text-t2 hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* date picker custom */}
        <div className="flex items-center gap-2 rounded-full bg-bgSoft px-3 py-1">
          <input
            type="date"
            value={since}
            max={until}
            onChange={(e) => {
              setSince(e.target.value);
              aplicarCustom();
            }}
            className="border-0 bg-transparent text-[12px] text-ink focus:outline-none"
          />
          <span className="text-t3">→</span>
          <input
            type="date"
            value={until}
            min={since}
            max={hojeISO()}
            onChange={(e) => {
              setUntil(e.target.value);
              aplicarCustom();
            }}
            className="border-0 bg-transparent text-[12px] text-ink focus:outline-none"
          />
        </div>
      </div>

      {carregando && (
        <div className="space-y-4">
          <div className="h-[200px] rounded-2xl bg-bgSoft animate-pulse" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[80px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
              />
            ))}
          </div>
        </div>
      )}
      {erro && !carregando && (
        <p className="rounded-lg bg-redSoft px-4 py-3 text-[13px] text-crimson">
          {erro}
        </p>
      )}
      {data && !carregando && !erro && <AnalisePainel a={data} />}
    </div>
  );
}
