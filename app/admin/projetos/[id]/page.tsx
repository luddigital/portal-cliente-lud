import { projetoDoPortal, type ProjetoNoPortal } from '@/lib/conteudo-portal';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { classificarProjeto } from '@/lib/projetoServico';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import {
  getCapaDoProjetoNotion,
  getHorarioDoProjeto,
  getProjetoDetalhe,
  listAllClientes,
  listPostsDoMes,
  listTarefasPendentesDoCliente,
  type ProjetoConfig,
  type ProjetoDetalhe,
  type PostCalendario,
  listAllProjetos,
  getPostsPorMes,
} from '@/lib/notion';
import {
  getGruposWhatsappDoProjeto,
  lerCustomizacaoProjeto,
  lerVisualizacoes,
  listarMensagens,
  lerEnviosDoProjeto,
} from '@/lib/supabase';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { grupoDaTarefa, type ItemPendencia } from '@/lib/pendencias-cliente';
import { getHotmartResumo, type HotmartResumo } from '@/lib/hotmart';
import { getMetaAdsRelatorio, getMetaAdsCampanhas, type CampanhaAds } from '@/lib/metaAds';
import { getFotoDoInstagramDoProjeto, getIgAnalyticsDoProjeto, type IgAnalytics } from '@/lib/instagram';
import { env } from '@/lib/env';
import type { RelatorioAds } from '@/lib/csvAds';
import { etapaDaTarefa, resumirEtapas } from '@/lib/etapas-projeto';
import { cardsDoProjeto } from '@/lib/visao-projeto';
import { EditarProjeto } from '../EditarProjeto';
import { ProjetoCover } from './ProjetoCover';
import { Trilha } from '../../_components/Trilha';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { FiltroPeriodo } from './FiltroPeriodo';
import { VisaoProjetoNova } from './VisaoProjetoNova';
import { CalendarioProjetoNovo } from './CalendarioProjetoNovo';
import { ComentariosInternos, LateralWhatsapp, type MsgLateral } from './LateralWhatsapp';
import { AcoesProjeto } from './AcoesProjeto';
import { TrafegoProjeto } from './TrafegoProjeto';
import { EsqueletoProjeto } from './EsqueletoProjeto';
import { contaMetaDoProjeto } from '@/lib/trafegoResumo';
import { Avatar, ST, Tag, type St } from '../../_ui/lud';

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
          valor={resumo.ticketMedio != null ? moeda(resumo.ticketMedio) : 'sem dado'}
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
// Sem a reserva do cache (logo depois de concluir) a leitura do Notion pode passar de 15s.
export const maxDuration = 60;

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

type Aba = 'geral' | 'desempenho';

function normalizeAba(v: string | string[] | undefined): Aba {
  const s = Array.isArray(v) ? v[0] : v;
  return s === 'desempenho' ? 'desempenho' : 'geral';
}

function resolveMes(v: string | string[] | undefined): { year: number; month: number } {
  const s = Array.isArray(v) ? v[0] : v;
  const m = s?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return { year: Number(m[1]), month: mo };
  }
  const hoje = hojeEmSaoPaulo();
  return { year: Number(hoje.slice(0, 4)), month: Number(hoje.slice(5, 7)) };
}

function hrefProjeto(id: string, aba: Aba): string {
  return aba === 'desempenho' ? `/admin/projetos/${id}?aba=desempenho` : `/admin/projetos/${id}`;
}

// ---- cabeçalho (capa + avatar sobreposto) ----------------------------------

/** Pessoas que mais aparecem nas tarefas abertas, com a tarefa mais comum de cada uma. */
function equipeDoProjeto(d: ProjetoDetalhe): { nome: string; papel: string }[] {
  const porPessoa = new Map<string, Map<string, number>>();
  for (const t of d.tarefas) {
    if (!t.pessoa) continue;
    const m = porPessoa.get(t.pessoa) ?? new Map<string, number>();
    const k = t.titulo.split('|')[0].trim();
    m.set(k, (m.get(k) ?? 0) + 1);
    porPessoa.set(t.pessoa, m);
  }
  const lista = [...porPessoa.entries()]
    .map(([nome, m]) => ({ nome, n: [...m.values()].reduce((s, v) => s + v, 0), papel: [...m.entries()].sort((a, b) => b[1] - a[1])[0][0].toLowerCase() }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  if (d.gestor && !lista.some((p) => p.nome === d.gestor)) lista.unshift({ nome: d.gestor, n: 0, papel: 'gestão' });
  return lista.slice(0, 3);
}

function CabecalhoProjeto({
  d,
  capa,
  coverUrl,
  combinado,
  noPortal,
  foto,
  clienteId,
  acoesExtras,
}: {
  d: ProjetoDetalhe;
  capa: string | null;
  coverUrl: string | null;
  combinado: Combinado;
  noPortal: ProjetoNoPortal | null;
  foto: string | null;
  clienteId: string | null;
  acoesExtras?: React.ReactNode;
}) {
  const curto = nomeCurtoDoProjeto(d.nome);
  const inicial = (curto.startsWith('@') ? curto.slice(1) : d.nome).trim()[0]?.toUpperCase() ?? '·';
  const equipe = equipeDoProjeto(d);
  const ativo = /ativo/i.test(d.status ?? '');
  return (
    <section className="flex flex-col rounded-[22px] border border-[#E9E9EB] bg-white">
      <ProjetoCover projetoId={d.id} coverUrlInicial={coverUrl} capaNotion={capa} nomeProjeto={d.nome} />
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5">
        <div className="flex min-w-0 items-end gap-4">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt={`Foto do Instagram de ${d.nome}`} className="-mt-12 h-[88px] w-[88px] shrink-0 rounded-full border-[5px] border-white object-cover" />
          ) : (
            <span className="-mt-12 flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full border-[5px] border-white bg-[#111113] text-[32px] font-extrabold text-white">
              {inicial}
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1.5 pt-3">
            <span className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">{curto.startsWith('@') ? curto : d.nome}</h1>
              {d.status && <Tag st={ativo ? 'ok' : 'neu'}>{d.status}</Tag>}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              {curto.startsWith('@') && <span className="text-[#636369]">{d.nome}</span>}
              {clienteId && d.clienteNome && (
                <Link href={rotas.cliente(clienteId)} className="rounded-full border border-[#E9E9EB] px-3 py-1.5 text-[12px] font-bold hover:border-[#B4B4B9]">
                  {d.clienteNome} →
                </Link>
              )}
              {noPortal && (
                <Link href={`/admin/conteudo/${noPortal.projetoId}`} className="rounded-full border border-[#E9E9EB] px-3 py-1.5 text-[12px] font-bold hover:border-[#B4B4B9]" title={`conteúdo a partir de ${noPortal.desde.split('-').reverse().join('/')} roda só no portal`}>
                  Calendário no portal →
                </Link>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {equipe.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="flex -space-x-1.5">
                {equipe.map((p) => (
                  <span key={p.nome} className="rounded-full ring-2 ring-white">
                    <Avatar nome={p.nome} tam={26} />
                  </span>
                ))}
              </span>
              <span className="hidden max-w-[260px] flex-col text-[11.5px] leading-tight text-[#46464B] md:flex">
                {equipe.map((p) => (
                  <span key={p.nome} className="truncate">
                    <b className="text-[#111113]">{p.nome.split(' ')[0]}</b> {p.papel}
                  </span>
                ))}
              </span>
            </span>
          )}
          {acoesExtras}
          <EditarProjeto projetoId={d.id} projetoNome={d.nome} configInicial={d.config} combinadoInicial={combinado} />
        </div>
      </div>
    </section>
  );
}

// ---- abas ------------------------------------------------------------------

function TabNav({ id, aba }: { id: string; aba: Aba }) {
  const tabs: { id: Aba; label: string }[] = [
    { id: 'geral', label: 'Visão geral' },
    { id: 'desempenho', label: 'Desempenho' },
  ];
  return (
    <div className="flex gap-1.5">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={hrefProjeto(id, t.id)}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${t.id === aba ? 'bg-[#111113] text-white' : 'border border-[#E9E9EB] bg-white text-[#46464B] hover:border-[#B4B4B9]'}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

// ---- sobre o projeto (4 caixinhas) -------------------------------------------

const LETRA_DIA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const NOME_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** Combinado com o cliente: posts por mês (campo N do Notion) e dias fixos (0 = domingo … 6 = sábado). */
type Combinado = { postsPorMes: number | null; diasFixos: number[] };

async function SobreProjeto({ d, postsDoMes, clienteId, grupos, combinado }: { d: ProjetoDetalhe; postsDoMes: PostCalendario[]; clienteId: string | null; grupos: { nome: string; apelido: string | null }[]; combinado: Combinado }) {
  const [horario, clientes] = await Promise.all([getHorarioDoProjeto(d.id).catch(() => null), listAllClientes().catch(() => [])]);
  const cliente = clientes.find((c) => (clienteId && c.id.replace(/-/g, '') === clienteId.replace(/-/g, '')) || c.nome.trim().toLowerCase() === (d.clienteNome ?? '').trim().toLowerCase());
  const porDia = [0, 0, 0, 0, 0, 0, 0];
  for (const p of postsDoMes) {
    const [y, m, dd] = p.data.slice(0, 10).split('-').map(Number);
    porDia[(new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7] += 1;
  }
  const maxDia = Math.max(1, ...porDia);
  const grupo = grupos[0] ?? null;
  const caixa = (st: St) => ({ background: ST[st][0], color: ST[st][1] });
  const ROT = 'text-[10.5px] font-extrabold uppercase tracking-[0.08em]';
  const hrefCli = cliente ? rotas.cliente(cliente.id) : clienteId ? rotas.cliente(clienteId) : null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="flex flex-col gap-1.5 rounded-[18px] p-4" style={caixa('areia')}>
        <span className={ROT}>Cliente</span>
        <b className="truncate text-[17px]">{d.clienteNome ?? 'Sem cliente no Notion'}</b>
        <span className="truncate text-[12px]">{grupo ? `💬 ${grupo.apelido?.trim() || grupo.nome}` : 'sem grupo de WhatsApp'}</span>
        {cliente?.email && <span className="truncate text-[12px]">✉ {cliente.email}</span>}
        {hrefCli && <Link href={hrefCli} className="mt-auto text-[12px] font-extrabold hover:underline">abrir página do cliente →</Link>}
      </div>
      <div className="flex flex-col gap-1.5 rounded-[18px] p-4" style={caixa('info')}>
        <span className={ROT}>Informações</span>
        <span className="flex flex-wrap items-baseline gap-1.5">
          <b className="text-[17px]">
            {combinado.postsPorMes != null ? `${combinado.postsPorMes} ${combinado.postsPorMes === 1 ? 'post' : 'posts'} por mês` : 'posts por mês não preenchido'}
          </b>
          {combinado.postsPorMes != null && <span className="text-[11px]">combinado no contrato</span>}
        </span>
        {combinado.diasFixos.length > 0 ? (
          <span className="flex gap-1">
            {LETRA_DIA.map((l, i) => {
              const ligado = combinado.diasFixos.includes((i + 1) % 7);
              return (
                <span
                  key={i}
                  className="flex h-[26px] flex-1 items-center justify-center rounded-[7px] text-[11px] font-extrabold"
                  style={ligado ? { background: ST.info[2], color: '#fff' } : { background: 'rgba(36,70,107,0.10)', color: 'rgba(36,70,107,0.55)' }}
                >
                  {l}
                </span>
              );
            })}
          </span>
        ) : (
          <span className="flex h-[30px] items-end gap-1" title="Sem dias fixos: mostrando os dias que têm post neste mês">
            {porDia.map((n, i) => (
              <span key={i} className="flex flex-1 flex-col items-center gap-0.5">
                <span className="w-full rounded-[3px]" style={{ height: `${n ? Math.max(5, (n / maxDia) * 18) : 3}px`, background: n ? ST.info[2] : 'rgba(36,70,107,0.18)' }} />
                <span className="text-[9.5px] font-bold">{LETRA_DIA[i]}</span>
              </span>
            ))}
          </span>
        )}
        <span className="text-[12px]">
          {combinado.diasFixos.length
            ? [1, 2, 3, 4, 5, 6, 0].filter((d) => combinado.diasFixos.includes(d)).map((d) => NOME_DIA[d]).join(', ').replace(/, ([^,]*)$/, ' e $1')
            : 'dias fixos não preenchidos (Editar projeto)'}
          {' · '}
          {horario ? `sempre às ${horario} (horário de Brasília)` : 'horário não preenchido (campo Time)'}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-[18px] p-4" style={caixa('ok')}>
        <span className={ROT}>Contrato</span>
        <b className="text-[17px]">Sem dados</b>
        <span className="text-[12px]">ligação com a Nibo ainda não feita</span>
        {hrefCli && <Link href={hrefCli} className="mt-auto text-[12px] font-extrabold hover:underline">ver na página do cliente →</Link>}
      </div>
    </div>
  );
}

// ---- dados do lado do cliente (pendências liberadas) ----------------------

async function itensDoCliente(projetoId: string) {
  const pendentes = await listTarefasPendentesDoCliente([projetoId]).catch(() => []);
  const [textos, vistas] = await Promise.all([
    lerMensagensEditadas().catch(() => ({}) as Record<string, string>),
    lerVisualizacoes(pendentes.map((p) => p.postId)).catch(() => ({}) as Awaited<ReturnType<typeof lerVisualizacoes>>),
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
      reaprovacao: p.reaprovacao,
    };
    const v = vistas[p.postId];
    return { ...base, visto: v ? { ultima: v.ultima, total: v.total } : null };
  });
  return { itens, textos };
}

/** Últimas mensagens do grupo principal, pra lateral. */
async function mensagensDoGrupo(grupoId: string | null, projetoId: string): Promise<MsgLateral[]> {
  const hoje = hojeEmSaoPaulo();
  const quando = (iso: string) => {
    const d = new Date(iso);
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
    const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d).replace(':', 'h');
    return `${dia === hoje ? 'hoje' : `${dia.slice(8)}/${dia.slice(5, 7)}`} ${hora}`;
  };
  // Lembretes e mensagens que o portal mandou (régua, 📱 lembrar, mensagem geral).
  const doPortal: (MsgLateral & { ts: string })[] = await lerEnviosDoProjeto(projetoId, 4)
    .then((es) =>
      es.map((e) => ({
        id: `envio-${e.id}`,
        autor: e.enviadoPor ? e.enviadoPor.split('@')[0] : 'Lud.',
        texto: e.texto?.trim() || 'Mensagem enviada pelo portal',
        quando: quando(e.enviadoEm),
        daLud: true,
        ts: e.enviadoEm,
      })),
    )
    .catch(() => []);
  if (!grupoId) return doPortal.sort((a, b) => a.ts.localeCompare(b.ts)).slice(-4).map(({ ts: _ts, ...m }) => m);
  try {
    const ms = await listarMensagens(grupoId, 4);
    const doGrupo = ms.map((m) => {
      const d = new Date(m.timestamp);
      const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
      const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d).replace(':', 'h');
      const daLud = m.enviado_via_portal || m.remetente_nome === 'Lud.';
      return {
        id: m.id,
        autor: daLud ? (m.enviado_por_usuario ? m.enviado_por_usuario.split('@')[0] : 'Lud.') : m.remetente_nome ?? 'Cliente',
        texto: m.conteudo?.trim() || `[${m.tipo}]`,
        quando: `${dia === hoje ? 'hoje' : `${dia.slice(8)}/${dia.slice(5, 7)}`} ${hora}`,
        daLud,
        ts: m.timestamp,
      };
    });
    // Junta as duas fontes sem repetir o mesmo texto e mostra as 4 mais recentes.
    const vistos = new Set<string>();
    return [...doGrupo, ...doPortal]
      .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
      .filter((m) => {
        const k = m.texto.slice(0, 80);
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .slice(-4)
      .map(({ ts: _ts, ...m }) => m);
  } catch {
    return doPortal.sort((a, b) => a.ts.localeCompare(b.ts)).slice(-4).map(({ ts: _ts, ...m }) => m);
  }
}

// ---- visão geral (proposta NOVA) --------------------------------------------

async function VisaoGeral({
  d,
  etapas,
  postsDoMes,
  ano,
  mes,
  hoje,
  grupos,
}: {
  d: ProjetoDetalhe;
  etapas: ReturnType<typeof resumirEtapas>;
  postsDoMes: PostCalendario[];
  ano: number;
  mes: number;
  hoje: string;
  grupos: { id: string; nome: string; apelido: string | null }[];
}) {
  const [{ itens: itensCliente, textos }, mensagens] = await Promise.all([itensDoCliente(d.id), mensagensDoGrupo(grupos[0]?.id ?? null, d.id)]);

  // Projeto que não é de conteúdo (e-book, site…): não tem posts. Avisa e
  // leva pros projetos de Instagram/TikTok da mesma cliente.
  const servico = classificarProjeto(d.nome);
  const ehDePosts = ['Instagram', 'TikTok', 'Stories'].includes(servico);
  const semTr = (id: string) => id.replace(/-/g, '');
  const irmaosDePosts = ehDePosts
    ? []
    : await listAllProjetos()
        .then((todos) => {
          const eu = todos.find((p) => semTr(p.id) === semTr(d.id));
          return eu
            ? todos.filter((p) => p.clienteId === eu.clienteId && semTr(p.id) !== semTr(eu.id) && ['Instagram', 'TikTok', 'Stories'].includes(classificarProjeto(p.nome)))
            : [];
        })
        .catch(() => []);

  // Tarefas: só a tarefa atual de cada post (a que define a etapa) + as de
  // fora do fluxo de posts (reunião, calendário…).
  const atuais = etapas.flatMap((e) => e.posts.map((p) => p.tarefa));
  const foraDoFluxo = d.tarefas.filter((t) => !t.postId || !etapaDaTarefa(t.titulo));
  const primeiroNome = (d.clienteNome ?? '').trim().split(/\s+/)[0];
  const rotuloCliente = primeiroNome ? `Com ${/a$/i.test(primeiroNome) ? 'a' : 'o'} ${primeiroNome}` : 'Com o cliente';
  const gruposWpp = grupos.map((g) => ({ id: g.id, nome: g.nome, apelido: g.apelido?.trim() || null }));

  return (
    <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="flex min-w-0 flex-col gap-[18px]">
        {!ehDePosts && (
          <div className="rounded-[20px] border border-[#E9E9EB] bg-white px-5 py-4 text-[13px] leading-[1.55] text-[#46464B]">
            <b className="text-[#111113]">Esse projeto é de {servico === 'Outros' ? 'outro serviço' : servico}: não tem posts.</b> Aqui aparecem só as tarefas dele.
            {irmaosDePosts.length > 0 && (
              <>
                {' '}Os posts de {d.clienteNome ?? 'cliente'} ficam em{' '}
                {irmaosDePosts.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ' e '}
                    <Link href={rotas.projeto(p.id)} className="font-bold text-[#111113] underline underline-offset-2">
                      {nomeCurtoDoProjeto(p.nome)} →
                    </Link>
                  </span>
                ))}
                .
              </>
            )}
          </div>
        )}
        <VisaoProjetoNova
          projetoId={d.id}
          clienteNome={d.clienteNome ?? d.nome}
          rotuloCliente={rotuloCliente}
          cards={cardsDoProjeto(etapas, hoje)}
          tarefas={[...atuais, ...foraDoFluxo]}
          itensCliente={itensCliente}
          gruposWpp={gruposWpp}
          textos={textos}
          hojeIso={hoje}
          calendario={ehDePosts ? <CalendarioProjetoNovo projetoId={d.id} ano={ano} mes={mes} postsIniciais={postsDoMes} hojeIso={hoje} /> : null}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-[18px]">
        <LateralWhatsapp projetoId={d.id} clienteNome={d.clienteNome ?? d.nome} gruposWpp={gruposWpp} mensagens={mensagens} itensCliente={itensCliente} textos={textos} hojeIso={hoje} />
        <ComentariosInternos />
      </div>
    </div>
  );
}

/** Lateral da página de tráfego: ações (tarefas) + grupo do WhatsApp. */
async function LateralTrafego({ d, hoje, grupos }: { d: ProjetoDetalhe; hoje: string; grupos: { id: string; nome: string; apelido: string | null }[] }) {
  const [{ itens: itensCliente, textos }, mensagens] = await Promise.all([itensDoCliente(d.id), mensagensDoGrupo(grupos[0]?.id ?? null, d.id)]);
  const acoes = [...d.tarefas]
    .filter((t) => !/^calend[aá]rio\b/i.test(t.titulo.trim()))
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))
    .slice(0, 8)
    .map((t) => ({ id: t.id, titulo: t.titulo, prazo: t.prazo, pessoa: t.pessoa }));
  const gruposWpp = grupos.map((g) => ({ id: g.id, nome: g.nome, apelido: g.apelido?.trim() || null }));
  return (
    <>
      <AcoesProjeto acoes={acoes} hojeIso={hoje} />
      <LateralWhatsapp projetoId={d.id} clienteNome={d.clienteNome ?? d.nome} gruposWpp={gruposWpp} mensagens={mensagens} itensCliente={itensCliente} textos={textos} hojeIso={hoje} />
    </>
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
              Insights de IA, público e demografia, na página de Análise.
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
                    {v.atual || 'sem dado'}
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
  const hoje = hojeEmSaoPaulo();
  const [d, postsDoMes, noPortal, customizacao, grupos, capaNotion, todos, postsPorMes] = await Promise.all([
    getProjetoDetalhe(id),
    listPostsDoMes([id], year, month).catch(() => [] as PostCalendario[]),
    projetoDoPortal(id),
    lerCustomizacaoProjeto(id).catch(() => null),
    getGruposWhatsappDoProjeto(id).catch(() => []),
    getCapaDoProjetoNotion(id).catch(() => null),
    listAllProjetos().catch(() => []),
    getPostsPorMes(id),
  ]);
  if (!d) notFound();
  const combinado = { postsPorMes, diasFixos: customizacao?.diasFixos ?? [] };
  const etapas = resumirEtapas(d.tarefas, hoje);
  const ehTrafego = classificarProjeto(d.nome) === 'Tráfego Pago';
  const semTr = (x: string) => x.replace(/-/g, '');
  const eu = todos.find((p) => semTr(p.id) === semTr(id));
  const clienteId = eu?.clienteId ?? null;
  // Tráfego: usa o @ do Instagram do mesmo cliente (foto e selo das campanhas).
  const ig = ehTrafego && eu ? todos.find((p) => p.clienteId === eu.clienteId && classificarProjeto(p.nome) === 'Instagram') : undefined;
  const foto = await getFotoDoInstagramDoProjeto(ig?.id ?? id, ig?.nome ?? d.nome).catch(() => null);
  const conta = ehTrafego ? contaMetaDoProjeto(id) : null;

  return (
    <main className="lud-admin mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 py-7 sm:px-8">
      <Trilha itens={[{ rotulo: ehTrafego ? 'Projetos · Tráfego Pago' : 'Projetos', href: ehTrafego ? `${rotas.projetos()}?tipo=${encodeURIComponent('Tráfego Pago')}` : rotas.projetos() }, { rotulo: nomeCurtoDoProjeto(d.nome) }]} />
      <CabecalhoProjeto
        d={d}
        capa={capaNotion}
        coverUrl={customizacao?.coverUrl ?? null}
        combinado={combinado}
        noPortal={noPortal}
        foto={foto}
        clienteId={clienteId}
        acoesExtras={
          ehTrafego ? (
            <>
              {conta && (
                <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${conta.replace(/^act_/, '')}`} target="_blank" rel="noreferrer" className="rounded-[11px] border border-[#D6D6D9] bg-white px-3.5 py-2 text-[13px] font-extrabold hover:bg-[#F4F4F5]">
                  Abrir Gerenciador ↗
                </a>
              )}
              <Link href="/admin/trafego-pago" className="rounded-[11px] border border-[#D6D6D9] bg-white px-3.5 py-2 text-[13px] font-extrabold hover:bg-[#F4F4F5]">
                Relatório completo
              </Link>
            </>
          ) : undefined
        }
      />
      {!ehTrafego && (
        <Suspense fallback={<div className="grid grid-cols-1 gap-3 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[132px] animate-pulse rounded-[18px] bg-[#F4F4F5]" />)}</div>}>
          <SobreProjeto d={d} postsDoMes={postsDoMes} clienteId={clienteId} grupos={grupos} combinado={combinado} />
        </Suspense>
      )}
      <TabNav id={id} aba={aba} />
      {aba === 'geral' && !ehTrafego && (
        <Suspense fallback={<div className="h-[520px] animate-pulse rounded-[20px] bg-[#F4F4F5]" />}>
          <VisaoGeral d={d} etapas={etapas} postsDoMes={postsDoMes} ano={year} mes={month} hoje={hoje} grupos={grupos} />
        </Suspense>
      )}
      {aba === 'geral' && ehTrafego && (
        <Suspense fallback={<div className="h-[520px] animate-pulse rounded-[20px] bg-[#F4F4F5]" />}>
          <TrafegoProjeto
            id={id}
            hojeIso={hoje}
            handle={ig ? nomeCurtoDoProjeto(ig.nome) : null}
            lateral={
              <Suspense fallback={<div className="h-[300px] animate-pulse rounded-[20px] bg-[#F4F4F5]" />}>
                <LateralTrafego d={d} hoje={hoje} grupos={grupos} />
              </Suspense>
            }
          />
        </Suspense>
      )}
      {aba === 'desempenho' && (
        <Suspense fallback={<div className="h-[320px] animate-pulse rounded-[20px] bg-[#F4F4F5]" />}>
          <DesempenhoTab id={id} inicioMs={inicioMs} fimMs={fimMs} config={d.config} />
        </Suspense>
      )}
    </main>
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
    <Suspense key={`${aba}-${inicioMs}-${fimMs}`} fallback={<EsqueletoProjeto />}>
      <ProjetoShell id={params.id} aba={aba} year={year} month={month} inicioMs={inicioMs} fimMs={fimMs} />
    </Suspense>
  );
}
