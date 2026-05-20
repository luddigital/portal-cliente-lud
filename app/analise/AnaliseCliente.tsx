'use client';

import { useEffect, useState } from 'react';
import type { IgAnalytics } from '@/lib/instagram';
import { AnalisePainel } from '@/app/_components/AnalisePainel';

const PERIODOS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
];

export function AnaliseCliente({
  projetos,
}: {
  projetos: { id: string; nome: string }[];
}) {
  const [projetoId, setProjetoId] = useState(projetos[0]?.id ?? '');
  const [dias, setDias] = useState(30);
  const [data, setData] = useState<IgAnalytics | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!projetoId) return;
    let ativo = true;
    setCarregando(true);
    setErro('');
    fetch(
      `/api/instagram/analytics?projetoId=${encodeURIComponent(projetoId)}&dias=${dias}`,
    )
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
  }, [projetoId, dias]);

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
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`rounded-full px-3 py-1.5 text-[12px] transition ${
                dias === p.dias
                  ? 'bg-ink font-semibold text-white'
                  : 'bg-bgSoft text-t2 hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {carregando && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[104px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
            />
          ))}
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
