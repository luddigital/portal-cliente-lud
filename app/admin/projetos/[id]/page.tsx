import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  getProjetoDetalhe,
  listPostsDoMes,
  listTarefasPendentesDoCliente,
  type ProjetoConfig,
  type ProjetoDetalhe,
  type PostCalendario,
} from '@/lib/notion';
import { getGruposWhatsappDoProjeto, lerVisualizacoes } from '@/lib/supabase';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { grupoDaTarefa, type ItemPendencia } from '@/lib/pendencias-cliente';
import { getHotmartResumo, type HotmartResumo } from '@/lib/hotmart';
import { getMetaAdsRelatorio, getMetaAdsCampanhas, type CampanhaAds } from '@/lib/metaAds';
import { getIgAnalyticsDoProjeto, type IgAnalytics } from '@/lib/instagram';
import { env } from '@/lib/env';
import type { RelatorioAds } from '@/lib/csvAds';
import { CalendarMes } from '@/app/_components/CalendarMes';
import { resumoEntregas, type ResumoEntregas } from '@/lib/entregas';
import { EntregasKanban } from './EntregasKanban';
import { PendenciasCliente } from './PendenciasCliente';
import { EditarProjeto } from '../EditarProjeto';
import { FiltroPeriodo } from './FiltroPeriodo';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Resolve o período a partir da query (?inicio=&fim= tem prioridade sobre ?dias=). */
function resolverPeriodo(sp: Record<string, string | string[] | undefined>): {
  inicioMs: number;
  fimMs: number;
} {
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const inicio = str(sp.inicio);
  const fim = str(sp.fim);
  if (inicio && fim) {
    const i = Date.parse(`${inicio}T00:00:00`);
    const f = Date.parse(`${fim}T23:59:59`);
    if (!Number.isNaN(i) && !Number.isNaN(f) && i <= f) {
      return { inicioMs: i, fimMs: f };
    }
  }
  const dias = Number(str(sp.dias)) || 30;
  const agora = Date.now();
  return { inicioMs: agora - dias * DIA_MS, fimMs: agora };
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtDec = (n: number, d = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function fmtData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function MetricaCard({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: string;
  tom?: 'destaque' | 'sucesso';
}) {
  const cor =
    tom === 'destaque'
      ? { bg: 'var(--prazo-hoje-soft)', txt: 'var(--prazo-hoje)' }
      : tom === 'sucesso'
        ? { bg: 'var(--prazo-em-dia-soft)', txt: 'var(--prazo-em-dia)' }
        : null;
  return (
    <div
      className="rounded-xl border border-[rgba(21,21,33,0.08)] p-4"
      style={cor ? { background: cor.bg } : { background: 'var(--bgSoft)' }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: cor?.txt ?? 'var(--t3)' }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[20px] font-semibold tracking-[-0.02em]"
        style={{ color: cor?.txt ?? 'var(--ink)' }}
      >
        {valor}
      </div>
    </div>
  );
}

function PeriodoBadge({ inicio, fim }: { inicio: string; fim: string }) {
  return (
    <span className="rounded-full bg-bgSoft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-t2">
      {fmtData(inicio)} → {fmtData(fim)}
    </span>
  );
}

function VendasHotmart({ resumo }: { resumo: HotmartResumo }) {
  const moeda = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: resumo.moeda });
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SecTitle>Vendas (Hotmart)</SecTitle>
        <PeriodoBadge inicio={resumo.periodo.inicio} fim={resumo.periodo.fim} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MetricaCard label="Receita" valor={moeda(resumo.receitaTotal)} tom="sucesso" />
        <MetricaCard label="Vendas" valor={fmtNum(resumo.vendas)} />
        <MetricaCard
          label="Ticket médio"
          valor={resumo.ticketMedio != null ? moeda(resumo.ticketMedio) : '—'}
        />
      </div>
    </div>
  );
}

function TrafegoMeta({ relatorio }: { relatorio: RelatorioAds }) {
  const t = relatorio.totais;
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SecTitle>Tráfego pago (Meta)</SecTitle>
        <PeriodoBadge inicio={relatorio.periodo.inicio} fim={relatorio.periodo.fim} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        <MetricaCard label="Investimento" valor={fmtBRL(t.investimento)} tom="destaque" />
        {t.receita != null && (
          <MetricaCard label="Receita" valor={fmtBRL(t.receita)} tom="sucesso" />
        )}
        {t.roas != null && (
          <MetricaCard label="ROAS" valor={`${fmtDec(t.roas)}x`} tom="sucesso" />
        )}
        {t.compras != null && (
          <MetricaCard label="Compras" valor={fmtNum(t.compras)} />
        )}
        {t.custoPorCompra != null && (
          <MetricaCard label="Custo por compra" valor={fmtBRL(t.custoPorCompra)} />
        )}
        <MetricaCard label="Alcance" valor={fmtNum(t.alcance)} />
        {t.cliques != null && <MetricaCard label="Cliques" valor={fmtNum(t.cliques)} />}
        <MetricaCard label="CPM" valor={fmtBRL(t.cpm)} />
      </div>
      <p className="mt-3 text-[11px] text-t3">
        Dados ao vivo da conta de anúncios. Para o relatório completo com
        conjuntos e sugestões, use{' '}
        <Link href="/admin/trafego-pago" className="text-navy hover:underline">
          Tráfego pago
        </Link>
        .
      </p>
    </div>
  );
}

const OBJETIVO_LABEL: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_SALES: 'Vendas',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_APP_PROMOTION: 'App',
};

function CampanhaCard({ c }: { c: CampanhaAds }) {
  const t = c.relatorio?.totais;
  const r = c.resultado;
  const objLabel = OBJETIVO_LABEL[c.objetivo] ?? c.objetivo;
  // limpa prefixos tipo "TRÁFEGO | WHATSAPP | DISNEY CRUZEIRO" -> usa o nome cheio mesmo
  return (
    <div className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
          {c.nome}
        </h3>
        {objLabel && (
          <span className="rounded-full bg-bgSoft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-t2">
            {objLabel}
          </span>
        )}
      </div>

      {c.semDados || !t ? (
        <p className="mt-3 text-[12px] text-t3">
          Ainda sem veiculação no período selecionado.
        </p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          <MetricaCard label="Investimento" valor={fmtBRL(t.investimento)} tom="destaque" />
          {r.conversas != null && (
            <MetricaCard label="Conversas no WhatsApp" valor={fmtNum(r.conversas)} tom="sucesso" />
          )}
          {r.custoPorConversa != null && (
            <MetricaCard label="Custo por conversa" valor={fmtBRL(r.custoPorConversa)} />
          )}
          {r.linkClicks != null && (
            <MetricaCard label="Cliques no link" valor={fmtNum(r.linkClicks)} />
          )}
          {r.custoPorLinkClick != null && (
            <MetricaCard label="Custo por clique" valor={fmtBRL(r.custoPorLinkClick)} />
          )}
          {t.ctr != null && <MetricaCard label="CTR" valor={`${fmtDec(t.ctr, 2)}%`} />}
          <MetricaCard label="Alcance" valor={fmtNum(t.alcance)} />
          <MetricaCard label="CPM" valor={fmtBRL(t.cpm)} />
          {t.compras != null && <MetricaCard label="Compras" valor={fmtNum(t.compras)} />}
          {t.roas != null && (
            <MetricaCard label="ROAS" valor={`${fmtDec(t.roas)}x`} tom="sucesso" />
          )}
        </div>
      )}
    </div>
  );
}

function CampanhasMeta({ campanhas }: { campanhas: CampanhaAds[] }) {
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SecTitle>Tráfego pago (Meta) · por campanha</SecTitle>
        <span className="rounded-full bg-bgSoft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-t2">
          {campanhas.length} {campanhas.length === 1 ? 'campanha' : 'campanhas'}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {campanhas.map((c) => (
          <CampanhaCard key={c.id} c={c} />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-t3">
        Cada campanha somada no período, ao vivo da conta de anúncios. Relatório
        completo com conjuntos em{' '}
        <Link href="/admin/trafego-pago" className="text-navy hover:underline">
          Tráfego pago
        </Link>
        .
      </p>
    </div>
  );
}

/** Variação percentual entre período atual e anterior (null quando não dá pra comparar). */
function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sobe = pct >= 0;
  return (
    <span
      className="text-[11px] font-semibold"
      style={{ color: sobe ? 'var(--prazo-em-dia)' : 'var(--prazo-hoje)' }}
    >
      {sobe ? '↑' : '↓'} {fmtDec(Math.abs(pct), 1)}%
    </span>
  );
}

/** Card de métrica de Instagram com comparação opcional ao período anterior. */
function IgCard({
  label,
  valor,
  pct,
  destaque,
}: {
  label: string;
  valor: string;
  pct?: number | null;
  destaque?: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-[rgba(21,21,33,0.08)] p-4"
      style={{ background: destaque ? 'var(--prazo-em-dia-soft)' : 'var(--bgSoft)' }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
          {valor}
        </span>
        {pct !== undefined && <DeltaBadge pct={pct} />}
      </div>
    </div>
  );
}

function Instagram({ a }: { a: IgAnalytics }) {
  const taxaPct = a.taxaEngajamento * 100;
  const taxaAnterior =
    a.anterior.reach > 0 ? (a.anterior.interactions / a.anterior.reach) * 100 : 0;
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SecTitle>Instagram (orgânico)</SecTitle>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--prazo-em-dia-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--prazo-em-dia)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--prazo-em-dia)]" />
            ao vivo
          </span>
          <PeriodoBadge inicio={a.period.since} fim={a.period.until} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-t2">
        <span className="font-semibold text-ink">@{a.account.username}</span>
        <span className="text-t3">•</span>
        <span>{fmtNum(a.account.followersCount)} seguidores</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        <IgCard
          label="Novos seguidores"
          valor={`${a.atual.novosSeguidores >= 0 ? '+' : ''}${fmtNum(a.atual.novosSeguidores)}`}
          pct={variacao(a.atual.novosSeguidores, a.anterior.novosSeguidores)}
          destaque
        />
        <IgCard
          label="Alcance"
          valor={fmtNum(a.atual.reach)}
          pct={variacao(a.atual.reach, a.anterior.reach)}
        />
        <IgCard
          label="Contas engajadas"
          valor={fmtNum(a.atual.engagedAccounts)}
          pct={variacao(a.atual.engagedAccounts, a.anterior.engagedAccounts)}
        />
        <IgCard
          label="Interações"
          valor={fmtNum(a.atual.interactions)}
          pct={variacao(a.atual.interactions, a.anterior.interactions)}
        />
        <IgCard
          label="Taxa de engajamento"
          valor={`${fmtDec(taxaPct, 1)}%`}
          pct={variacao(taxaPct, taxaAnterior)}
        />
        <IgCard label="Visitas ao perfil" valor={fmtNum(a.atual.profileViews)} />
      </div>

      {a.topMedia.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-t3">
            Posts em destaque
          </h3>
          <ul className="mt-2 divide-y divide-[rgba(21,21,33,0.05)]">
            {a.topMedia.slice(0, 3).map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <a
                  href={m.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-navy hover:underline"
                >
                  {m.caption ? m.caption.replace(/\s+/g, ' ').slice(0, 80) : '(sem legenda)'}
                </a>
                <span className="shrink-0 text-[11px] text-t2">
                  {fmtNum(m.reach)} alc. · {fmtNum(m.interactions)} int.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[11px] text-t3">
        Comparado ao período anterior de mesmo tamanho. Para o relatório completo
        com gráficos e todos os posts, use{' '}
        <Link href="/admin/analise" className="text-navy hover:underline">
          Análise do Instagram
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Classifica uma tarefa pelo título — ordem importa (mais específico primeiro).
 * O agrupamento ajuda o admin a ver "X Materiais para Produção pendentes" sem
 * vasculhar uma lista enorme de 200+ tarefas (caso projetos como Ste Travels).
 */
export const dynamic = 'force-dynamic';

function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-t3">
      <span className="h-3 w-0.5 rounded-full bg-navy" />
      {children}
    </div>
  );
}

function temAlgumaMeta(m: ProjetoConfig['metas'][keyof ProjetoConfig['metas']]) {
  return !!(m.inicio || m.atual || m.meta);
}

const METRICAS: {
  chave: keyof ProjetoConfig['metas'];
  label: string;
}[] = [
  { chave: 'seguidores', label: 'Seguidores' },
  { chave: 'engajamento', label: 'Engajamento' },
  { chave: 'alcance', label: 'Alcance' },
];

// ============================================================================
// Página em abas: Calendário · Entregas · Desempenho · Ficha
// ============================================================================

type Aba = 'calendario' | 'entregas' | 'desempenho';

function normalizeAba(v: string | string[] | undefined): Aba {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === 'entregas' || s === 'desempenho') return s;
  return 'calendario';
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function resolveMes(v: string | string[] | undefined): { year: number; month: number } {
  const s = Array.isArray(v) ? v[0] : v;
  const m = s?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return { year: Number(m[1]), month: mo };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function deslocarMes(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function mesParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function hrefProjeto(id: string, aba: Aba, mes: string): string {
  const q = new URLSearchParams();
  if (aba !== 'calendario') q.set('aba', aba);
  q.set('mes', mes);
  return `/admin/projetos/${id}?${q.toString()}`;
}

function hojeISO(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

// ---- header ----------------------------------------------------------------

function ProjetoHeader({
  d,
  aba,
  year,
  month,
}: {
  d: ProjetoDetalhe;
  aba: Aba;
  year: number;
  month: number;
}) {
  const mostrarMes = aba === 'calendario' || aba === 'entregas';
  const prev = deslocarMes(year, month, -1);
  const next = deslocarMes(year, month, 1);
  const inicial = d.nome.trim()[0]?.toUpperCase() ?? '·';
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <Link href="/admin/projetos" className="text-[12px] text-mauve transition hover:text-ink">
          ← Projetos
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[16px] font-bold text-white"
            style={{ background: 'linear-gradient(150deg, #436F95, #1E476A)' }}
          >
            {inicial}
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{d.nome}</h1>
          {d.status && (
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{ background: 'var(--cal-publicado-soft)', color: 'var(--cal-publicado)' }}
            >
              ● {d.status}
            </span>
          )}
        </div>
        {(d.clienteNome || d.gestor) && (
          <div className="mt-1.5 pl-[52px] text-[12px] text-t2">
            {[d.clienteNome, d.gestor && `Gestor: ${d.gestor}`].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {mostrarMes && (
          <div className="flex items-center gap-2">
            <Link
              href={hrefProjeto(d.id, aba, mesParam(prev.year, prev.month))}
              className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[rgba(21,21,33,0.12)] bg-white text-t2 transition hover:bg-bgSoft"
              aria-label="Mês anterior"
            >
              ‹
            </Link>
            <span className="min-w-[128px] text-center text-[14px] font-semibold capitalize text-ink">
              {MESES[month - 1]} {year}
            </span>
            <Link
              href={hrefProjeto(d.id, aba, mesParam(next.year, next.month))}
              className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[rgba(21,21,33,0.12)] bg-white text-t2 transition hover:bg-bgSoft"
              aria-label="Próximo mês"
            >
              ›
            </Link>
          </div>
        )}
        <EditarProjeto projetoId={d.id} projetoNome={d.nome} configInicial={d.config} />
      </div>
    </div>
  );
}

// ---- banner + cards --------------------------------------------------------

function ChipResumo({ cor, n, txt }: { cor: string; n: number; txt: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,21,33,0.08)] bg-white px-3 py-1.5 text-[12px] font-semibold text-t1">
      <span className="h-2 w-2 rounded-full" style={{ background: cor }} />
      <span className="font-mono">{n}</span> {txt}
    </span>
  );
}

function StatCard({
  n,
  k,
  cor,
  borda,
}: {
  n: number;
  k: string;
  cor?: string;
  borda?: 'atrasada' | 'hoje';
}) {
  const bordaCor =
    borda === 'atrasada'
      ? 'rgba(110,42,44,0.25)'
      : borda === 'hoje'
        ? 'rgba(182,138,46,0.35)'
        : 'rgba(21,21,33,0.08)';
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: bordaCor }}>
      <div
        className="text-[30px] font-semibold leading-none tracking-[-0.03em]"
        style={{ color: cor ?? 'var(--ink)' }}
      >
        {n}
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-t3">{k}</div>
    </div>
  );
}

function BannerResumo({ resumo, id, mes }: { resumo: ResumoEntregas; id: string; mes: string }) {
  const nAtencao = resumo.atrasados + resumo.aguardandoCliente;
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(21,21,33,0.06)] bg-bgSoft p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
            {nAtencao > 0
              ? `${nAtencao} ${nAtencao === 1 ? 'coisa precisa' : 'coisas precisam'} de atenção`
              : 'Tudo em dia por aqui 🎉'}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-t2">
            Panorama do mês — o que está travado ou esperando alguém agir.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ChipResumo cor="var(--prazo-atrasado)" n={resumo.atrasados} txt="atrasados" />
            <ChipResumo cor="var(--cal-aguardando)" n={resumo.aguardandoCliente} txt="aguardando cliente" />
            <ChipResumo cor="var(--cal-aprovacao)" n={resumo.aprovacaoHoje} txt="aprovação hoje" />
          </div>
        </div>
        {resumo.atrasados > 0 && (
          <Link href={hrefProjeto(id, 'entregas', mes)} className="btn-primary shrink-0 self-start">
            Ver atrasados →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <StatCard n={resumo.total} k="Posts no mês" />
        <StatCard n={resumo.publicados} k="Publicados" cor="var(--cal-publicado)" />
        <StatCard n={resumo.emProducao} k="Em produção" cor="var(--cal-agendado)" />
        <StatCard n={resumo.aguardandoCliente} k="Aguardando cliente" cor="var(--cal-aprovacao)" borda="hoje" />
        <StatCard n={resumo.atrasados} k="Atrasados" cor="var(--hubRed)" borda="atrasada" />
      </div>
    </div>
  );
}

// ---- tab nav ---------------------------------------------------------------

function TabNav({
  id,
  aba,
  mes,
  atrasados,
}: {
  id: string;
  aba: Aba;
  mes: string;
  atrasados: number;
}) {
  const tabs: { id: Aba; label: string; badge?: number }[] = [
    { id: 'calendario', label: '📅 Calendário' },
    { id: 'entregas', label: '📦 Entregas', badge: atrasados },
    { id: 'desempenho', label: '📊 Desempenho' },
  ];
  return (
    <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[rgba(21,21,33,0.08)]">
      {tabs.map((t) => {
        const on = t.id === aba;
        return (
          <Link
            key={t.id}
            href={hrefProjeto(id, t.id, mes)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-[13.5px] font-semibold transition ${
              on ? 'border-ink text-ink' : 'border-transparent text-t3 hover:text-t2'
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className="rounded-full bg-[var(--prazo-atrasado)] px-1.5 text-[10px] font-bold text-white">
                {t.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

// ---- abas ------------------------------------------------------------------

function CalendarioTab({
  posts,
  year,
  month,
}: {
  posts: PostCalendario[];
  year: number;
  month: number;
}) {
  const legenda: [string, string][] = [
    ['publicado', 'Publicado'],
    ['agendado', 'Em produção'],
    ['aprovacao', 'Aprovação'],
    ['alteracao', 'Em alteração'],
    ['aguardando', 'Aguardando cliente'],
    ['rascunho', 'Rascunho'],
  ];
  return (
    <div>
      <CalendarMes year={year} month={month} posts={posts} />
      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2 text-[11.5px] text-t2">
        {legenda.map(([cor, label]) => (
          <span key={cor} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: `var(--cal-${cor})` }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

async function DesempenhoTab({
  id,
  inicioMs,
  fimMs,
  config,
}: {
  id: string;
  inicioMs: number;
  fimMs: number;
  config: ProjetoConfig;
}) {
  const [hotmart, ads, campanhas, ig] = await Promise.all([
    getHotmartResumo(id, inicioMs, fimMs),
    getMetaAdsRelatorio(id, inicioMs, fimMs),
    getMetaAdsCampanhas(id, inicioMs, fimMs),
    getIgAnalyticsDoProjeto(id, inicioMs, fimMs),
  ]);
  const temAlgo = !!(hotmart || ads || (campanhas && campanhas.length > 0) || ig);
  const igId = env.instagram.accounts[id];
  return (
    <div className="space-y-6">
      <ObjetivoMetas config={config} />
      {igId && (
        <Link
          href={`/admin/analise?igId=${encodeURIComponent(igId)}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white px-5 py-4 transition hover:border-navy/30 hover:bg-bgSoft"
        >
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">
              Análise completa do Instagram
            </div>
            <div className="text-[12px] text-t2">
              Insights de IA, público e demografia — na página de Análise.
            </div>
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-navy">Abrir →</span>
        </Link>
      )}
      {temAlgo && <FiltroPeriodo />}
      {ig && <Instagram a={ig} />}
      {campanhas && campanhas.length > 0 && <CampanhasMeta campanhas={campanhas} />}
      {ads && <TrafegoMeta relatorio={ads} />}
      {hotmart && <VendasHotmart resumo={hotmart} />}
      {!temAlgo && (
        <div className="card p-8 text-center text-[13px] text-t3">
          Nenhuma integração (Instagram, Meta Ads ou Hotmart) configurada para
          este projeto ainda.
        </div>
      )}
    </div>
  );
}

/** Objetivo + metas do projeto — mostrado no topo da aba Desempenho (as metas
 *  fazem sentido junto dos números). Editável pelo botão "Editar projeto". */
function ObjetivoMetas({ config }: { config: ProjetoConfig }) {
  const temMetas = METRICAS.some((m) => temAlgumaMeta(config.metas[m.chave]));
  if (!config.objetivo && !temMetas) return null;
  return (
    <div className="card p-6">
      <SecTitle>Objetivo &amp; Metas</SecTitle>
      {config.objetivo ? (
        <>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.55] text-ink">
            {config.objetivo}
          </p>
          {config.foco.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {config.foco.map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-bgSoft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-t2"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-[13px] text-t3">
          Sem objetivo cadastrado. Use "Editar projeto" pra preencher.
        </p>
      )}

      {temMetas && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {METRICAS.filter((m) => temAlgumaMeta(config.metas[m.chave])).map((m) => {
            const v = config.metas[m.chave];
            return (
              <div key={m.chave} className="rounded-xl bg-bgSoft p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                  {m.label}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  {v.inicio && <span className="text-[12px] text-t3">{v.inicio}</span>}
                  <span className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
                    {v.atual || '—'}
                  </span>
                  {v.meta && <span className="text-[12px] text-t3">→ {v.meta}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- pendências com o cliente + mensagem geral -----------------------------

/** O que está na vez do cliente (mesma regra da home dele), dividido por entrega. */
async function PendenciasSection({
  id,
  clienteNome,
}: {
  id: string;
  clienteNome: string;
}) {
  let pendentes;
  try {
    pendentes = await listTarefasPendentesDoCliente([id]);
  } catch (err: any) {
    console.warn('[projeto] pendências do cliente:', err?.message);
    return (
      <p className="rounded-md border border-[rgba(0,0,0,0.09)] px-4 py-3 text-[12px] text-[#787774]">
        Não consegui carregar as pendências do cliente agora. Recarregue a página em
        instantes.
      </p>
    );
  }

  const [grupos, textos, vistas] = await Promise.all([
    getGruposWhatsappDoProjeto(id).catch(() => []),
    lerMensagensEditadas().catch(() => ({}) as Record<string, string>),
    lerVisualizacoes(pendentes.map((p) => p.postId)).catch(
      () => ({}) as Awaited<ReturnType<typeof lerVisualizacoes>>,
    ),
  ]);

  const itens = pendentes.map((p) => {
    const base: ItemPendencia = {
      tarefaId: p.tarefaId,
      tarefaTitulo: p.tarefaTitulo,
      postId: p.postId,
      postTitulo: p.postTitulo,
      postData: p.postData,
      prazo: p.tarefaPrazo,
      link: `${env.app.url}/post/${p.postId}?tarefa=${p.tarefaId}`,
      grupo: grupoDaTarefa(p.tarefaTitulo),
    };
    const v = vistas[p.postId];
    return { ...base, visto: v ? { ultima: v.ultima, total: v.total } : null };
  });

  return (
    <PendenciasCliente
      projetoId={id}
      clienteNome={clienteNome}
      gruposWpp={grupos.map((g) => ({ id: g.id, nome: g.nome, apelido: g.apelido?.trim() || null }))}
      itens={itens}
      textos={textos}
      hojeIso={hojeEmSaoPaulo()}
    />
  );
}

// ---- shell + página --------------------------------------------------------

async function ProjetoShell({
  id,
  aba,
  year,
  month,
  inicioMs,
  fimMs,
}: {
  id: string;
  aba: Aba;
  year: number;
  month: number;
  inicioMs: number;
  fimMs: number;
}) {
  const [d, posts] = await Promise.all([
    getProjetoDetalhe(id),
    listPostsDoMes([id], year, month),
  ]);
  if (!d) notFound();

  const hoje = hojeISO();
  const resumo = resumoEntregas(posts, hoje);
  const mes = mesParam(year, month);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <ProjetoHeader d={d} aba={aba} year={year} month={month} />
      <BannerResumo resumo={resumo} id={id} mes={mes} />
      <TabNav id={id} aba={aba} mes={mes} atrasados={resumo.atrasados} />
      <div className="mt-5">
        {aba === 'calendario' && <CalendarioTab posts={posts} year={year} month={month} />}
        {aba === 'entregas' && (
          <div className="space-y-8">
            <Suspense
              fallback={<div className="h-[180px] animate-pulse rounded-md bg-[#F4F4F2]" />}
            >
              <PendenciasSection id={id} clienteNome={d.clienteNome ?? d.nome} />
            </Suspense>
            <EntregasKanban posts={posts} hojeIso={hoje} />
          </div>
        )}
        {aba === 'desempenho' && (
          <Suspense fallback={<div className="h-[320px] animate-pulse rounded-2xl bg-bgSoft" />}>
            <DesempenhoTab id={id} inicioMs={inicioMs} fimMs={fimMs} config={d.config} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default function ProjetoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const aba = normalizeAba(searchParams.aba);
  const { year, month } = resolveMes(searchParams.mes);
  const { inicioMs, fimMs } = resolverPeriodo(searchParams);
  return (
    <div className="min-h-screen bg-bg pb-16">
      <Suspense
        key={`${aba}-${year}-${month}-${inicioMs}-${fimMs}`}
        fallback={
          <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
            <div className="h-[52px] w-64 rounded-xl bg-bgSoft" />
            <div className="mt-5 h-[140px] animate-pulse rounded-2xl bg-bgSoft" />
            <div className="mt-6 h-[420px] animate-pulse rounded-2xl bg-bgSoft" />
          </div>
        }
      >
        <ProjetoShell id={params.id} aba={aba} year={year} month={month} inicioMs={inicioMs} fimMs={fimMs} />
      </Suspense>
    </div>
  );
}
