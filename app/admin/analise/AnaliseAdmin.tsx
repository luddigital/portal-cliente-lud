'use client';

import { useEffect, useState } from 'react';
import type { IgAccount, IgAnalytics } from '@/lib/instagram';
import { AnalisePainel } from '@/app/_components/AnalisePainel';
import { PeriodoPicker } from '@/app/_components/PeriodoPicker';

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function diasAtrasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function AnaliseAdmin({
  accounts,
  projetoPorIg,
  igIdInicial,
}: {
  accounts: IgAccount[];
  projetoPorIg: Record<string, string>;
  /** Conta pré-selecionada (deep-link a partir da página de projeto). */
  igIdInicial?: string;
}) {
  // Só respeita o deep-link se a conta existir na lista carregada.
  const igIdValido =
    igIdInicial && accounts.some((a) => a.igUserId === igIdInicial)
      ? igIdInicial
      : accounts[0]?.igUserId ?? '';
  const [igId, setIgId] = useState(igIdValido);
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
    const pid = projetoPorIg[igId];
    const qs = `igId=${encodeURIComponent(igId)}&since=${since}&until=${until}${
      pid ? `&projetoId=${encodeURIComponent(pid)}` : ''
    }`;
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
  }, [igId, since, until]);

  if (accounts.length === 0) {
    return (
      <p className="text-[13px] text-t3">
        Nenhuma conta Instagram encontrada no Business Manager conectado.
      </p>
    );
  }

  const projetoId = projetoPorIg[igId];
  const insightsQuery = `igId=${encodeURIComponent(igId)}&since=${since}&until=${until}${
    projetoId ? `&projetoId=${encodeURIComponent(projetoId)}` : ''
  }`;

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

        <PeriodoPicker
          since={since}
          until={until}
          onApply={(s, u) => {
            setSince(s);
            setUntil(u);
          }}
        />

        {projetoId ? (
          <a
            href={`/analise/relatorio?projetoId=${encodeURIComponent(projetoId)}&inicio=${since}&fim=${until}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
          >
            ↗ Gerar relatório
          </a>
        ) : (
          <span
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-bgSoft px-4 py-2 text-[12px] text-t3"
            title="Mapeie essa conta IG pra um projetoId em IG_ACCOUNTS pra liberar o relatório"
          >
            ↗ Gerar relatório (mapeie em IG_ACCOUNTS)
          </span>
        )}
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
