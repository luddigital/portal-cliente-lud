'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IgAnalytics, IgMediaItem } from '@/lib/instagram';
import type { AnaliseIA } from '@/lib/insights';
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
  // O Instagram só entrega o crescimento DIÁRIO de seguidores dos últimos ~30
  // dias. Em ranges maiores, o "+N" cobre só essa janela — deixamos explícito.
  const diasDados = a.serieSeguidores.length;
  const parcial = diasDados > 0 && diasDados < a.period.dias - 3;
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
        <span className="text-[12px] text-t3">
          {parcial ? `· últimos ${diasDados} dias` : 'no período'}
        </span>
      </div>
      {parcial && (
        <p className="mt-2 text-[11px] leading-snug text-t3">
          ℹ️ O Instagram só entrega o crescimento diário de seguidores dos
          últimos ~30 dias, então esse{' '}
          <span className="font-semibold">
            {novos > 0 ? '+' : ''}
            {fmt(novos)}
          </span>{' '}
          não cobre o período todo. O número total ao lado está sempre
          atualizado.
        </p>
      )}
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
  if (!objetivo && barras.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[rgba(21,21,33,0.16)] bg-bgSoft p-5 sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-t3">
          Objetivo do mês
        </div>
        <p className="mt-1.5 text-[13px] text-t2">
          Esse projeto ainda não tem objetivo e metas definidos.
          {projetoId ? (
            <>
              {' '}
              <a
                href={`/admin/projetos/${projetoId}`}
                className="font-semibold text-navy underline underline-offset-2"
              >
                Definir agora →
              </a>
            </>
          ) : null}
        </p>
      </div>
    );
  }

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
  icon,
}: {
  label: string;
  valor: string;
  atual?: number;
  anterior?: number;
  icon?: string;
}) {
  const d = atual != null && anterior != null ? delta(atual, anterior) : null;
  const positivo = (atual ?? 0) >= (anterior ?? 0);
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-[rgba(21,21,33,0.09)] bg-white p-5 shadow-[0_1px_2px_rgba(21,21,33,0.03)] transition-colors hover:bg-ink">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-[14px] leading-none opacity-70" aria-hidden>
            {icon}
          </span>
        )}
        <span className="text-[12px] font-medium text-t2 transition-colors group-hover:text-white/70">
          {label}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="text-[30px] font-semibold tracking-[-0.03em] leading-none text-ink transition-colors group-hover:text-white sm:text-[34px]">
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
      {d && (
        <div className="mt-1 text-[11px] text-t3 transition-colors group-hover:text-white/50">
          vs. período anterior
        </div>
      )}
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
      <div className="mt-5 flex h-11 w-full overflow-hidden rounded-2xl text-[13px] font-semibold">
        <div
          className="flex items-center justify-center text-white"
          style={{ width: `${pctSeg}%`, background: 'var(--navy)' }}
        >
          {pctSeg >= 10 ? `${pctSeg.toFixed(1)}%` : ''}
        </div>
        <div
          className="flex items-center justify-center text-ink"
          style={{ width: `${pctNao}%`, background: 'var(--lavender)' }}
        >
          {pctNao >= 10 ? `${pctNao.toFixed(1)}%` : ''}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: 'var(--navy)' }}
          />
          <span>
            <span className="font-semibold text-ink">
              {fmt(publico.seguidores)}
            </span>{' '}
            <span className="text-t3">seguidores</span>
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: 'var(--lavender)' }}
          />
          <span>
            <span className="font-semibold text-ink">
              {fmt(publico.naoSeguidores)}
            </span>{' '}
            <span className="text-t3">não-seguidores</span>
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
  | 'shares'
  | 'seguidores';

const METRICA_OPTS: { c: CriterioOrdem; label: string }[] = [
  { c: 'views', label: 'Views' },
  { c: 'reach', label: 'Alcance' },
  { c: 'interactions', label: 'Interações' },
  { c: 'seguidores', label: 'Seguidores' },
  { c: 'likes', label: 'Curtidas' },
  { c: 'comments', label: 'Comentários' },
  { c: 'saved', label: 'Salvos' },
  { c: 'shares', label: 'Compart.' },
];

const LABEL_METRICA = Object.fromEntries(
  METRICA_OPTS.map((o) => [o.c, o.label]),
) as Record<CriterioOrdem, string>;

function MediaCard({
  m,
  comSeguidores,
}: {
  m: IgMediaItem;
  comSeguidores?: boolean;
}) {
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
      </div>

      {/* card embaixo — branco/soft, sem gradient pesado */}
      <div className="px-5 py-4">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
          {m.caption || 'Sem legenda'}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-[rgba(21,21,33,0.06)] pt-3">
          <StatCell icon="▶" label="Views" valor={m.views} />
          <StatCell icon="👁" label="Alcance" valor={m.reach} />
          {comSeguidores && (
            <StatCell icon="👥" label="Seguidores" valor={m.seguidores} />
          )}
          <StatCell icon="♡" label="Curtidas" valor={m.likes} />
          <StatCell icon="💬" label="Coment." valor={m.comments} />
          <StatCell icon="↗" label="Compart." valor={m.shares} />
          <StatCell icon="🔖" label="Salvos" valor={m.saved} />
        </div>
      </div>
    </a>
  );
}

// Célula de dado padronizada: número em cima, emoji + legenda embaixo.
function StatCell({
  icon,
  label,
  valor,
  align = 'left',
}: {
  icon: string;
  label: string;
  valor: number;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="text-[15px] font-semibold leading-none text-ink tabular-nums">
        {fmt(valor)}
      </div>
      <div className="mt-1 whitespace-nowrap text-[10px] text-t3">
        <span aria-hidden>{icon}</span> {label}
      </div>
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

// === LINHA DE CONTEÚDO (lista da aba Conteúdo — dados em colunas) ===
function ContentRow({
  m,
  criterio,
  comSeguidores,
}: {
  m: IgMediaItem;
  criterio: CriterioOrdem;
  comSeguidores?: boolean;
}) {
  const data = m.timestamp
    ? new Date(m.timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })
    : '';
  const colunas: { c: CriterioOrdem; label: string; icon: string; valor: number }[] = [
    { c: 'views', label: 'Views', icon: '▶', valor: m.views },
    { c: 'reach', label: 'Alcance', icon: '👁', valor: m.reach },
    ...(comSeguidores
      ? [
          {
            c: 'seguidores' as CriterioOrdem,
            label: 'Seguidores',
            icon: '👥',
            valor: m.seguidores,
          },
        ]
      : []),
    { c: 'likes', label: 'Curtidas', icon: '♡', valor: m.likes },
    { c: 'comments', label: 'Coment.', icon: '💬', valor: m.comments },
    { c: 'shares', label: 'Compart.', icon: '↗', valor: m.shares },
    { c: 'saved', label: 'Salvos', icon: '🔖', valor: m.saved },
  ];
  return (
    <a
      href={m.permalink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 border-b border-[rgba(21,21,33,0.06)] py-2.5 transition last:border-b-0 hover:bg-bgSoft"
    >
      <div className="relative h-11 w-9 shrink-0 overflow-hidden rounded-lg bg-bgSoft">
        {m.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      {/* legenda — espaço limitado */}
      <div className="min-w-0 basis-[32%] shrink-0 pr-2">
        <div className="truncate text-[12.5px] font-medium text-ink">
          {m.caption || 'Sem legenda'}
        </div>
        <div className="mt-0.5 text-[11px] text-t3">
          {formatoLabel(m.mediaType, m.caption)}
          {data ? ` · ${data}` : ''}
        </div>
      </div>
      {/* colunas de dados em evidência */}
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        {colunas.map((col) => {
          const ativo = col.c === criterio;
          return (
            <div
              key={col.c}
              className={`w-[54px] text-right tabular-nums ${
                ativo ? '' : 'hidden sm:block'
              }`}
            >
              <div
                className={`text-[14px] font-semibold leading-none ${
                  ativo ? 'text-ink' : 'text-t2'
                }`}
              >
                {fmt(col.valor)}
              </div>
              <div className="mt-1 whitespace-nowrap text-[10px] text-t3">
                <span aria-hidden>{col.icon}</span> {col.label}
              </div>
            </div>
          );
        })}
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

      <div className="space-y-4">
        {a.serieSeguidores.length > 0 && (
          <GraficoBarras
            dados={a.serieSeguidores}
            label="Novos seguidores por dia"
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

      {/* Views por tipo de conteúdo — por último */}
      {a.viewsPorTipo.length > 0 && <ViewsPorTipo itens={a.viewsPorTipo} />}
    </div>
  );
}

// === ABA CONTEÚDO (busca + filtro por métrica + lista) ===
function AbaConteudo({ a }: { a: IgAnalytics }) {
  const [busca, setBusca] = useState('');
  const [criterio, setCriterio] = useState<CriterioOrdem>('views');
  const [tipo, setTipo] = useState<string>('Todos');
  const [ordem, setOrdem] = useState<'desc' | 'asc'>('desc');

  const tipos = useMemo(() => {
    const s = new Set(
      a.conteudos.map((m) => formatoLabel(m.mediaType, m.caption)),
    );
    return ['Todos', ...[...s].sort()];
  }, [a.conteudos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = a.conteudos
      .filter(
        (m) => tipo === 'Todos' || formatoLabel(m.mediaType, m.caption) === tipo,
      )
      .filter((m) => !q || (m.caption || '').toLowerCase().includes(q))
      .sort((x, y) => y[criterio] - x[criterio]);
    return ordem === 'asc' ? arr.reverse() : arr;
  }, [a.conteudos, busca, tipo, criterio, ordem]);

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

      {/* filtros — agrupados numa linha só */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-full border border-[rgba(21,21,33,0.12)] bg-white pl-3 pr-1 text-[12px]">
          <span className="text-t3">Ordenar por</span>
          <select
            value={criterio}
            onChange={(e) => setCriterio(e.target.value as CriterioOrdem)}
            className="cursor-pointer rounded-full bg-transparent py-2 pl-1 pr-1 font-semibold text-ink outline-none"
          >
            {METRICA_OPTS.filter(
              (o) => o.c !== 'seguidores' || a.temSeguidoresPorPost,
            ).map((o) => (
              <option key={o.c} value={o.c}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setOrdem((o) => (o === 'desc' ? 'asc' : 'desc'))}
          title="Alternar entre melhores e piores do período"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
        >
          {ordem === 'desc' ? '🏆 Melhores primeiro' : '⚠️ Piores primeiro'}
        </button>

        {tipos.length > 2 && (
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="cursor-pointer rounded-full border border-[rgba(21,21,33,0.12)] bg-white px-3 py-2 text-[12px] font-medium text-ink outline-none"
          >
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t === 'Todos' ? 'Todos os tipos' : t}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* destaques — melhores OU piores conforme a ordem */}
      {destaques.length >= 3 && !busca && (
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink">
            {ordem === 'desc' ? '🏆 Melhores do período' : '⚠️ Piores do período'}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {destaques.map((m) => (
              <MediaCard
                key={m.id}
                m={m}
                comSeguidores={a.temSeguidoresPorPost}
              />
            ))}
          </div>
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
            <ContentRow
              key={m.id}
              m={m}
              criterio={criterio}
              comSeguidores={a.temSeguidoresPorPost}
            />
          ))
        )}
      </div>
    </div>
  );
}

// === ABA PÚBLICO ===
// Lista de barras genérica (gênero, idade, países, cidades).
function ListaBarras({
  titulo,
  itens,
  formatKey,
}: {
  titulo: string;
  itens: { chave: string; valor: number }[];
  formatKey?: (k: string) => string;
}) {
  if (itens.length === 0) return null;
  const total = itens.reduce((acc, i) => acc + i.valor, 0);
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <div className="rounded-2xl border border-[rgba(21,21,33,0.06)] bg-bgSoft p-5 sm:p-6">
      <h3 className="text-[13px] font-semibold text-ink">{titulo}</h3>
      <div className="mt-4 space-y-3">
        {itens.map((i) => {
          const pct = total > 0 ? (i.valor / total) * 100 : 0;
          return (
            <div key={i.chave}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                <span className="font-medium text-ink">
                  {formatKey ? formatKey(i.chave) : i.chave}
                </span>
                <span className="text-t3">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgba(21,21,33,0.06)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(i.valor / max) * 100}%`, background: 'var(--navy)' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

const PAIS_NOME: Record<string, string> = {
  BR: '🇧🇷 Brasil', PT: '🇵🇹 Portugal', US: '🇺🇸 Estados Unidos', FR: '🇫🇷 França',
  ES: '🇪🇸 Espanha', IT: '🇮🇹 Itália', DE: '🇩🇪 Alemanha', GB: '🇬🇧 Reino Unido',
  AR: '🇦🇷 Argentina', CA: '🇨🇦 Canadá', CH: '🇨🇭 Suíça', MX: '🇲🇽 México',
  CL: '🇨🇱 Chile', CO: '🇨🇴 Colômbia', NL: '🇳🇱 Holanda', BE: '🇧🇪 Bélgica',
  AU: '🇦🇺 Austrália', JP: '🇯🇵 Japão', IE: '🇮🇪 Irlanda',
};

function generoLabel(k: string): string {
  const u = k.trim().toUpperCase();
  if (u.startsWith('F')) return 'Mulheres';
  if (u.startsWith('M')) return 'Homens';
  return 'Outros';
}

function paisLabel(code: string): string {
  return PAIS_NOME[code.trim().toUpperCase()] ?? code;
}

function AbaPublico({ a }: { a: IgAnalytics }) {
  const demo = a.demografia;
  const idadeOrdenada = demo
    ? [...demo.idade].sort(
        (x, y) => AGE_ORDER.indexOf(x.chave) - AGE_ORDER.indexOf(y.chave),
      )
    : [];
  return (
    <div className="space-y-4">
      {a.publico && <SplitPublico publico={a.publico} />}

      {demo ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ListaBarras titulo="Gênero" itens={demo.genero} formatKey={generoLabel} />
            <ListaBarras titulo="Top países" itens={demo.paises} formatKey={paisLabel} />
          </div>
          {idadeOrdenada.length > 0 && (
            <ListaBarras titulo="Faixa etária" itens={idadeOrdenada} />
          )}
          {demo.cidades.length > 0 && (
            <ListaBarras titulo="Top cidades" itens={demo.cidades} />
          )}
          <p className="px-1 text-[11px] text-t3">
            📸 Foto do momento — a API do Instagram não guarda histórico de
            demografia. (Em breve: snapshots pra ver a evolução.)
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-8 text-center">
          <div className="text-[13px] font-semibold text-ink">
            Demografia indisponível
          </div>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-t3">
            A conta não expõe a demografia dos seguidores nesta versão da API
            (precisa de 100+ seguidores).
          </p>
        </div>
      )}
    </div>
  );
}

// === ABA INSIGHTS — análise do período (layout editorial) ===

/** Leitura curta de um post a partir dos próprios números (determinística). */
function leituraDoPost(m: IgMediaItem, maxViews: number): string {
  const salvRate = m.views > 0 ? m.saved / m.views : 0;
  const shareRate = m.views > 0 ? m.shares / m.views : 0;
  if (m.seguidores > 0)
    return `Trouxe ${fmt(m.seguidores)} ${m.seguidores === 1 ? 'seguidor' : 'seguidores'} no período.`;
  if (maxViews > 0 && m.views >= maxViews * 0.9)
    return 'Seu conteúdo de maior alcance no período.';
  if (salvRate > 0.02)
    return 'Campeão de salvamento: o público guardou pra usar depois.';
  if (shareRate > 0.01)
    return 'Muito compartilhado: as pessoas indicaram pra outras.';
  if (m.comments >= 100) return 'Gerou bastante conversa nos comentários.';
  return 'Boa entrega de alcance no período.';
}

function BlocoAnalise({
  icon,
  label,
  cor,
  texto,
}: {
  icon: string;
  label: string;
  cor: string;
  texto: string;
}) {
  if (!texto) return null;
  return (
    <div className="mt-5" style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 14 }}>
      <div
        className="text-[11px] font-bold uppercase tracking-[0.1em]"
        style={{ color: cor }}
      >
        {icon} {label}
      </div>
      <p className="mt-1.5 text-[14px] leading-[1.55] text-ink">{texto}</p>
    </div>
  );
}

function AbaInsights({
  analise,
  a,
  erro,
  carregando,
  onAtualizar,
}: {
  analise: AnaliseIA | null;
  a: IgAnalytics;
  erro: string;
  carregando: boolean;
  onAtualizar: () => void;
}) {
  const temAnalise =
    analise &&
    (analise.resumo || analise.funcionou || analise.sugestoes.length > 0);

  const maxViews = Math.max(0, ...a.conteudos.map((m) => m.views));
  const melhores = [...a.conteudos]
    .sort((x, y) => y.views - x.views || y.interactions - x.interactions)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Insights do período
          </h2>
          <p className="text-[12px] text-t2">
            Análise dos dados do período e o que fazer no próximo.
          </p>
        </div>
        <button
          type="button"
          onClick={onAtualizar}
          disabled={carregando}
          className="rounded-full bg-bgSoft px-4 py-2 text-[12px] font-semibold text-t2 transition hover:text-ink disabled:opacity-50"
        >
          {carregando ? 'Analisando…' : '↻ Atualizar'}
        </button>
      </div>

      {carregando && !analise && (
        <div className="h-[420px] animate-pulse rounded-3xl bg-bgSoft" />
      )}

      {erro && !carregando && (
        <p className="rounded-lg bg-redSoft px-4 py-3 text-[13px] text-crimson">
          {erro}
        </p>
      )}

      {analise && !erro && !temAnalise && !carregando && (
        <p className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-6 text-center text-[13px] text-t3">
          Ainda não dá pra analisar esse período — publique mais conteúdo ou
          amplie a janela de datas.
        </p>
      )}

      {temAnalise && analise && (
        <div className="rounded-3xl border border-[rgba(21,21,33,0.08)] bg-white p-6 sm:p-7">
          {/* headline */}
          {analise.resumo && (
            <p className="text-[19px] font-semibold leading-snug tracking-[-0.02em] text-ink">
              {analise.resumo}
            </p>
          )}

          {/* placar */}
          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.06)] sm:grid-cols-4">
            {[
              { l: 'Seguidores', v: fmtCompacto(a.account.followersCount) },
              { l: 'Views', v: fmtCompacto(a.atual.views) },
              { l: 'Alcance', v: fmtCompacto(a.atual.reach) },
              {
                l: 'Novos seguidores',
                v: `${a.atual.novosSeguidores > 0 ? '+' : ''}${fmtCompacto(a.atual.novosSeguidores)}`,
              },
            ].map((k, i) => (
              <div
                key={k.l}
                className={`p-3.5 ${i > 0 ? 'border-l border-[rgba(21,21,33,0.06)]' : ''}`}
              >
                <div className="text-[20px] font-bold tracking-[-0.02em] text-ink">
                  {k.v}
                </div>
                <div className="text-[11px] text-t3">{k.l}</div>
              </div>
            ))}
          </div>

          {/* blocos */}
          <BlocoAnalise icon="✅" label="O que funcionou" cor="var(--fern)" texto={analise.funcionou} />
          <BlocoAnalise icon="⚠️" label="O que evitar" cor="var(--crimson)" texto={analise.evitar} />
          <BlocoAnalise icon="👥" label="Quem estamos atraindo" cor="var(--navy)" texto={analise.publico} />
          <BlocoAnalise icon="📈" label="Seguidores" cor="#B68A2E" texto={analise.seguidores} />

          {/* melhores conteúdos com leitura */}
          {melhores.length > 0 && (
            <div className="mt-6 border-t border-[rgba(21,21,33,0.06)] pt-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-t3">
                Melhores conteúdos
              </div>
              <div className="mt-3 space-y-4">
                {melhores.map((m) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-bgSoft">
                      {m.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">
                        {m.caption || 'Sem legenda'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-t3">
                        {formatoLabel(m.mediaType, m.caption)} · ▶ {fmt(m.views)} ·
                        👁 {fmt(m.reach)}
                      </div>
                      <div className="mt-1.5 rounded-lg bg-bgSoft px-3 py-2 text-[12.5px] text-ink">
                        {leituraDoPost(m, maxViews)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* próximo período */}
          {analise.sugestoes.length > 0 && (
            <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#F1EBE5] to-[#F4F6FB] p-5">
              <div className="text-[14px] font-bold text-ink">
                🚀 Pro próximo período
              </div>
              <ol className="mt-3 space-y-2.5">
                {analise.sugestoes.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-[1.5] text-ink">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="mt-5 text-[11px] text-t3">
            Feito a partir dos dados reais do período. Atualiza a cada leitura.
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

  // Pré-carrega os insights de IA assim que a página abre (em segundo plano),
  // pra quando a pessoa clicar na aba eles já estarem prontos.
  const [analise, setAnalise] = useState<AnaliseIA | null>(null);
  const [erroIns, setErroIns] = useState('');
  const [carregandoIns, setCarregandoIns] = useState(false);

  const carregarInsights = useCallback(
    (refresh: boolean) => {
      if (!insightsQuery) return;
      setCarregandoIns(true);
      setErroIns('');
      fetch(`/api/instagram/insights?${insightsQuery}${refresh ? '&refresh=1' : ''}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.error) setErroIns(j.error);
          else if (j.analise) setAnalise(j.analise);
        })
        .catch((e) => setErroIns(String(e?.message ?? e)))
        .finally(() => setCarregandoIns(false));
    },
    [insightsQuery],
  );

  useEffect(() => {
    carregarInsights(false);
  }, [carregarInsights]);

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

      {/* KPIs PRINCIPAIS */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiDestaque
          icon="👁"
          label="Views"
          valor={fmt(a.atual.views)}
          atual={a.atual.views}
          anterior={a.anterior.views}
        />
        <KpiDestaque
          icon="🌍"
          label="Contas alcançadas"
          valor={fmt(a.atual.reach)}
          atual={a.atual.reach}
          anterior={a.anterior.reach}
        />
        <KpiDestaque
          icon="👥"
          label="Novos seguidores"
          valor={`${a.atual.novosSeguidores > 0 ? '+' : ''}${fmt(a.atual.novosSeguidores)}`}
          atual={a.atual.novosSeguidores}
          anterior={a.anterior.novosSeguidores}
        />
        <KpiDestaque
          icon="💬"
          label="Interações"
          valor={fmt(a.atual.interactions)}
          atual={a.atual.interactions}
          anterior={a.anterior.interactions}
        />
      </div>

      {/* KPIs SECUNDÁRIOS */}
      <div className="grid gap-2 sm:grid-cols-3">
        <KpiDestaque
          icon="✨"
          label="Contas engajadas"
          valor={fmt(a.atual.engagedAccounts)}
          atual={a.atual.engagedAccounts}
          anterior={a.anterior.engagedAccounts}
        />
        <KpiDestaque
          icon="👤"
          label="Visitas ao perfil"
          valor={fmt(a.atual.profileViews)}
          atual={a.atual.profileViews}
          anterior={a.anterior.profileViews}
        />
        <KpiDestaque
          icon="📈"
          label="Taxa de engajamento"
          valor={`${(a.taxaEngajamento * 100).toFixed(1)}%`}
        />
      </div>

      {/* OBJETIVO & METAS DO MÊS (persistente, todas as abas) */}
      <MetasObjetivo projetoId={projetoId} a={a} />

      {/* abas */}
      <BarraAbas aba={aba} onChange={setAba} />

      {aba === 'geral' && <AbaGeral a={a} />}
      {aba === 'conteudo' && <AbaConteudo a={a} />}
      {aba === 'insights' && (
        <AbaInsights
          analise={analise}
          a={a}
          erro={erroIns}
          carregando={carregandoIns}
          onAtualizar={() => carregarInsights(true)}
        />
      )}
      {aba === 'publico' && <AbaPublico a={a} />}
    </div>
  );
}
