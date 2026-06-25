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
  const positivo = atual != null && anterior != null && atual >= anterior;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[rgba(21,21,33,0.06)] bg-bgSoft p-5">
      <div className="text-[13px] font-medium text-t2">{label}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className="text-[32px] font-semibold tracking-[-0.03em] leading-none text-ink sm:text-[36px]">
          {valor}
        </span>
        {d && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{
              background: positivo
                ? 'var(--prazo-em-dia)'
                : 'var(--prazo-atrasada)',
            }}
          >
            <span>{d.txt}</span>
            <span aria-hidden>{positivo ? '↗' : '↘'}</span>
          </span>
        )}
      </div>
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
    <div
      className="overflow-hidden rounded-3xl p-7 sm:p-9"
      style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, var(--mauve) 100%)',
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
        Seguidores totais
      </div>
      <div className="mt-2 text-[52px] font-semibold tracking-[-0.03em] leading-none text-white sm:text-[64px]">
        {fmt(total)}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-semibold text-white">
          {periodo > 0 ? '+' : ''}
          {fmt(periodo)}
        </span>
        <span className="text-white/60">no período</span>
        {d && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
            style={{
              background:
                periodo >= anterior
                  ? 'rgba(63, 122, 71, 0.35)'
                  : 'rgba(179, 58, 58, 0.35)',
            }}
          >
            {d.txt} vs. período anterior
          </span>
        )}
      </div>
    </div>
  );
}

// === POSTS COM FILTRO POR MÉTRICA ===
type CriterioOrdem = 'interactions' | 'reach' | 'likes' | 'comments';

function MediaCard({ m, criterio }: { m: IgMediaItem; criterio: CriterioOrdem }) {
  const data = m.timestamp
    ? new Date(m.timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })
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
      className="group block overflow-hidden rounded-3xl border border-[rgba(21,21,33,0.08)] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(21,21,33,0.10)]"
    >
      {/* foto grande no topo */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-bgSoft">
        {m.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.thumbnail}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-t3">
            Sem prévia
          </div>
        )}
        {/* tipo + data no canto sup esquerdo */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink backdrop-blur">
            {m.mediaType?.toLowerCase() || 'post'}
          </span>
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-t2 backdrop-blur">
            {data}
          </span>
        </div>
        {/* destaque grande no canto inf direito */}
        <div className="absolute bottom-3 right-3 rounded-2xl bg-white/95 px-3 py-2 text-right backdrop-blur">
          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-t3">
            {labelDestaque[criterio]}
          </div>
          <div className="mt-0.5 text-[18px] font-semibold tracking-[-0.02em] leading-none text-ink">
            {fmt(valorDestaque)}
          </div>
        </div>
      </div>

      {/* card embaixo — branco/soft, sem gradient pesado */}
      <div className="px-5 py-4">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
          {m.caption || 'Sem legenda'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatChip icon="♡" label="curtidas" valor={fmt(m.likes)} />
          <StatChip icon="💬" label="comentários" valor={fmt(m.comments)} />
          <StatChip icon="👁" label="alcance" valor={fmt(m.reach)} />
        </div>
      </div>
    </a>
  );
}

function StatChip({
  icon,
  label,
  valor,
}: {
  icon: string;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-bgSoft px-2.5 py-1 text-[11px]">
      <span className="text-[12px] leading-none text-t3" aria-hidden>
        {icon}
      </span>
      <span className="font-semibold text-ink">{valor}</span>
      <span className="text-t3">{label}</span>
    </div>
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ordenados.slice(0, 9).map((m) => (
              <MediaCard key={m.id} m={m} criterio={criterio} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
