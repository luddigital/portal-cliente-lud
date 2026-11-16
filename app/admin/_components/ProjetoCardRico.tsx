/**
 * Card rico de projeto pra lista da home /admin — inspirado no mockup da Luiza:
 * tag de criticidade, 3 KPIs de prazo, grid de 6 etapas, 3 blocos "Posts de X"
 * com barra segmentada postado/em produção/só em pauta e lista de atrasos.
 */
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { agregarProjeto, ETAPAS_CARD, type ProjetoAgregado } from '@/lib/agregadoProjeto';
import type { ProjetoListItem } from '@/lib/notion';

const ETAPAS_LABEL: Record<string, string> = {
  pauta: 'Pauta',
  briefing: 'Briefing',
  materiais: 'Materiais',
  arte: 'Arte',
  aprovacao: 'Aprovação',
  programacao: 'Publicação',
};

const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

export function ProjetoCardRico({ projeto }: { projeto: ProjetoListItem }) {
  const detalheHref = `/admin/projetos/${projeto.id}`;
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white transition hover:border-navy/40 hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]">
      <a href={detalheHref} className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {projeto.nome}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-t3">
              {projeto.clienteNome || 'sem cliente'}
            </div>
          </div>
          <Suspense fallback={<SkeletonTag />}>
            <TagCriticidadeAsync projetoId={projeto.id} />
          </Suspense>
        </div>

        <Suspense fallback={<SkeletonCorpo />}>
          <CorpoCardAsync projetoId={projeto.id} />
        </Suspense>
      </a>

      <div className="flex items-center justify-between gap-2 border-t border-[rgba(21,21,33,0.06)] px-5 py-2.5">
        <a
          href={detalheHref}
          className="text-[11px] font-medium text-ink underline-offset-4 hover:underline"
        >
          Ver detalhes
        </a>
        <div className="flex items-center gap-3">
          {projeto.clienteId && (
            <a
              href={`/api/admin/login-as-cliente?id=${projeto.clienteId}`}
              className="text-[11px] font-medium text-navy hover:underline"
            >
              👁 Ver como cliente
            </a>
          )}
          {projeto.clienteId && (
            <a
              href={`/admin/clientes/${projeto.clienteId}`}
              className="text-[11px] text-mauve hover:text-ink"
            >
              Cliente →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

async function TagCriticidadeAsync({ projetoId }: { projetoId: string }) {
  const d = await agregarProjeto(projetoId);
  return <TagCriticidade criticidade={d.criticidade} />;
}

async function CorpoCardAsync({ projetoId }: { projetoId: string }) {
  const d = await agregarProjeto(projetoId);
  return <CorpoCard d={d} />;
}

function TagCriticidade({ criticidade }: { criticidade: ProjetoAgregado['criticidade'] }) {
  if (criticidade === 'critico') {
    return (
      <span
        className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
        style={{ borderColor: 'var(--prazo-atrasado)', color: 'var(--prazo-atrasado)' }}
      >
        Crítico
      </span>
    );
  }
  if (criticidade === 'atencao') {
    return (
      <span
        className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
        style={{ borderColor: 'var(--prazo-chegando)', color: 'var(--prazo-chegando)' }}
      >
        Atenção
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
      style={{ borderColor: 'var(--prazo-em-dia)', color: 'var(--prazo-em-dia)' }}
    >
      Em dia
    </span>
  );
}

function CorpoCard({ d }: { d: ProjetoAgregado }) {
  return (
    <div className="mt-4 space-y-4">
      {/* 3 KPIs: atrasadas / próx 7 / dias 8-21 */}
      <div className="grid grid-cols-3 gap-3">
        <KPI valor={d.atrasadas} rotulo="Atrasadas" alerta={d.atrasadas > 0} />
        <KPI valor={d.prox7Dias} rotulo="Próx. 7 dias" />
        <KPI valor={d.dias8a21} rotulo="Dias 8 a 21" />
      </div>

      {/* Grid de 6 etapas */}
      <div className="grid grid-cols-6 gap-1">
        {ETAPAS_CARD.map((etapa) => {
          const n = d.porEtapa[etapa] ?? 0;
          const ativo = n > 0;
          return (
            <div
              key={etapa}
              className={`rounded-md px-1 py-1.5 text-center transition ${
                ativo ? 'bg-[var(--prazo-hoje-soft)]' : 'bg-bgSoft'
              }`}
              title={ETAPAS_LABEL[etapa]}
            >
              <div
                className={`text-[13px] font-semibold leading-none ${
                  ativo ? 'text-[var(--prazo-hoje)]' : 'text-t3'
                }`}
              >
                {n}
              </div>
              <div
                className={`mt-1 text-[8.5px] font-semibold uppercase tracking-[0.04em] ${
                  ativo ? 'text-[var(--prazo-hoje)]' : 'text-t3'
                }`}
              >
                {ETAPAS_LABEL[etapa]}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3 blocos de posts/mês com barra segmentada */}
      <div className="grid grid-cols-3 gap-2">
        {d.posts.map((m) => (
          <BlocoMes key={`${m.ano}-${m.mes}`} m={m} />
        ))}
      </div>

      {/* Lista de atrasos */}
      {d.atrasoDesde && (
        <div
          className="rounded-md border px-2.5 py-1.5 text-[11px] leading-[1.45]"
          style={{
            borderColor: 'rgba(192, 71, 55, 0.2)',
            background: 'var(--prazo-atrasado-soft)',
            color: 'var(--prazo-atrasado)',
          }}
        >
          <b className="font-semibold">Atrasado desde {d.atrasoDesde.dataFormatada}:</b>{' '}
          <span className="text-[color:var(--t2)]">{d.atrasoDesde.tarefas.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function KPI({ valor, rotulo, alerta }: { valor: number; rotulo: string; alerta?: boolean }) {
  return (
    <div className="rounded-lg bg-bgSoft px-2.5 py-2">
      <div
        className={`font-mono text-[20px] font-semibold leading-none tracking-[-0.03em] ${
          alerta ? 'text-[var(--prazo-atrasado)]' : 'text-ink'
        }`}
      >
        {valor}
      </div>
      <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-t3">
        {rotulo}
      </div>
    </div>
  );
}

function BlocoMes({ m }: { m: { ano: number; mes: number; total: number; postados: number; emProducao: number; soPauta: number } }) {
  const vazio = m.total === 0;
  const pct = (n: number) => (vazio ? 0 : (n / m.total) * 100);
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-t3">
        Posts de {MESES_ABREV[m.mes - 1]}
      </div>
      <div className={`mt-0.5 font-mono text-[16px] font-semibold ${vazio ? 'text-t3' : 'text-ink'}`}>
        {vazio ? 'sem posts' : m.total}
      </div>
      {!vazio && (
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-bgSoft">
          <div style={{ width: `${pct(m.postados)}%`, background: 'var(--cal-publicado)' }} />
          <div style={{ width: `${pct(m.emProducao)}%`, background: 'var(--prazo-hoje)' }} />
          <div style={{ width: `${pct(m.soPauta)}%`, background: 'var(--prazo-chegando)' }} />
        </div>
      )}
    </div>
  );
}

function SkeletonTag() {
  return <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-bgSoft" />;
}

function SkeletonCorpo() {
  return (
    <div className="mt-4 space-y-3">
      <div className="h-12 animate-pulse rounded-lg bg-bgSoft/70" />
      <div className="h-10 animate-pulse rounded-md bg-bgSoft/70" />
      <div className="h-12 animate-pulse rounded-md bg-bgSoft/70" />
    </div>
  );
}
