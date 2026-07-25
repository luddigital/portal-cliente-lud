'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IgAnalytics, IgMediaItem } from '@/lib/instagram';
import type { InsightAcionavel } from '@/lib/insights';
import type { ProjetoConfig } from '@/lib/notion';
import { parseNumBR, fmtCompacto } from '@/lib/num';
import { GraficoLinha } from './GraficoLinha';
import { GraficoBarras } from './GraficoBarras';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** Traduz media_type da Graph API pra label amigável. Reels são VIDEO
 *  na API mas dá pra distinguir da caption (#reels) ou aspect. Fallback:
 *  vídeo comum. */
function formatoLabel(mediaType: string | undefined, caption?: string): string {
  const t = (mediaType ?? '').toUpperCase();
  if (t === 'CAROUSEL_ALBUM') return 'Carrossel';
  if (t === 'IMAGE') return 'Foto';
  if (t === 'REELS') return 'Reels';
  if (t === 'VIDEO') {
    const c = (caption ?? '').toLowerCase();
    if (/#reels?\b|\breels?\b/.test(c)) return 'Reels';
    return 'Vídeo';
  }
  return 'Post';
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
    cor: p >= 0 ? 'var(--prazo-em-dia)' : 'var(--prazo-atrasado)',
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
                : 'var(--prazo-atrasado)',
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

// === CABEÇALHO DE SEGUIDORES (primeiro, tamanho médio) ===
function CabecalhoSeguidores({ a }: { a: IgAnalytics }) {
  const total = a.account.followersCount;
  const novos = a.atual.novosSeguidores;
  const base = total - novos;
  const pct = base > 0 ? (novos / base) * 100 : 0;
  const positivo = novos >= 0;
  return (
    <div className="rounded-3xl border border-[rgba(21,21,33,0.06)] bg-bgSoft p-5 sm:p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-t3">
        Seguidores
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[40px] font-semibold tracking-[-0.03em] leading-none text-ink sm:text-[46px]">
          {fmt(total)}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[13px] font-semibold"
          style={{
            color: positivo ? 'var(--prazo-em-dia)' : 'var(--prazo-atrasado)',
          }}
        >
          <span aria-hidden>{positivo ? '↗' : '↘'}</span>
          <span>
            {novos > 0 ? '+' : ''}
            {fmt(novos)}
          </span>
          {base > 0 && (
            <span className="font-normal text-t3">
              ({pct >= 0 ? '+' : ''}
              {pct.toFixed(1)}%)
            </span>
          )}
        </span>
        <span className="text-[12px] text-t3">no período</span>
      </div>
    </div>
  );
}

// === OBJETIVO & METAS DO MÊS (topo, todas as abas) ===
function MetasObjetivo({ projetoId, a }: { projetoId?: string; a: IgAnalytics }) {
  const [config, setConfig] = useState<ProjetoConfig | null>(null);

  useEffect(() => {
    if (!projetoId) return;
    let ativo = true;
    fetch(`/api/projeto/config?projetoId=${encodeURIComponent(projetoId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (ativo && j?.config) setConfig(j.config);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [projetoId]);

  if (!config) return null;

  const barras = [
    {
      label: 'Seguidores',
      atual: a.account.followersCount,
      meta: parseNumBR(config.metas.seguidores.meta),
      fmt: (n: number) => fmtCompacto(n),
    },
    {
      label: 'Engajamento',
      atual: a.taxaEngajamento * 100,
      meta: parseNumBR(config.metas.engajamento.meta),
      fmt: (n: number) => `${n.toFixed(1)}%`,
    },
    {
      label: 'Alcance',
      atual: a.atual.reach,
      meta: parseNumBR(config.metas.alcance.meta),
      fmt: (n: number) => fmtCompacto(n),
    },
  ].filter((b): b is typeof b & { meta: number } => b.meta != null && b.meta > 0);

  const objetivo = config.objetivo?.trim();
  if (!objetivo && barras.length === 0) return null;

  return (
    <div className="rounded-3xl border border-[rgba(21,21,33,0.06)] bg-bgSoft p-5 sm:p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-t3">
        Objetivo do mês
      </div>
      {objetivo && (
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">
          {objetivo}
        </p>
      )}
      {barras.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barras.map((b) => {
            const pct = Math.min(100, Math.round((b.atual / b.meta) * 100));
            return (
              <div key={b.label}>
                <div className="mb-1 flex items-baseline justify-between text-[12px]">
                  <span className="font-medium text-t2">{b.label}</span>
                  <span className="text-t3">
                    <span className="font-semibold text-ink">{b.fmt(b.atual)}</span>{' '}
                    / {b.fmt(b.meta)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(21,21,33,0.07)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: 'var(--sage)' }}
                  />
                </div>
                <div
                  className="mt-1 text-[11px] font-semibold"
                  style={{ color: 'var(--prazo-em-dia)' }}
                >
                  {pct}% da meta
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// === KPI EM DESTAQUE (fileira do topo) ===
function KpiDestaque({
  label,
  valor,
  atual,
  anterior,
  destaque = false,
}: {
  label: string;
  valor: string;
  atual: number;
  anterior: number;
  destaque?: boolean;
}) {
  const d = delta(atual, anterior);
  const positivo = atual >= anterior;
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 ${
        destaque
          ? 'border-[rgba(21,21,33,0.1)] bg-ink text-white'
          : 'border-[rgba(21,21,33,0.06)] bg-bgSoft text-ink'
      }`}
    >
      <div
        className={`text-[12px] font-medium ${destaque ? 'text-white/70' : 'text-t2'}`}
      >
        {label}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="text-[30px] font-semibold tracking-[-0.03em] leading-none sm:text-[34px]">
          {valor}
        </span>
        {d && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{
              background: positivo
                ? 'var(--prazo-em-dia)'
                : 'var(--prazo-atrasado)',
            }}
          >
            <span>{d.txt}</span>
            <span aria-hidden>{positivo ? '↗' : '↘'}</span>
          </span>
        )}
      </div>
      <div
        className={`mt-1 text-[11px] ${destaque ? 'text-white/50' : 'text-t3'}`}
      >
        vs. período anterior
      </div>
    </div>
  );
}

// === VIEWS POR TIPO DE CONTEÚDO (barras horizontais) ===
function tipoConteudoLabel(chave: string): string {
  switch (chave) {
    case 'REELS':
      return 'Reels';
    case 'STORY':
    case 'STORIES':
      return 'Stories';
    case 'POST':
    case 'POSTS':
    case 'FEED':
      return 'Posts';
    case 'CAROUSEL_CONTAINER':
    case 'CAROUSEL_ALBUM':
    case 'CAROUSEL':
      return 'Carrossel';
    case 'IGTV':
    case 'VIDEO':
      return 'Vídeo';
    case 'LIVE':
    case 'BROADCAST':
      return 'Ao vivo';
    case 'AD':
    case 'ADS':
      return 'Anúncios';
    default:
      return chave.charAt(0) + chave.slice(1).toLowerCase();
  }
}

function ViewsPorTipo({ itens }: { itens: IgAnalytics['viewsPorTipo'] }) {
  if (itens.length === 0) return null;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const total = itens.reduce((acc, i) => acc + i.valor, 0);
  return (
    <div className="rounded-3xl border border-[rgba(21,21,33,0.06)] bg-bgSoft p-5 sm:p-6">
      <h3 className="text-[13px] font-semibold text-ink">
        Views por tipo de conteúdo
      </h3>
      <div className="mt-4 space-y-3">
        {itens.map((i) => {
          const pct = total > 0 ? (i.valor / total) * 100 : 0;
          return (
            <div key={i.chave}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                <span className="font-medium text-ink">
                  {tipoConteudoLabel(i.chave)}
                </span>
                <span className="tabular-nums text-t2">
                  <span className="font-semibold text-ink">{fmt(i.valor)}</span>
                  <span className="ml-1.5 text-t3">{pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgba(21,21,33,0.06)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(i.valor / max) * 100}%`,
                    background: 'var(--navy)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === SEGUIDORES vs NÃO-SEGUIDORES (split) ===
function SplitPublico({ publico }: { publico: NonNullable<IgAnalytics['publico']> }) {
  const total = publico.seguidores + publico.naoSeguidores;
  if (total <= 0) return null;
  const pctSeg = (publico.seguidores / total) * 100;
  const pctNao = 100 - pctSeg;
  return (
    <div className="rounded-3xl border border-[rgba(21,21,33,0.06)] bg-bgSoft p-5 sm:p-6">
      <h3 className="text-[13px] font-semibold text-ink">
        Alcance — seguidores vs. não-seguidores
      </h3>
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full">
        <div style={{ width: `${pctSeg}%`, background: 'var(--navy)' }} />
        <div style={{ width: `${pctNao}%`, background: 'var(--lavender)' }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: 'var(--navy)' }}
          />
          <span className="font-semibold text-ink">{pctSeg.toFixed(1)}%</span>
          <span className="text-t3">seguidores ({fmt(publico.seguidores)})</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: 'var(--lavender)' }}
          />
          <span className="font-semibold text-ink">{pctNao.toFixed(1)}%</span>
          <span className="text-t3">
            não-seguidores ({fmt(publico.naoSeguidores)})
          </span>
        </span>
      </div>
    </div>
  );
}

// === POSTS COM FILTRO POR MÉTRICA ===
type CriterioOrdem =
  | 'views'
  | 'reach'
  | 'interactions'
  | 'likes'
  | 'comments'
  | 'saved'
  | 'shares';

const METRICA_OPTS: { c: CriterioOrdem; label: string }[] = [
  { c: 'views', label: 'Views' },
  { c: 'reach', label: 'Alcance' },
  { c: 'interactions', label: 'Interações' },
  { c: 'likes', label: 'Curtidas' },
  { c: 'comments', label: 'Comentários' },
  { c: 'saved', label: 'Salvos' },
  { c: 'shares', label: 'Compart.' },
];

const LABEL_METRICA = Object.fromEntries(
  METRICA_OPTS.map((o) => [o.c, o.label]),
) as Record<CriterioOrdem, string>;

function MediaCard({ m, criterio }: { m: IgMediaItem; criterio: CriterioOrdem }) {
  const data = m.timestamp
    ? new Date(m.timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })
    : '';
  const valorDestaque = m[criterio];
  const labelDestaque = LABEL_METRICA;
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
            {formatoLabel(m.mediaType, m.caption)}
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
          {m.saved > 0 && (
            <StatChip icon="🔖" label="salvos" valor={fmt(m.saved)} />
          )}
          {m.shares > 0 && (
            <StatChip icon="↗" label="compart." valor={fmt(m.shares)} />
          )}
          {m.views > 0 && (
            <StatChip icon="▶" label="views" valor={fmt(m.views)} />
          )}
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
  return (
    <div className="flex flex-wrap gap-1">
      {METRICA_OPTS.map((o) => (
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

// === LINHA COMPACTA DE CONTEÚDO (lista da aba Conteúdo) ===
function ContentRow({ m, criterio }: { m: IgMediaItem; criterio: CriterioOrdem }) {
  const data = m.timestamp
    ? new Date(m.timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })
    : '';
  return (
    <a
      href={m.permalink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 border-b border-[rgba(21,21,33,0.06)] py-3 transition last:border-b-0 hover:opacity-80"
    >
      <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-bgSoft">
        {m.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">
          {m.caption || 'Sem legenda'}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-t3">
          <span className="font-medium text-t2">
            {formatoLabel(m.mediaType, m.caption)}
            {data ? ` · ${data}` : ''}
          </span>
          <span>♡ {fmt(m.likes)}</span>
          <span>💬 {fmt(m.comments)}</span>
          {m.shares > 0 && <span>↗ {fmt(m.shares)}</span>}
          {m.saved > 0 && <span>🔖 {fmt(m.saved)}</span>}
        </div>
      </div>
      <div className="shrink-0 pl-2 text-right">
        <div className="text-[16px] font-semibold tracking-[-0.02em] leading-none text-ink">
          {fmt(m[criterio])}
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.06em] text-t3">
          {LABEL_METRICA[criterio]}
        </div>
      </div>
    </a>
  );
}

// === ABA VISÃO GERAL ===
function AbaGeral({ a }: { a: IgAnalytics }) {
  return (
    <div className="space-y-6">
      {a.serieViews.length > 0 && (
        <GraficoLinha dados={a.serieViews} label="Views por dia" />
      )}

      {(a.viewsPorTipo.length > 0 || a.publico) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ViewsPorTipo itens={a.viewsPorTipo} />
          {a.publico && <SplitPublico publico={a.publico} />}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-t3">
          Outras métricas
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
            label="Taxa de engajamento"
            valor={`${(a.taxaEngajamento * 100).toFixed(1)}%`}
          />
        </div>
      </div>

      <div className="space-y-4">
        {a.serieSeguidores.length > 0 && (
          <GraficoBarras
            dados={a.serieSeguidores}
            label="Seguidores — variação líquida por dia"
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
    </div>
  );
}

// === ABA CONTEÚDO (busca + filtro por métrica + lista) ===
function AbaConteudo({ a }: { a: IgAnalytics }) {
  const [busca, setBusca] = useState('');
  const [criterio, setCriterio] = useState<CriterioOrdem>('views');
  const [tipo, setTipo] = useState<string>('Todos');

  const tipos = useMemo(() => {
    const s = new Set(
      a.conteudos.map((m) => formatoLabel(m.mediaType, m.caption)),
    );
    return ['Todos', ...[...s].sort()];
  }, [a.conteudos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return a.conteudos
      .filter(
        (m) => tipo === 'Todos' || formatoLabel(m.mediaType, m.caption) === tipo,
      )
      .filter((m) => !q || (m.caption || '').toLowerCase().includes(q))
      .sort((x, y) => y[criterio] - x[criterio]);
  }, [a.conteudos, busca, tipo, criterio]);

  const destaques = filtrados.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* busca */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-[rgba(21,21,33,0.1)] bg-white px-4 py-3">
        <span className="text-[15px] text-t3" aria-hidden>
          🔍
        </span>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar conteúdo por legenda, tema ou palavra-chave…"
          className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-t3"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            className="text-[12px] text-t3 hover:text-ink"
          >
            limpar
          </button>
        )}
      </div>

      {/* filtro por métrica */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
          Ordenar por métrica
        </div>
        <FiltroOrdem valor={criterio} onChange={setCriterio} />
      </div>

      {/* filtro por tipo */}
      {tipos.length > 2 && (
        <div className="flex flex-wrap gap-1">
          {tipos.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                tipo === t
                  ? 'bg-ink text-white'
                  : 'bg-bgSoft text-t2 hover:text-ink'
              }`}
            >
              {t === 'Todos' ? 'Todos os tipos' : t}
            </button>
          ))}
        </div>
      )}

      {/* destaques (top 3 pela métrica escolhida) */}
      {destaques.length >= 3 && !busca && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {destaques.map((m) => (
            <MediaCard key={m.id} m={m} criterio={criterio} />
          ))}
        </div>
      )}

      {/* lista completa */}
      <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white px-4 py-2 sm:px-5">
        <div className="flex items-baseline justify-between gap-3 border-b border-[rgba(21,21,33,0.06)] py-2.5">
          <span className="text-[13px] font-semibold text-ink">
            Conteúdos do período
          </span>
          <span className="text-[12px] text-t3">
            {filtrados.length}{' '}
            {filtrados.length === 1 ? 'item' : 'itens'} · por{' '}
            {LABEL_METRICA[criterio]} ↓
          </span>
        </div>
        {filtrados.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-t3">
            {busca
              ? `Nada encontrado pra "${busca}".`
              : 'Nenhum conteúdo publicado no período.'}
          </p>
        ) : (
          filtrados.map((m) => (
            <ContentRow key={m.id} m={m} criterio={criterio} />
          ))
        )}
      </div>
    </div>
  );
}

// === ABA PÚBLICO (placeholder — demografia vem no próximo passo) ===
function AbaPublico() {
  return (
    <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-8 text-center">
      <div className="text-[13px] font-semibold text-ink">Público — em breve</div>
      <p className="mx-auto mt-1 max-w-md text-[12px] text-t3">
        Gênero, faixa etária e top localizações dos seguidores. Também vamos
        guardar o histórico ao longo do tempo (a API do Instagram só mostra a
        foto do momento).
      </p>
    </div>
  );
}

// === ABA INSIGHTS (IA) ===
const INSIGHT_ICON: Record<InsightAcionavel['tipo'], string> = {
  trafego: '🚀',
  repetir: '🔁',
  cortar: '✂️',
  timing: '⏰',
  publico: '👥',
  geral: '✦',
};

function AbaInsights({ query }: { query?: string }) {
  const [insights, setInsights] = useState<InsightAcionavel[] | null>(null);
  const [audiencia, setAudiencia] = useState<'interno' | 'cliente'>('interno');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(
    (refresh: boolean) => {
      if (!query) return;
      setCarregando(true);
      setErro('');
      fetch(`/api/instagram/insights?${query}${refresh ? '&refresh=1' : ''}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.error) setErro(j.error);
          else {
            setInsights(j.insights ?? []);
            if (j.audiencia) setAudiencia(j.audiencia);
          }
        })
        .catch((e) => setErro(String(e?.message ?? e)))
        .finally(() => setCarregando(false));
    },
    [query],
  );

  useEffect(() => {
    carregar(false);
  }, [carregar]);

  const hero = insights?.[0];
  const apoio = insights?.slice(1) ?? [];
  const heroCliente = audiencia === 'cliente';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            ✦ Insights da Lud. IA
          </h2>
          <p className="text-[12px] text-t2">
            Leitura automática dos dados do período, com ações sugeridas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => carregar(true)}
          disabled={carregando}
          className="rounded-full bg-bgSoft px-4 py-2 text-[12px] font-semibold text-t2 transition hover:text-ink disabled:opacity-50"
        >
          {carregando ? 'Analisando…' : '↻ Atualizar'}
        </button>
      </div>

      {carregando && !insights && (
        <div className="space-y-2">
          <div className="h-[140px] animate-pulse rounded-3xl bg-bgSoft" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[80px] animate-pulse rounded-2xl border border-[rgba(21,21,33,0.06)] bg-bgSoft"
            />
          ))}
        </div>
      )}

      {erro && !carregando && (
        <p className="rounded-lg bg-redSoft px-4 py-3 text-[13px] text-crimson">
          {erro}
        </p>
      )}

      {insights && !erro && insights.length === 0 && !carregando && (
        <p className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-6 text-center text-[13px] text-t3">
          Sem insights pra esse período ainda — publique mais conteúdo ou amplie
          a janela de datas.
        </p>
      )}

      {hero && (
        <div className="space-y-2">
          {/* HERO — o insight #1 do período */}
          <div
            className={`rounded-3xl p-6 sm:p-7 ${
              heroCliente
                ? 'border border-[rgba(21,21,33,0.06)] bg-gradient-to-br from-[#F1EBE5] to-[#F4F6FB]'
                : 'bg-ink text-white'
            }`}
          >
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                heroCliente
                  ? 'bg-white text-fern'
                  : 'bg-white/12 text-lavender'
              }`}
            >
              {INSIGHT_ICON[hero.tipo] ?? '✦'}{' '}
              {heroCliente ? 'destaque do mês' : 'prioridade do mês'}
            </span>
            <h3
              className={`mt-3 text-[20px] font-semibold leading-tight tracking-[-0.02em] ${
                heroCliente ? 'text-ink' : 'text-white'
              }`}
            >
              {hero.titulo}
            </h3>
            <p
              className={`mt-2 text-[13.5px] leading-[1.55] ${
                heroCliente ? 'text-t2' : 'text-white/80'
              }`}
            >
              {hero.texto}
            </p>
          </div>

          {/* APOIO */}
          {apoio.map((ins, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="text-[17px] leading-none" aria-hidden>
                  {INSIGHT_ICON[ins.tipo] ?? '✦'}
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink">
                    {ins.titulo}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-[1.5] text-t2">
                    {ins.texto}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <p className="pt-1 text-[11px] text-t3">
            {heroCliente
              ? 'Análise da Lud. a partir dos seus dados do mês.'
              : 'Gerado por IA a partir dos dados reais do período · correlações são indicativas, não prova de causa.'}
          </p>
        </div>
      )}
    </div>
  );
}

// === ABAS ===
type Aba = 'geral' | 'conteudo' | 'publico' | 'insights';

function BarraAbas({ aba, onChange }: { aba: Aba; onChange: (a: Aba) => void }) {
  const abas: { id: Aba; label: string }[] = [
    { id: 'geral', label: 'Visão geral' },
    { id: 'conteudo', label: 'Conteúdo' },
    { id: 'insights', label: 'Insights' },
    { id: 'publico', label: 'Público' },
  ];
  return (
    <div className="flex gap-1 rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-1.5">
      {abas.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${
            aba === t.id ? 'bg-ink text-white' : 'text-t3 hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function AnalisePainel({
  a,
  insightsQuery,
  projetoId,
}: {
  a: IgAnalytics;
  /** Query string (igId/projetoId + período) pra chamar /api/instagram/insights. */
  insightsQuery?: string;
  /** projetoId (Notion) — habilita o bloco de Objetivo & Metas. */
  projetoId?: string;
}) {
  const [aba, setAba] = useState<Aba>('geral');

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

      {/* SEGUIDORES — primeiro, tamanho médio (persistente) */}
      <CabecalhoSeguidores a={a} />

      {/* FILEIRA DE KPIs (persistente) */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiDestaque
          destaque
          label="Views"
          valor={fmt(a.atual.views)}
          atual={a.atual.views}
          anterior={a.anterior.views}
        />
        <KpiDestaque
          label="Contas alcançadas"
          valor={fmt(a.atual.reach)}
          atual={a.atual.reach}
          anterior={a.anterior.reach}
        />
        <KpiDestaque
          label="Novos seguidores"
          valor={`${a.atual.novosSeguidores > 0 ? '+' : ''}${fmt(a.atual.novosSeguidores)}`}
          atual={a.atual.novosSeguidores}
          anterior={a.anterior.novosSeguidores}
        />
        <KpiDestaque
          label="Interações"
          valor={fmt(a.atual.interactions)}
          atual={a.atual.interactions}
          anterior={a.anterior.interactions}
        />
      </div>

      {/* OBJETIVO & METAS DO MÊS (persistente, todas as abas) */}
      <MetasObjetivo projetoId={projetoId} a={a} />

      {/* abas */}
      <BarraAbas aba={aba} onChange={setAba} />

      {aba === 'geral' && <AbaGeral a={a} />}
      {aba === 'conteudo' && <AbaConteudo a={a} />}
      {aba === 'insights' && <AbaInsights query={insightsQuery} />}
      {aba === 'publico' && <AbaPublico />}
    </div>
  );
}
