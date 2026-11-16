import Link from 'next/link';
import { entregaEfetiva } from './quadro';
import { getEntregaCompleta } from '@/lib/notion';
import { semTraco, tipoDaEntrega } from '@/lib/entrega-dados';
import type { TarefaDeTodos } from '@/lib/notion';
import { rotas } from '@/lib/rotas';
import { atrasosPorEntrega } from './HojeEAtraso';
import type { LinhaCliente, QuadroEntrega } from './quadro';

/**
 * Entregas · visão médio-macro (layout "NOVA · Entregas · visão médio-macro").
 * Primeiro quantas entregas (hoje, em atraso, próximos dias, total); depois de
 * quantos clientes e posts; com quem está fica em segundo plano.
 */

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const soma = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
const dias = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86_400_000);
const diaSemana = (iso: string) => SEMANA[new Date(utc(iso)).getUTCDay()];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const ehCiclo = (q: QuadroEntrega) => /semanal|mensal/i.test(q.frequencia ?? '');

// Cor fixa por cliente (pela @), pra barra de quantos posts cada um tem.
const CORES = ['#24466B', '#8A5A1F', '#B42318', '#5B4BB7', '#1F6F6A', '#7A1F4C', '#46464B', '#2E7D4F', '#C2417E', '#3E6FB0', '#9A6B00', '#6B4E9B'];
export function corDoCliente(handle: string) {
  let h = 0;
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}

const ST = {
  atr: { bg: '#FBE3E0', tx: '#7E211C' },
  hoje: { bg: '#F8DCEA', tx: '#7A1F4C' },
  cheg: { bg: '#E8E4FA', tx: '#3E2F8F' },
  ok: { bg: '#D8EDCF', tx: '#2E5520' },
  cinza: { bg: '#F0F0F1', tx: '#46464B' },
};
type Cor = keyof typeof ST;

function Pill({ cor, children }: { cor: Cor; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-extrabold" style={{ background: ST[cor].bg, color: ST[cor].tx }}>
      {children}
    </span>
  );
}
// Cor fixa de quem está com a entrega: interna (Lud.) sempre azul, cliente sempre âmbar.
export const QUEM = {
  interna: { bg: '#E3ECF7', tx: '#24466B', borda: '#B9CDE6', rotulo: 'interno · Lud.' },
  cliente: { bg: '#FBEFD9', tx: '#8A5A1F', borda: '#EED3A6', rotulo: 'com o cliente' },
};
const quemDe = (q: QuadroEntrega) => (tipoDaEntrega(q.nome) === 'cliente' ? QUEM.cliente : QUEM.interna);
function PillTipo({ cliente }: { cliente: boolean }) {
  const c = cliente ? QUEM.cliente : QUEM.interna;
  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-extrabold" style={{ background: c.bg, color: c.tx }}>
      {c.rotulo}
    </span>
  );
}
/** Caixa "com quem está" no pé do card, na cor fixa de interno ou cliente. */
function QuemBox({ q, nomes }: { q: QuadroEntrega; nomes: string[] }) {
  const c = quemDe(q);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border px-3 py-2 text-[12.5px]" style={{ background: c.bg, borderColor: c.borda, color: c.tx }}>
      <b className="text-[11px] uppercase tracking-[0.06em]">com quem está</b>
      <span className="font-extrabold">{c.rotulo}</span>
      {nomes.length > 0 && <span className="text-[#111113]">{nomes.join(' · ')}</span>}
    </div>
  );
}
const BTN = 'inline-flex h-8 items-center whitespace-nowrap rounded-[10px] border border-[#D6D6D9] bg-white px-3 text-[12.5px] font-extrabold text-[#111113] hover:bg-[#F4F4F5]';
const CARD = 'rounded-[20px] border border-[#E9E9EB] bg-white';

type PorCliente = { handle: string; n: number };

/** Posts (ou tarefas, se a entrega não tem post) por cliente, só os que passam no filtro de prazo. */
function contarPorCliente(linhas: LinhaCliente[], dentro: (prazo: string | null) => boolean) {
  const out: PorCliente[] = [];
  let comPost = false;
  for (const l of linhas) {
    let n = 0;
    if (l.posts.length) {
      comPost = true;
      n = l.posts.filter((p) => dentro(p.prazo ?? l.prazoMaisAntigo)).length;
    } else if (dentro(l.prazoMaisAntigo)) n = l.nTarefas || 1;
    if (n > 0) out.push({ handle: l.handle, n });
  }
  out.sort((a, b) => b.n - a.n);
  return { porCliente: out, total: out.reduce((s, c) => s + c.n, 0), un: comPost ? (['post', 'posts'] as const) : (['tarefa', 'tarefas'] as const) };
}

/** Concluídas × total das tarefas dessa entrega num período (só as dela: alteração e reaprovação contam nas próprias entregas). */
async function progressoDaEntrega(q: QuadroEntrega, de: string | null, ate: string): Promise<{ feitas: number; total: number }> {
  const e = await getEntregaCompleta(q.id).catch(() => null);
  if (!e) return { feitas: 0, total: 0 };
  const fechada = (st: string | null) => ['Concluído', 'Cancelado', 'Reprovado', 'Excluída'].includes(st ?? '');
  const ehDaqui = (t: { titulo: string; ordemUm?: string | null }) =>
    semTraco(entregaEfetiva({ titulo: t.titulo, ordemUm: t.ordemUm ?? null, entregaId: q.id }) ?? '') === semTraco(q.id);
  const ts = e.tarefasRelacionadas.filter((t) => {
    const p = t.prazo?.slice(0, 10);
    if (!p || p >= ate || (de && p < de)) return false;
    if (t.status === 'Reprovado' || t.status === 'Excluída' || t.status === 'Cancelado') return false;
    return ehDaqui(t);
  });
  const porPost = new Map<string, boolean>();
  for (const t of ts) {
    const k = t.postId ?? t.tarefaId;
    porPost.set(k, (porPost.get(k) ?? true) && fechada(t.status));
  }
  return { feitas: [...porPost.values()].filter(Boolean).length, total: porPost.size };
}

function BarraProgresso({ feitas, total, cor, alto = 8 }: { feitas: number; total: number; cor: string; alto?: number }) {
  const pct = total ? Math.round((100 * feitas) / total) : 0;
  return (
    <span className="flex flex-col gap-1">
      <span className="flex overflow-hidden rounded-full" style={{ height: alto, background: cor }}>
        <span style={{ width: `${pct}%`, background: '#2E8B57' }} />
      </span>
      <span className="text-[12px] text-[#46464B]">
        <b className="text-[#111113]">{feitas} de {total}</b> concluídas
      </span>
    </span>
  );
}

function Barra({ cs, alto = 8 }: { cs: PorCliente[]; alto?: number }) {
  return (
    <span className="flex gap-[2px] overflow-hidden rounded-full" style={{ height: alto }}>
      {cs.map((c) => (
        <span key={c.handle} title={`${c.handle} · ${c.n}`} style={{ flex: c.n, background: corDoCliente(c.handle) }} />
      ))}
    </span>
  );
}
function Legenda({ cs }: { cs: PorCliente[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {cs.map((c) => (
        <span key={c.handle} className="inline-flex items-center gap-1.5 text-[11.5px] text-[#46464B]">
          <span className="h-2 w-2 rounded-full" style={{ background: corDoCliente(c.handle) }} />
          {c.handle} <b className="text-[#111113]">{c.n}</b>
        </span>
      ))}
    </span>
  );
}
function Numero({ n, rotulo, cor = '#111113', grande = false }: { n: number; rotulo: string; cor?: string; grande?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <b className={`${grande ? 'text-[22px]' : 'text-[13px]'} font-extrabold tracking-[-0.02em]`} style={{ color: cor }}>
        {n}
      </b>
      <span className="text-[12px] font-semibold text-[#636369]">{rotulo}</span>
    </span>
  );
}

export function Secao({ n, titulo, sub }: { n: number; titulo: string; sub?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2.5 pt-2.5">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">
        {n} · {titulo}
      </span>
      {sub && <span className="text-[12.5px] text-[#8A8A90]">{sub}</span>}
    </div>
  );
}

/** Entregas da semana que vem (dia fixo depois de hoje, até 7 dias). */
export function entregasProximas(quadros: QuadroEntrega[], hoje: string) {
  const fim = soma(hoje, 7);
  return quadros
    .filter((q) => ehCiclo(q) && q.dataAtual && q.dataAtual > hoje && q.dataAtual <= fim)
    .sort((a, b) => a.dataAtual!.localeCompare(b.dataAtual!) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---- números do topo ---------------------------------------------------------

export function Kpis({ quadros, hoje, deHoje }: { quadros: QuadroEntrega[]; hoje: string; deHoje: QuadroEntrega[] }) {
  const atrasos = atrasosPorEntrega(quadros, hoje);
  const clientesAtr = new Set(atrasos.flatMap((g) => g.clientes.map((c) => c.l.projetoId || c.l.handle))).size;
  const prox = entregasProximas(quadros, hoje);
  const diasProx = [...new Set(prox.map((q) => diaSemana(q.dataAtual!)))];
  const nSem = quadros.filter((q) => /semanal/i.test(q.frequencia ?? '')).length;
  const nMen = quadros.filter((q) => /mensal/i.test(q.frequencia ?? '')).length;
  const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
  const box = (cor: Cor | 'neutro', rotulo: string, n: number, sub: string) => {
    const c = cor === 'neutro' ? { bg: '#F0F0F1', tx: '#111113' } : ST[cor];
    return (
      <div className="flex min-w-0 flex-col gap-1 rounded-[18px] px-[18px] py-4" style={{ background: c.bg, color: c.tx }}>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.07em]">{rotulo}</span>
        <b className="text-[40px] font-extrabold leading-none tracking-[-0.03em]">{n}</b>
        <span className="truncate text-[12.5px] opacity-85">{sub}</span>
      </div>
    );
  };
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {box('hoje', 'Vence hoje', deHoje.length, deHoje.length ? lista(deHoje.map((q) => q.nome)) : 'nenhuma entrega hoje')}
      {box('atr', 'Em atraso', atrasos.length, atrasos.length ? `${plural(atrasos.reduce((s, g) => s + g.total, 0), 'post vencido', 'posts vencidos')} em ${plural(atrasos.length, 'entrega', 'entregas')}` : 'tudo em dia')}
      {box('cheg', 'Próximos 7 dias', prox.length, prox.length ? lista(diasProx) : 'nada vence na semana')}
      {box('neutro', 'Entregas no total', quadros.length, `${nSem} semanais · ${nMen} mensais`)}
    </div>
  );
}

// ---- hoje ----------------------------------------------------------------------

export async function HojeCard({ q, hoje, tarefas }: { q: QuadroEntrega; hoje: string; tarefas: TarefaDeTodos[] }) {
  const prog = await progressoDaEntrega(q, ehCiclo(q) ? q.rodadaIni : hoje, ehCiclo(q) ? q.rodadaFim : soma(hoje, 1));
  const { porCliente, total, un } = contarPorCliente(q.colunas[1].linhas, (p) => p === hoje);
  const doDia = tarefas.filter((t) => { const e = entregaEfetiva(t); return !!e && semTraco(e) === semTraco(q.id); }).filter((t) => t.prazo?.slice(0, 10) === hoje);
  const comecados = doDia.filter((t) => /andamento|acompanhar/i.test(t.status ?? '')).length;
  const quem = new Map<string, number>();
  for (const t of doDia) {
    const k = t.pessoa ?? 'Sem responsável';
    quem.set(k, (quem.get(k) ?? 0) + 1);
  }
  const cliente = tipoDaEntrega(q.nome) === 'cliente';
  const quemTxt = cliente
    ? porCliente.sort((a, b) => b.n - a.n).map((c) => `${c.handle} · ${c.n}`)
    : [...quem.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n.split(' ')[0]} · ${c}`);
  return (
    <div className={`${CARD} flex flex-col gap-3.5 border-l-[6px] p-5`} style={{ borderLeftColor: '#C2417E' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-[18px]">{q.nome}</b>
        <span className="flex flex-wrap items-center gap-2">
          <Link href={rotas.entrega(q.id)} className={BTN}>
            Abrir entrega →
          </Link>
        </span>
      </div>
      {total === 0 ? (
        <span className="text-[13px] font-bold text-[#2E5520]">✓ Tudo entregue nessa rodada.</span>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5">
            <Numero n={total} rotulo={un[total === 1 ? 0 : 1]} grande />
            <Numero n={comecados} rotulo={comecados === 1 ? 'começado' : 'começados'} cor="#2E5520" grande />
          </div>
          <BarraProgresso feitas={prog.feitas} total={prog.feitas + total} cor={ST.hoje.bg} alto={10} />
        </>
      )}
      {total > 0 && <QuemBox q={q} nomes={quemTxt} />}
    </div>
  );
}

// ---- em atraso -----------------------------------------------------------------

export async function AtrasoLista({ quadros, hoje }: { quadros: QuadroEntrega[]; hoje: string }) {
  const grupos = atrasosPorEntrega(quadros, hoje);
  const progs = await Promise.all(
    grupos.map((g) => progressoDaEntrega(g.q, g.maisAntigo, ehCiclo(g.q) ? g.q.rodadaIni : hoje)),
  );
  if (grupos.length === 0) {
    return <div className={`${CARD} px-5 py-4 text-[13px] font-bold text-[#2E5520]`}>✓ Nada atrasado.</div>;
  }
  return (
    <div className={`${CARD} px-5 py-2`}>
      {grupos.map((g, i) => {
        const cs = g.clientes.map((c) => ({ handle: c.l.handle, n: c.n })).sort((a, b) => b.n - a.n);
        const n = dias(g.maisAntigo, hoje);
        return (
          <div key={g.q.id} className={`flex flex-col gap-2 border-l-[6px] border-l-[#B42318] py-3 pl-4 ${i ? 'border-t border-t-[#F4F4F5]' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-[14px]">{g.q.nome}</b>
              <span className="flex flex-wrap items-center gap-2">
                <Pill cor="atr">há {plural(n, 'dia', 'dias')}</Pill>
                <Link href={rotas.entrega(g.q.id)} className={`${BTN} !h-7 !text-[12px]`}>
                  Abrir entrega →
                </Link>
              </span>
            </div>
            <span className="flex items-center gap-3.5">
              <Numero n={g.total} rotulo={`${g.un[g.total === 1 ? 0 : 1]} ${g.total === 1 ? 'atrasado' : 'atrasados'}`} cor="#7E211C" />
            </span>
            <BarraProgresso feitas={progs[i].feitas} total={progs[i].feitas + g.total} cor={ST.atr.bg} alto={6} />
            <QuemBox q={g.q} nomes={tipoDaEntrega(g.q.nome) === 'cliente' ? cs.map((c) => `${c.handle} · ${c.n}`) : []} />
          </div>
        );
      })}
    </div>
  );
}

// ---- próximos dias -------------------------------------------------------------

export function ProximosDiasFaixa({ quadros, hoje }: { quadros: QuadroEntrega[]; hoje: string }) {
  const prox = entregasProximas(quadros, hoje);
  const diasSemana = Array.from({ length: 7 }, (_, k) => soma(hoje, k + 1));
  return (
    <div className={`${CARD} flex flex-col gap-3 p-5`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {diasSemana.map((d) => {
          const es = prox.filter((q) => q.dataAtual === d);
          return (
            <div key={d} className={`flex min-h-[150px] min-w-0 flex-col gap-2 rounded-[14px] border border-[#E9E9EB] p-2.5 ${es.length ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
              <span className="flex justify-between">
                <span className="text-[12px] font-extrabold text-[#636369]">{diaSemana(d)}</span>
                <b className="text-[15px]">{d.slice(8)}</b>
              </span>
              {es.length === 0 && <span className="text-[11.5px] text-[#B4B4B9]">nada vence</span>}
              {es.map((q) => {
                const { porCliente, total, un } = contarPorCliente(q.colunas[1].linhas, () => true);
                const cliente = tipoDaEntrega(q.nome) === 'cliente';
                const sub = cliente ? 'o cliente faz a parte dele' : tipoDaEntrega(q.nome) === 'envio' ? 'a Lud. envia pro cliente' : 'a Lud. entrega';
                return (
                  <Link key={q.id} href={rotas.entrega(q.id)} className="flex flex-col gap-1.5 rounded-[12px] p-2.5 hover:opacity-90" style={{ background: cliente ? QUEM.cliente.bg : QUEM.interna.bg, border: `1px solid ${cliente ? QUEM.cliente.borda : QUEM.interna.borda}` }}>
                    <b className="text-[12.5px] leading-tight">{q.nome}</b>
                    {total === 0 ? (
                      <span className="text-[11.5px] font-bold text-[#2E5520]">✓ nada em aberto</span>
                    ) : (
                      <span className="flex flex-wrap gap-x-2.5">
                        <span className="text-[11.5px] text-[#46464B]">
                          <b className="text-[15px] text-[#111113]">{porCliente.length}</b> {porCliente.length === 1 ? 'cliente' : 'clientes'}
                        </span>
                        <span className="text-[11.5px] text-[#46464B]">
                          <b className="text-[15px] text-[#111113]">{total}</b> {un[total === 1 ? 0 : 1]}
                        </span>
                      </span>
                    )}
                    <span className="text-[11px] text-[#636369]">{sub}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
      <span className="flex gap-2">
        <PillTipo cliente={false} />
        <PillTipo cliente />
      </span>
    </div>
  );
}

// ---- todas as entregas ---------------------------------------------------------

export function TodasEntregas({ quadros, hoje, deHoje }: { quadros: QuadroEntrega[]; hoje: string; deHoje: QuadroEntrega[] }) {
  const atrasadas = new Set(atrasosPorEntrega(quadros, hoje).map((g) => g.q.id));
  const hojeIds = new Set(deHoje.map((q) => q.id));
  const semanais = quadros.filter((q) => /semanal/i.test(q.frequencia ?? ''));
  const mensais = quadros.filter((q) => /mensal/i.test(q.frequencia ?? ''));
  const outras = quadros.filter((q) => !ehCiclo(q));
  const Cartao = ({ q }: { q: QuadroEntrega }) => {
    const nCli = new Set([...q.colunas[0].linhas, ...q.colunas[1].linhas].map((l) => l.projetoId || l.handle)).size;
    const faltam = nCli === 1 ? 'falta 1 cliente' : `faltam ${nCli} clientes`;
    const status =
      nCli === 0 ? <Pill cor="ok">em dia</Pill> : hojeIds.has(q.id) ? <Pill cor="hoje">vence hoje</Pill> : atrasadas.has(q.id) ? <Pill cor="atr">{faltam}</Pill> : <Pill cor="cinza">{faltam}</Pill>;
    return (
      <Link href={rotas.entrega(q.id)} className="flex min-w-0 flex-col gap-2 rounded-[14px] border border-[#E9E9EB] bg-white px-3.5 py-3 hover:border-[#B4B4B9]">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#636369]">{q.diaRotulo.replace(/^toda |^todo /, '').replace('mês · ', '')}</span>
        <b className="text-[13.5px] leading-tight">{q.nome}</b>
        <span className="mt-auto flex items-center justify-between gap-1">
          {status}
          <span className="text-[#8A8A90]">→</span>
        </span>
      </Link>
    );
  };
  const Grupo = ({ titulo, lista }: { titulo: string; lista: QuadroEntrega[] }) =>
    lista.length === 0 ? null : (
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-extrabold text-[#46464B]">
          {titulo} · {lista.length}
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {lista.map((q) => (
            <Cartao key={q.id} q={q} />
          ))}
        </div>
      </div>
    );
  return (
    <div className={`${CARD} flex flex-col gap-4 p-5`}>
      <Grupo titulo="Semanais" lista={semanais} />
      <Grupo titulo="Mensais" lista={mensais} />
      <Grupo titulo="Outras" lista={outras} />
      <span className="text-[11.5px] text-[#636369]">Vermelho: em atraso. Rosa: vence hoje. Cinza: ainda no prazo.</span>
    </div>
  );
}

// ---- lista única: hoje, em atraso e próximos 7 dias -----------------------------

const GRADE = 'grid grid-cols-[110px_minmax(0,1.4fr)_minmax(150px,200px)_120px_80px] items-center gap-3.5 px-5';

function EtiquetaTipo({ q }: { q: QuadroEntrega }) {
  const c = quemDe(q);
  return (
    <span className="inline-flex h-[26px] w-fit items-center whitespace-nowrap rounded-[8px] border px-2.5 text-[11.5px] font-extrabold" style={{ background: c.bg, color: c.tx, borderColor: c.borda }}>
      {tipoDaEntrega(q.nome) === 'cliente' ? 'com cliente' : 'interno'}
    </span>
  );
}

function PrazoCel({ data, sub, cor }: { data: string; sub: string; cor: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <b className="text-[13px]">
        {diaSemana(data)} {data.slice(8, 10)}/{data.slice(5, 7)}
      </b>
      <span className="text-[11.5px] font-extrabold" style={{ color: cor }}>
        {sub}
      </span>
    </span>
  );
}

function Andamento({ feitas, abertas }: { feitas: number; abertas: number }) {
  if (abertas === 0) return <span className="text-[12px] font-bold text-[#2E5520]">✓ nada em aberto</span>;
  const total = feitas + abertas;
  const pct = total ? Math.round((100 * feitas) / total) : 0;
  return (
    <span className="flex flex-col gap-1">
      <span className="flex h-1.5 overflow-hidden rounded-full bg-[#F0F0F1]">
        <span style={{ width: `${pct}%`, background: '#2E8B57' }} />
      </span>
      <span className="text-[11.5px] text-[#636369]">
        {feitas} de {total} concluídas
      </span>
    </span>
  );
}

function LinhaEntrega({ q, prazo, feitas, abertas }: { q: QuadroEntrega; prazo: React.ReactNode; feitas: number; abertas: number }) {
  return (
    <div className={`${GRADE} min-h-[56px] border-b border-[#F4F4F5] py-2 last:border-b-0`}>
      {prazo}
      <Link href={rotas.entrega(q.id)} className="truncate text-[14px] font-extrabold hover:underline">
        {q.nome}
      </Link>
      <Andamento feitas={feitas} abertas={abertas} />
      <EtiquetaTipo q={q} />
      <span className="text-right">
        <Link href={rotas.entrega(q.id)} className={`${BTN} !h-[30px]`}>
          Abrir →
        </Link>
      </span>
    </div>
  );
}

function FaixaGrupo({ titulo, sub, bg, tx }: { titulo: string; sub: string; bg: string; tx: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5" style={{ background: bg, color: tx }}>
      <b className="text-[14px]">{titulo}</b>
      <span className="text-[12.5px] font-bold">{sub}</span>
    </div>
  );
}

/** Uma tabela só: vence hoje, em atraso (do mais antigo pro mais novo) e próximos 7 dias. */
export async function ListaEntregas({ quadros, hoje, deHoje }: { quadros: QuadroEntrega[]; hoje: string; deHoje: QuadroEntrega[] }) {
  const atrasos = atrasosPorEntrega(quadros, hoje);
  const prox = entregasProximas(quadros, hoje);
  const [progHoje, progAtr, progProx] = await Promise.all([
    Promise.all(deHoje.map((q) => progressoDaEntrega(q, ehCiclo(q) ? q.rodadaIni : hoje, ehCiclo(q) ? q.rodadaFim : soma(hoje, 1)))),
    Promise.all(atrasos.map((g) => progressoDaEntrega(g.q, g.maisAntigo, ehCiclo(g.q) ? g.q.rodadaIni : hoje))),
    Promise.all(prox.map((q) => progressoDaEntrega(q, q.rodadaIni, q.rodadaFim))),
  ]);
  const abertasHoje = deHoje.map((q) => contarPorCliente(q.colunas[1].linhas, (p) => p === hoje).total);
  const abertasProx = prox.map((q) => contarPorCliente(q.colunas[1].linhas, () => true).total);
  const postsHoje = abertasHoje.reduce((s, n) => s + n, 0);
  const postsAtr = atrasos.reduce((s, g) => s + g.total, 0);
  const postsProx = abertasProx.reduce((s, n) => s + n, 0);
  const diasVazios = Array.from({ length: 7 }, (_, k) => soma(hoje, k + 1)).filter((d) => !prox.some((q) => q.dataAtual === d));
  const dataHoje = `${diaSemana(hoje)} ${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`;
  return (
    <div className={`${CARD} overflow-x-auto min-h-fit`}>
      <div className="min-w-[760px]">
        <div className={`${GRADE} border-b border-[#E9E9EB] py-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#636369]`}>
          <span>Prazo</span>
          <span>Entrega</span>
          <span>Andamento</span>
          <span>Com quem está</span>
          <span />
        </div>
        <FaixaGrupo titulo={`Vence hoje · ${dataHoje}`} sub={`${plural(deHoje.length, 'entrega', 'entregas')} · ${plural(postsHoje, 'post', 'posts')}`} bg={ST.hoje.bg} tx={ST.hoje.tx} />
        {deHoje.length === 0 && <div className="px-5 py-3 text-[13px] text-[#636369]">Nenhuma entrega vence hoje.</div>}
        {deHoje.map((q, i) => (
          <LinhaEntrega key={q.id} q={q} prazo={<PrazoCel data={hoje} sub="vence hoje" cor="#C2417E" />} feitas={progHoje[i].feitas} abertas={abertasHoje[i]} />
        ))}
        <FaixaGrupo
          titulo="Em atraso"
          sub={atrasos.length ? `${plural(atrasos.length, 'entrega', 'entregas')} · ${plural(postsAtr, 'post', 'posts')} · do mais antigo pro mais novo` : 'nada atrasado'}
          bg={ST.atr.bg}
          tx={ST.atr.tx}
        />
        {atrasos.length === 0 && <div className="px-5 py-3 text-[13px] font-bold text-[#2E5520]">✓ Nada atrasado.</div>}
        {atrasos.map((g, i) => {
          const n = dias(g.maisAntigo, hoje);
          return <LinhaEntrega key={g.q.id} q={g.q} prazo={<PrazoCel data={g.maisAntigo} sub={`há ${plural(n, 'dia', 'dias')}`} cor="#B42318" />} feitas={progAtr[i].feitas} abertas={g.total} />;
        })}
        <FaixaGrupo
          titulo="Próximos 7 dias"
          sub={`${plural(prox.length, 'entrega', 'entregas')} · ${plural(postsProx, 'post', 'posts')}${diasVazios.length ? ` · nada vence ${diasVazios.map(diaSemana).join(', ')}` : ''}`}
          bg={ST.cheg.bg}
          tx={ST.cheg.tx}
        />
        {prox.length === 0 && <div className="px-5 py-3 text-[13px] text-[#636369]">Nada vence nos próximos 7 dias.</div>}
        {prox.map((q, i) => {
          const n = dias(hoje, q.dataAtual!);
          return <LinhaEntrega key={q.id} q={q} prazo={<PrazoCel data={q.dataAtual!} sub={`em ${plural(n, 'dia', 'dias')}`} cor="#5B4BB7" />} feitas={progProx[i].feitas} abertas={abertasProx[i]} />;
        })}
      </div>
    </div>
  );
}

export function LegendaTipo() {
  return (
    <span className="flex flex-wrap items-center gap-3 text-[12px] text-[#636369]">
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-[22px] items-center rounded-[8px] border px-2 text-[11.5px] font-extrabold" style={{ background: QUEM.interna.bg, color: QUEM.interna.tx, borderColor: QUEM.interna.borda }}>interno</span>
        com a Lud.
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-[22px] items-center rounded-[8px] border px-2 text-[11.5px] font-extrabold" style={{ background: QUEM.cliente.bg, color: QUEM.cliente.tx, borderColor: QUEM.cliente.borda }}>com cliente</span>
        com o cliente
      </span>
    </span>
  );
}
