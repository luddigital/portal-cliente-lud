'use client';

import { useState } from 'react';
import type { IgAnalytics, IgMediaItem } from '@/lib/instagram';
import { GraficoLinha } from './GraficoLinha';
import { GraficoBarras } from './GraficoBarras';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

function fmtPct(p: number): string {
  const sinal = p >= 0 ? '+' : '';
  return `${sinal}${p.toFixed(1)}%`;
}

function delta(
  atual: number,
  anterior: number,
): { txt: string; cor: string; sub: string } | null {
  if (anterior <= 0) return null;
  const p = ((atual - anterior) / anterior) * 100;
  return {
    txt: fmtPct(p),
    cor: p >= 0 ? 'var(--prazo-em-dia)' : 'var(--prazo-atrasada)',
    sub: 'vs. período anterior',
  };
}

function Metric({
  label,
  valor,
  atual,
  anterior,
}: {
  label: string;
  valor: string;
  atual?: number;
  anterior?: number;
}) {
  const d = atual != null && anterior != null ? delta(atual, anterior) : null;
  return (
    <div className="card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </div>
      <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
        {valor}
      </div>
      {d ? (
        <div
          className="mt-1 text-[11px] font-semibold"
          style={{ color: d.cor }}
        >
          {d.txt}{' '}
          <span className="font-normal text-t3">{d.sub}</span>
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-t3">&nbsp;</div>
      )}
    </div>
  );
}

// === MEGA CARD DE SEGUIDORES ===
function CardSeguidores({ a }: { a: IgAnalytics }) {
  const total = a.account.followersCount;
  const periodo = a.atual.novosSeguidores;
  const anterior = a.anterior.novosSeguidores;
  const d = delta(periodo, anterior);

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-0 sm:grid-cols-[1.2fr_1fr]">
        <div
          className="p-6 sm:p-7"
          style={{ background: 'linear-gradient(135deg, #2C3E66 0%, #8B7AA3 100%)' }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Seguidores totais
          </div>
          <div className="mt-2 text-[44px] font-semibold tracking-[-0.03em] text-white leading-none sm:text-[52px]">
            {fmt(total)}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2 text-[13px]">
            <span
              className="font-semibold text-white"
            >
              {periodo > 0 ? '+' : ''}{fmt(periodo)}
            </span>
            <span className="text-white/60">no período</span>
            {d && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background:
                    periodo >= anterior
                      ? 'rgba(63, 122, 71, 0.3)'
                      : 'rgba(179, 58, 58, 0.3)',
                  color: '#fff',
                }}
              >
                {d.txt} vs. período anterior
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0 border-l border-[rgba(21,21,33,0.08)] sm:gap-0">
          <div className="border-r border-b border-[rgba(21,21,33,0.08)] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Alcance
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-ink">
              {fmt(a.atual.reach)}
            </div>
          </div>
          <div className="border-b border-[rgba(21,21,33,0.08)] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Interações
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-ink">
              {fmt(a.atual.interactions)}
            </div>
          </div>
          <div className="border-r border-[rgba(21,21,33,0.08)] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Contas engajadas
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-ink">
              {fmt(a.atual.engagedAccounts)}
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Taxa eng.
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-ink">
              {(a.taxaEngajamento * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === POSTS COM FILTRO POR MÉTRICA ===
type CriterioOrdem = 'interactions' | 'reach' | 'likes' | 'comments';

function MediaCard({ m, criterio }: { m: IgMediaItem; criterio: CriterioOrdem }) {
  const data = m.timestamp
    ? new Date(m.timestamp).toLocaleDateString('pt-BR')
    : '';
  const valorDestaque = m[criterio];
  const labelDestaque: Record<CriterioOrdem, string> = {
    interactions: 'Interações',
    reach: 'Alcance',
    likes: 'Curtidas',
    comments: 'Comentários',
  };
  return (
    <a
      href={m.permalink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="card flex gap-3 p-3 transition hover:border-navy/30"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bgSoft">
        {m.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-bgSoft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
            {m.mediaType || 'post'}
          </span>
          <span className="text-[11px] text-t3">{data}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] text-t2">
          {m.caption || 'Sem legenda'}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-t3">
          <span className="font-semibold text-navy">
            {labelDestaque[criterio]}: {fmt(valorDestaque)}
          </span>
          <span>{fmt(m.likes)} curtidas</span>
          <span>{fmt(m.comments)} comentários</span>
          <span>{fmt(m.reach)} alcance</span>
        </div>
      </div>
    </a>
  );
}

function FiltroOrdem({
  valor,
  onChange,
}: {
  valor: CriterioOrdem;
  onChange: (c: CriterioOrdem) => void;
}) {
  const opts: { c: CriterioOrdem; label: string }[] = [
    { c: 'interactions', label: 'Interações' },
    { c: 'reach', label: 'Alcance' },
    { c: 'likes', label: 'Curtidas' },
    { c: 'comments', label: 'Comentários' },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {opts.map((o) => (
        <button
          key={o.c}
          type="button"
          onClick={() => onChange(o.c)}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
            valor === o.c
              ? 'bg-ink text-white'
              : 'bg-bgSoft text-t2 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AnalisePainel({ a }: { a: IgAnalytics }) {
  const [criterio, setCriterio] = useState<CriterioOrdem>('interactions');

  const ordenados = [...a.topMedia].sort((x, y) => y[criterio] - x[criterio]);

  return (
    <div className="space-y-6">
      {/* cabeçalho da conta */}
      <div className="card flex items-center gap-4 p-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-bgSoft">
          {a.account.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.account.profilePicture}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">
            @{a.account.username}
          </div>
          <div className="text-[12px] text-t3">
            Período: {a.period.since} → {a.period.until} · {a.period.dias} dias
          </div>
        </div>
      </div>

      {/* MEGA CARD DE SEGUIDORES + métricas principais */}
      <CardSeguidores a={a} />

      {/* outras métricas (menores) */}
      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-t3">
          Outras métricas
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Alcance"
            valor={fmt(a.atual.reach)}
            atual={a.atual.reach}
            anterior={a.anterior.reach}
          />
          <Metric
            label="Interações"
            valor={fmt(a.atual.interactions)}
            atual={a.atual.interactions}
            anterior={a.anterior.interactions}
          />
          <Metric
            label="Contas engajadas"
            valor={fmt(a.atual.engagedAccounts)}
            atual={a.atual.engagedAccounts}
            anterior={a.anterior.engagedAccounts}
          />
          <Metric
            label="Visitas ao perfil"
            valor={fmt(a.atual.profileViews)}
            atual={a.atual.profileViews}
            anterior={a.anterior.profileViews}
          />
          <Metric
            label="Novos seguidores (líquido)"
            valor={fmt(a.atual.novosSeguidores)}
            atual={a.atual.novosSeguidores}
            anterior={a.anterior.novosSeguidores}
          />
          <Metric
            label="Taxa de engajamento"
            valor={`${(a.taxaEngajamento * 100).toFixed(1)}%`}
          />
        </div>
      </div>

      {/* gráficos diários */}
      <div className="space-y-4">
        {a.serieSeguidores.length > 0 && (
          <GraficoBarras
            dados={a.serieSeguidores}
            label="Seguidores — entraram e saíram (por dia)"
          />
        )}
        {a.serieAlcance.length > 0 && (
          <GraficoLinha dados={a.serieAlcance} label="Alcance (por dia)" />
        )}
        {a.serieEngajamento.length > 0 && (
          <GraficoLinha
            dados={a.serieEngajamento}
            label="Contas engajadas (por dia)"
          />
        )}
      </div>

      {/* top posts */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
              Posts em destaque
            </h2>
            <p className="text-[12px] text-t2">Ordene pela métrica que importa.</p>
          </div>
          <FiltroOrdem valor={criterio} onChange={setCriterio} />
        </div>
        {ordenados.length === 0 ? (
          <p className="mt-3 text-[13px] text-t3">
            Nenhum post publicado no período.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {ordenados.slice(0, 8).map((m) => (
              <MediaCard key={m.id} m={m} criterio={criterio} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
