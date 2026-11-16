/**
 * Página de um projeto de Tráfego Pago (proposta NOVA): números do mês,
 * cards de campanha detalhados (resultados, custo por resultado, frequência,
 * CTR, investimento, resultados por semana), ações e verba do mês. Tudo vem
 * da Meta pelo que já existe em lib/metaAds.ts (via lib/trafegoResumo.ts).
 * Verba planejada e relatórios enviados ainda não ficam no portal: não aparecem
 * inventados.
 */
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import Link from 'next/link';
import type { CampanhaAds } from '@/lib/metaAds';
import { campanhasDoProjeto, chaveMetaDoProjeto, resumoTrafegoDoProjeto } from '@/lib/trafegoResumo';
import { ST, Tag, Vazio, type St } from '../../_ui/lud';

const DIA = 86_400_000;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: n >= 1000 ? 0 : 2 });
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const dec = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const OBJETIVO: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_SALES: 'Vendas',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_APP_PROMOTION: 'App',
};

/** Resultado principal da campanha: conversas, compras, cliques ou alcance. */
export function resultadoDa(c: CampanhaAds): { n: number; unidade: string; custo: number | null } | null {
  const t = c.relatorio?.totais;
  if (!t) return null;
  const inv = t.investimento;
  const r = c.resultado;
  if (r.conversas) return { n: r.conversas, unidade: 'conversas', custo: r.custoPorConversa };
  if (t.compras) return { n: t.compras, unidade: 'compras', custo: t.custoPorCompra };
  if (r.linkClicks) return { n: r.linkClicks, unidade: 'cliques no link', custo: r.custoPorLinkClick };
  if (t.alcance) return { n: t.alcance, unidade: 'pessoas alcançadas', custo: t.alcance ? (inv / t.alcance) * 1000 : null };
  return null;
}

function Quadro({ rotulo, valor, sub, st }: { rotulo: string; valor: React.ReactNode; sub: string; st: St }) {
  return (
    <div className="flex h-full flex-col gap-1 rounded-[18px] p-4" style={{ background: ST[st][0], color: ST[st][1] }}>
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-90">{rotulo}</span>
      <b className="text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{valor}</b>
      <span className="text-[12.5px] opacity-90">{sub}</span>
    </div>
  );
}

async function KpiRodando({ id }: { id: string }) {
  const r = await resumoTrafegoDoProjeto(id);
  return <Quadro rotulo="Campanhas rodando" valor={r.rodando} sub={`de ${r.total} · gasto nos últimos 7 dias`} st="ok" />;
}

/** Resultados das últimas 4 semanas de uma campanha (barrinhas, a última escura). */
async function BarrasSemana({ campanhaId, semanas }: { campanhaId: string; semanas: Promise<(CampanhaAds[] | null)[]> }) {
  const lista = await semanas;
  const vals = lista.map((s) => {
    const c = s?.find((x) => x.id === campanhaId);
    return c ? resultadoDa(c)?.n ?? 0 : 0;
  });
  const max = Math.max(1, ...vals);
  return (
    <span className="flex h-[34px] items-end gap-1.5" title={vals.map((v, i) => `semana ${i + 1}: ${num(v)}`).join(' · ')}>
      {vals.map((v, i) => (
        <span
          key={i}
          className="w-[18px] rounded-[4px]"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: i === vals.length - 1 ? ST.ok[2] : ST.ok[0] }}
        />
      ))}
    </span>
  );
}

function CardCampanha({
  c,
  handle,
  totalMes,
  semanas,
}: {
  c: CampanhaAds;
  handle: string | null;
  totalMes: number;
  semanas: Promise<(CampanhaAds[] | null)[]>;
}) {
  const t = c.relatorio?.totais;
  const res = resultadoDa(c);
  const freq = t?.frequenciaMedia ?? 0;
  const saturando = freq > 3;
  const inv = t?.investimento ?? 0;
  const parte = totalMes ? inv / totalMes : 0;
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-[#E9E9EB] px-2 py-[2px] text-[10.5px] font-extrabold">📣 CAMPANHA</span>
        {OBJETIVO[c.objetivo] && <span className="rounded-full bg-[#F4F4F5] px-2 py-[2px] text-[10.5px] font-extrabold text-[#46464B]">{OBJETIVO[c.objetivo]}</span>}
        {handle && <span className="text-[11.5px] font-bold text-[#46464B]">{handle}</span>}
        <span className="ml-auto">
          {c.semDados || !t ? <Tag st="neu">sem veiculação</Tag> : saturando ? <Tag st="atr">frequência alta</Tag> : <Tag st="ok">em dia</Tag>}
        </span>
      </div>
      <b className="text-[16px] font-extrabold leading-snug">{c.nome}</b>
      {c.semDados || !t ? (
        <Vazio>Ainda sem veiculação neste mês.</Vazio>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <span className="flex flex-col gap-0.5 rounded-[12px] p-2.5" style={{ background: ST.ok[0], color: ST.ok[1] }}>
              <b className="text-[19px] leading-tight tabular-nums">{res ? num(res.n) : '--'}</b>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.05em]">{res?.unidade ?? 'resultados'}</span>
            </span>
            <span className="flex flex-col gap-0.5 rounded-[12px] bg-[#F4F4F5] p-2.5">
              <b className="text-[19px] leading-tight tabular-nums">{res?.custo != null ? brl(res.custo) : '--'}</b>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#46464B]">{res?.unidade === 'pessoas alcançadas' ? 'CPM' : 'por resultado'}</span>
            </span>
            {saturando ? (
              <span className="flex flex-col gap-0.5 rounded-[12px] p-2.5" style={{ background: ST.atr[0], color: ST.atr[1] }}>
                <b className="text-[19px] leading-tight tabular-nums">{dec(freq)}</b>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.05em]">frequência</span>
              </span>
            ) : (
              <span className="flex flex-col gap-0.5 rounded-[12px] bg-[#F4F4F5] p-2.5">
                <b className="text-[19px] leading-tight tabular-nums">{t.ctr != null ? `${dec(t.ctr)}%` : dec(freq)}</b>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#46464B]">{t.ctr != null ? `CTR · freq. ${dec(freq)}` : 'frequência'}</span>
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span>
                <b>{brl(inv)}</b> investidos no mês
              </span>
              <span className="text-[#636369]">{Math.round(parte * 100)}% do projeto</span>
            </div>
            <span className="h-[6px] overflow-hidden rounded-full bg-[#F4F4F5]">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(3, parte * 100)}%`, background: ST.ok[2] }} />
            </span>
          </div>
        </>
      )}
      <div className="flex items-end justify-between gap-3 border-t border-[#F4F4F5] pt-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#46464B]">Resultados por semana</span>
          <Suspense fallback={<span className="h-[34px] w-[90px] animate-pulse rounded bg-[#F4F4F5]" />}>
            <BarrasSemana campanhaId={c.id} semanas={semanas} />
          </Suspense>
        </div>
        <span className="text-[11.5px] text-[#636369]">últimas 4 semanas</span>
      </div>
    </article>
  );
}

export async function TrafegoProjeto({
  id,
  hojeIso,
  handle,
  lateral,
}: {
  id: string;
  hojeIso: string;
  /** @ do Instagram do mesmo cliente, quando tiver. */
  handle: string | null;
  lateral: React.ReactNode;
}) {
  const agora = Date.now();
  const inicioMes = Date.parse(`${hojeIso.slice(0, 8)}01T00:00:00-03:00`);
  const ligado = !!chaveMetaDoProjeto(id);
  const campanhas = ligado ? ((await campanhasDoProjeto(id, inicioMes, agora).catch(() => null)) ?? []) : [];
  // 4 semanas (da mais antiga pra mais recente), sem travar a página: cada card espera sozinho.
  const semanas = ligado
    ? Promise.all([3, 2, 1, 0].map((k) => campanhasDoProjeto(id, agora - (k + 1) * 7 * DIA, agora - k * 7 * DIA).catch(() => null)))
    : Promise.resolve([] as (CampanhaAds[] | null)[]);

  const totalMes = campanhas.reduce((s, c) => s + (c.relatorio?.totais.investimento ?? 0), 0);
  const ordem = [...campanhas].sort((a, b) => (b.relatorio?.totais.investimento ?? 0) - (a.relatorio?.totais.investimento ?? 0));
  const principal = ordem.map(resultadoDa).find(Boolean) ?? null;
  const mesmaUnidade = ordem.filter((c) => resultadoDa(c)?.unidade === principal?.unidade);
  const nRes = mesmaUnidade.reduce((s, c) => s + (resultadoDa(c)?.n ?? 0), 0);
  const invRes = mesmaUnidade.reduce((s, c) => s + (c.relatorio?.totais.investimento ?? 0), 0);
  const saturando = campanhas.filter((c) => (c.relatorio?.totais.frequenciaMedia ?? 0) > 3);
  const mes = MESES[Number(hojeIso.slice(5, 7)) - 1];
  const diasNoMes = new Date(Date.UTC(Number(hojeIso.slice(0, 4)), Number(hojeIso.slice(5, 7)), 0)).getUTCDate();
  const faltam = diasNoMes - Number(hojeIso.slice(8, 10));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Quadro rotulo="Resultados no mês" valor={principal ? num(nRes) : '--'} sub={principal ? principal.unidade : ligado ? 'sem veiculação no mês' : 'sem conta da Meta ligada'} st="ok" />
        <Quadro
          rotulo={principal?.unidade === 'conversas' ? 'Custo por conversa' : 'Custo por resultado'}
          valor={principal && nRes && principal.unidade !== 'pessoas alcançadas' ? brl(invRes / nRes) : '--'}
          sub={`${brl(totalMes)} investidos em ${mes}`}
          st="info"
        />
        {ligado ? (
          <Suspense fallback={<div className="min-h-[104px] animate-pulse rounded-[18px]" style={{ background: ST.ok[0] }} />}>
            <KpiRodando id={id} />
          </Suspense>
        ) : (
          <Quadro rotulo="Campanhas rodando" valor="--" sub="sem conta da Meta ligada" st="neu" />
        )}
        <Quadro
          rotulo="Atenção"
          valor={saturando.length}
          sub={saturando.length ? `${saturando.length === 1 ? 'campanha' : 'campanhas'} com frequência acima de 3` : 'nenhum alerta'}
          st={saturando.length ? 'atr' : 'neu'}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <h2 className="text-[20px] font-extrabold tracking-[-0.01em]">Campanhas</h2>
          {!ligado ? (
            <Vazio>
              Esse projeto ainda não tem conta ou campanha da Meta ligada no portal (META_ADS_ACCOUNTS ou META_ADS_CAMPAIGNS).
            </Vazio>
          ) : ordem.length === 0 ? (
            <Vazio>Nenhuma campanha veiculou em {mes}.</Vazio>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {ordem.map((c) => (
                <CardCampanha key={c.id} c={c} handle={handle} totalMes={totalMes} semanas={semanas} />
              ))}
            </div>
          )}
          <section className="flex flex-col gap-2 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <b className="text-[16px] font-bold">Relatórios</b>
                <span className="text-[12.5px] text-[#636369]">enviados no grupo do cliente</span>
              </div>
              <Link href="/admin/trafego-pago" className="shrink-0 rounded-[11px] border border-[#D6D6D9] px-3 py-1.5 text-[12px] font-extrabold hover:bg-[#F4F4F5]">
                Montar relatório
              </Link>
            </div>
            <Vazio>Os relatórios enviados ainda não ficam salvos no portal.</Vazio>
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-[18px]">
          {lateral}
          <section className="flex flex-col gap-2 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
            <div className="flex flex-col gap-0.5">
              <b className="text-[16px] font-bold">Verba de {mes}</b>
              <span className="text-[12.5px] text-[#636369]">Meta Ads</span>
            </div>
            <span className="flex items-baseline gap-1.5">
              <b className="text-[26px] font-extrabold tracking-[-0.02em]">{brl(totalMes)}</b>
              <span className="text-[13px] text-[#636369]">investidos</span>
            </span>
            <span className="text-[12.5px] text-[#46464B]">
              {faltam === 0 ? 'último dia do mês' : `${faltam} ${faltam === 1 ? 'dia' : 'dias'} pra fechar o mês`}
            </span>
            <span className="text-[11.5px] text-[#8A8A90]">A verba planejada ainda não fica no portal, então não dá pra mostrar quanto falta.</span>
          </section>
        </div>
      </div>
    </>
  );
}
