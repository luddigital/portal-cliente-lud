'use client';

import { useEffect, useState } from 'react';
import type { IgAnalytics } from '@/lib/instagram';
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

export function AnaliseCliente({
  projetos,
}: {
  projetos: { id: string; nome: string }[];
}) {
  const [projetoId, setProjetoId] = useState(projetos[0]?.id ?? '');
  const [modo, setModo] = useState<'preset' | 'custom'>('preset');
  const [presetDias, setPresetDias] = useState(30);
  const [since, setSince] = useState(diasAtrasISO(30));
  const [until, setUntil] = useState(hojeISO());
  const [data, setData] = useState<IgAnalytics | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!projetoId) return;
    let ativo = true;
    setCarregando(true);
    setErro('');
    const qs =
      modo === 'preset'
        ? `projetoId=${encodeURIComponent(projetoId)}&dias=${presetDias}`
        : `projetoId=${encodeURIComponent(projetoId)}&since=${since}&until=${until}`;
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
  }, [projetoId, modo, presetDias, since, until]);

  function escolherPreset(d: number) {
    setModo('preset');
    setPresetDias(d);
    setSince(diasAtrasISO(d));
    setUntil(hojeISO());
  }

  const insightsQuery = `projetoId=${encodeURIComponent(projetoId)}&${
    modo === 'preset' ? `dias=${presetDias}` : `since=${since}&until=${until}`
  }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {projetos.length > 1 && (
          <select
            value={projetoId}
            onChange={(e) => setProjetoId(e.target.value)}
            className="rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
          >
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        )}
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
        <div className="flex items-center gap-2 rounded-full bg-bgSoft px-3 py-1">
          <input
            type="date"
            value={since}
            max={until}
            onChange={(e) => {
              setSince(e.target.value);
              setModo('custom');
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
              setModo('custom');
            }}
            className="border-0 bg-transparent text-[12px] text-ink focus:outline-none"
          />
        </div>
        <a
          href={`/analise/relatorio?projetoId=${encodeURIComponent(projetoId)}&inicio=${since}&fim=${until}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
        >
          ↗ Gerar relatório
        </a>
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
      {data && !carregando && !erro && (
        <AnalisePainel
          a={data}
          insightsQuery={insightsQuery}
          projetoId={projetoId}
        />
      )}
    </div>
  );
}
