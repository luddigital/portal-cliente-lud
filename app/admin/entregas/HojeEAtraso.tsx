import Link from 'next/link';
import { LinkPrevia } from '../_components/LinkPrevia';
import { entregaEfetiva } from './quadro';
import { carregarEntrega, semTraco, tipoDaEntrega } from '@/lib/entrega-dados';
import type { TarefaDeTodos } from '@/lib/notion';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { Avatar, Ponto, Tag, type St } from '../_ui/lud';
import { BotaoLembreteWpp } from '../aprovacoes/BotaoLembreteWpp';
import { situacaoDoItem } from './HojePrimeiro';
import type { QuadroEntrega } from './quadro';

/**
 * Entregas · "Hoje e em atraso", lado a lado.
 * Um nível acima da página de cada entrega: por cliente (ou por pessoa, nas internas),
 * sem abrir post por post. O detalhe de cada post fica na página da entrega.
 */

const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const soma = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
const dias = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86_400_000);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const primeiro = (nome: string | null) => (nome ? nome.split(' ')[0] : '');
const BTN = 'inline-flex h-[30px] items-center whitespace-nowrap rounded-[10px] border border-[#D6D6D9] bg-white px-3 text-[12px] font-extrabold text-[#111113] hover:bg-[#F4F4F5]';
const CARD = 'flex flex-col gap-2.5 rounded-[20px] border border-[#E9E9EB] bg-white p-5';

function Inicial({ handle }: { handle: string }) {
  return (
    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#111113] text-[9px] font-extrabold text-white">
      {(handle.replace(/^@/, '')[0] ?? '?').toUpperCase()}
    </span>
  );
}

function CabecalhoCard({ eyebrow, cor, titulo, id }: { eyebrow: string; cor: string; titulo: string; id: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex flex-col gap-0.5">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: cor }}>
          {eyebrow}
        </span>
        <b className="text-[17px] font-extrabold">{titulo}</b>
      </span>
      <Link href={rotas.entrega(id)} className={BTN}>
        Abrir entrega →
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------ hoje · com o cliente

/** Entrega com o cliente: barra de quem já fechou e uma linha por cliente. */
export async function HojeClienteCard({ q, hoje }: { q: QuadroEntrega; hoje: string }) {
  const d = await carregarEntrega(q.id);
  if (!d) return null;
  const tipo = d.tipo;
  const fim = soma(hoje, 1);
  const grupos = d.grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => { const p = i.prazo?.slice(0, 10); return !!p && p >= hoje && p < fim; }) }))
    .filter((g) => g.itens.length > 0)
    .map((g) => {
      const sit = g.itens.map(situacaoDoItem);
      const pend = g.itens.map((i, k) => ({ i, s: sit[k] })).filter((x) => !x.s.feito);
      const comCliente = pend.some((x) => x.s.comCliente);
      const viu = pend.some((x) => x.s.comCliente && x.i.visto);
      const ludPrimeiro = pend.find((x) => !x.s.comCliente)?.i ?? null;
      let estado: { texto: string; st: St; ordem: number };
      if (pend.length === 0) estado = { texto: tipo === 'envio' ? 'enviado' : 'aprovado', st: 'ok', ordem: 4 };
      else if (comCliente) estado = viu ? { texto: 'viu, sem aprovar', st: 'hoje', ordem: 1 } : { texto: 'não viu', st: 'atr', ordem: 0 };
      else {
        const etapa = (ludPrimeiro?.rotulo || ludPrimeiro?.atualTitulo || 'em produção').toLowerCase();
        const quem = primeiro(ludPrimeiro?.responsavel ?? null);
        estado = { texto: quem ? `${etapa} com ${quem}` : etapa, st: 'neu', ordem: 2 };
      }
      return { g, pend, comCliente, estado, handle: nomeCurtoDoProjeto(g.projetoNome || g.nome) };
    })
    .sort((a, b) => a.estado.ordem - b.estado.ordem || a.handle.localeCompare(b.handle, 'pt-BR'));

  const nOk = grupos.filter((x) => x.estado.st === 'ok').length;
  const nNaoViu = grupos.filter((x) => x.estado.st === 'atr').length;
  const nViu = grupos.filter((x) => x.estado.st === 'hoje').length;
  const nLud = grupos.filter((x) => x.estado.st === 'neu').length;
  const tot = grupos.length || 1;
  const abertos = grupos.filter((x) => x.estado.st !== 'ok');
  const aprovados = grupos.filter((x) => x.estado.st === 'ok');

  return (
    <div className={CARD}>
      <CabecalhoCard eyebrow={`Vence hoje · ${tipo === 'envio' ? 'a Lud. envia' : 'com o cliente'}`} cor="#7A1F4C" titulo={q.nome} id={q.id} />
      {grupos.length > 0 && (
        <>
          <span className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {(
              [
                [nOk, '#2E7D4F'],
                [nNaoViu, '#B42318'],
                [nViu, '#C2417E'],
                [nLud, '#B4B4B9'],
              ] as [number, string][]
            )
              .filter(([n]) => n > 0)
              .map(([n, cor], i) => (
                <span key={i} style={{ flex: n / tot, background: cor }} />
              ))}
          </span>
          <span className="flex flex-wrap gap-3 text-[11.5px] text-[#46464B]">
            <span className="flex items-center gap-1.5"><Ponto st="ok" />{nOk} {tipo === 'envio' ? (nOk === 1 ? 'enviado' : 'enviados') : nOk === 1 ? 'aprovou' : 'aprovaram'}</span>
            <span className="flex items-center gap-1.5 text-[#B42318]"><Ponto st="atr" />{nNaoViu} não {nNaoViu === 1 ? 'viu' : 'viram'}</span>
            <span className="flex items-center gap-1.5 text-[#C2417E]"><Ponto st="hoje" />{nViu} {nViu === 1 ? 'viu' : 'viram'}</span>
            <span className="flex items-center gap-1.5"><Ponto st="neu" />{nLud} ainda com a Lud.</span>
          </span>
        </>
      )}
      <div className="flex flex-col">
        {grupos.length === 0 && <span className="text-[13px] text-[#636369]">Nada vence hoje nessa entrega.</span>}
        {abertos.map(({ g, pend, comCliente, estado, handle }) => {
          const comClienteItem = pend.find((x) => x.s.comCliente)?.i;
          const primeiraPend = pend[0]?.i;
          return (
            <div key={g.projetoId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 border-t border-[#F4F4F5] py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Link href={rotas.entregaDoProjeto(g.projetoId, q.id)} className="flex min-w-0 items-center gap-2 hover:underline">
                <Inicial handle={handle} />
                <b className="truncate text-[13px]">{handle}</b>
                <span className="whitespace-nowrap text-[12px] text-[#636369]">{plural(pend.length, 'post', 'posts')}</span>
              </Link>
              <Tag st={estado.st} className="!min-w-0 !text-[11px]">{estado.texto}</Tag>
              <span className="col-span-2 justify-self-end sm:col-span-1">
                {comCliente && comClienteItem && tipo !== 'envio' ? (
                  <BotaoLembreteWpp tarefaId={comClienteItem.tarefaId} clienteNome={g.nome} rotulo="📱 Lembrar" verde />
                ) : tipo === 'envio' ? (
                  <Link href={rotas.entregaDoProjeto(g.projetoId, q.id)} className={BTN}>Enviar →</Link>
                ) : primeiraPend ? (
                  primeiraPend.postId ? (
                    <LinkPrevia postId={primeiraPend.postId} tarefaId={primeiraPend.tarefaId} className={`${BTN} !w-auto`}>Ver prévia</LinkPrevia>
                  ) : (
                    <Link href={rotas.tarefa(primeiraPend.tarefaId)} className={BTN}>Ver tarefa</Link>
                  )
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      {aprovados.length > 0 && (
        <span className="text-[12px] text-[#2E5520]">
          ✓ {tipo === 'envio' ? 'Enviado' : 'Aprovou'}: {aprovados.map((x) => x.handle).join(', ')}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ hoje · interna

/** Entrega interna (arte, copy, programar…): por pessoa, com quantas tarefas e em que pé estão. */
export function HojeInternaCard({ q, hoje, tarefas }: { q: QuadroEntrega; hoje: string; tarefas: TarefaDeTodos[] }) {
  const doDia = tarefas.filter((t) => { const e = entregaEfetiva(t); return !!e && semTraco(e) === semTraco(q.id); }).filter((t) => t.prazo?.slice(0, 10) === hoje);
  const porPessoa = new Map<string, TarefaDeTodos[]>();
  for (const t of doDia) {
    const k = t.pessoa ?? 'Sem responsável';
    porPessoa.set(k, [...(porPessoa.get(k) ?? []), t]);
  }
  const pessoas = [...porPessoa.entries()].sort((a, b) => b[1].length - a[1].length);
  const un = /arte/i.test(q.nome) ? ['arte', 'artes'] : ['tarefa', 'tarefas'];
  return (
    <div className={CARD}>
      <CabecalhoCard eyebrow="Vence hoje · interno" cor="#7A1F4C" titulo={q.nome} id={q.id} />
      <div className="flex flex-col">
        {pessoas.length === 0 && <span className="text-[13px] text-[#636369]">Nada vence hoje nessa entrega.</span>}
        {pessoas.map(([nome, ts]) => {
          const contagem = new Map<string, number>();
          for (const t of ts) {
            const st = (t.status ?? 'sem status').toLowerCase();
            const rot = /andamento|acompanhar/.test(st) ? 'em produção' : /revis/.test(st) ? 'em revisão' : /n[aã]o inici|parad|sem status|^a fazer/.test(st) ? 'não começou' : st;
            contagem.set(rot, (contagem.get(rot) ?? 0) + 1);
          }
          return (
            <div key={nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[#F4F4F5] py-2.5">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <Avatar nome={nome} tam={20} />
                  <b className="text-[13px]">{nome.split(' ')[0]}</b>
                  <span className="text-[12px] text-[#636369]">{plural(ts.length, un[0], un[1])}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {[...contagem.entries()].map(([rot, n]) => (
                    <Tag key={rot} st={rot === 'em produção' ? 'hoje' : rot === 'em revisão' ? 'cheg' : 'neu'} className="!min-w-0 !text-[11px]">
                      {n} {rot}
                    </Tag>
                  ))}
                </span>
              </span>
              <Link href={`${rotas.tarefas()}?pessoa=${encodeURIComponent(nome)}`} className={BTN}>
                Ver tarefas
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ em atraso

/** Posts de rodadas anteriores, com o prazo editável e o lembrete (ou a tarefa). */
/**
 * Tudo que já venceu e continua aberto: das rodadas anteriores (coluna Atrasado)
 * e também da rodada atual com prazo antes de hoje (ex.: entrega mensal do dia 05
 * que ainda não fechou no dia 28).
 */
export function itensAtrasados(quadros: QuadroEntrega[], hoje: string) {
  const linhas = quadros.flatMap((q) =>
    [...q.colunas[0].linhas, ...q.colunas[1].linhas].flatMap((l) => {
      if (l.posts.length) {
        return l.posts
          .map((p) => ({ q, l, chave: p.tarefaId, titulo: p.titulo, postId: p.id as string | null, tarefaId: p.tarefaId, prazo: p.prazo ?? l.prazoMaisAntigo }))
          .filter((x) => !!x.prazo && x.prazo < hoje);
      }
      if (!l.prazoMaisAntigo || l.prazoMaisAntigo >= hoje) return [];
      return [{ q, l, chave: l.tarefaId, titulo: l.detalhe ?? `${l.qtd} ${l.unidade}`, postId: null as string | null, tarefaId: l.tarefaId, prazo: l.prazoMaisAntigo }];
    }),
  );
  return linhas.sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''));
}

/** Atrasos agrupados por entrega e, dentro, por cliente (lógica de entrega, não de post). */
export function atrasosPorEntrega(quadros: QuadroEntrega[], hoje: string) {
  const itens = itensAtrasados(quadros, hoje);
  const porEntrega = new Map<string, { q: QuadroEntrega; clientes: Map<string, { l: (typeof itens)[number]['l']; n: number; maisAntigo: string; tarefaId: string }> }>();
  for (const x of itens) {
    const e = porEntrega.get(x.q.id) ?? { q: x.q, clientes: new Map() };
    const k = x.l.projetoId || x.l.handle;
    const c = e.clientes.get(k);
    const prazo = x.prazo ?? hoje;
    if (!c) e.clientes.set(k, { l: x.l, n: 1, maisAntigo: prazo, tarefaId: x.tarefaId });
    else {
      c.n += 1;
      if (prazo < c.maisAntigo) {
        c.maisAntigo = prazo;
        c.tarefaId = x.tarefaId;
      }
    }
    porEntrega.set(x.q.id, e);
  }
  return [...porEntrega.values()]
    .map((e) => {
      const clientes = [...e.clientes.values()].sort((a, b) => a.maisAntigo.localeCompare(b.maisAntigo) || b.n - a.n);
      const comPost = clientes.some((c) => c.l.posts.length > 0);
      return { q: e.q, clientes, total: clientes.reduce((s, c) => s + c.n, 0), un: comPost ? ['post', 'posts'] : ['tarefa', 'tarefas'], maisAntigo: clientes[0]?.maisAntigo ?? hoje };
    })
    .sort((a, b) => a.maisAntigo.localeCompare(b.maisAntigo) || b.total - a.total);
}

export function EmAtrasoCard({ quadros, hoje }: { quadros: QuadroEntrega[]; hoje: string }) {
  const grupos = atrasosPorEntrega(quadros, hoje);
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-[#E9E9EB] bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#7E211C]">Venceu e ainda está aberto</span>
          <b className="text-[17px] font-extrabold">{grupos.length === 0 ? 'Nada atrasado' : plural(grupos.length, 'entrega atrasada', 'entregas atrasadas')}</b>
        </span>
        {grupos.length > 0 && <Tag st="atr">decidir hoje</Tag>}
      </div>
      {grupos.length === 0 && (
        <span className="flex items-center gap-2 border-t border-[#F4F4F5] pt-3 text-[13px] text-[#46464B]">
          <Ponto st="ok" />
          Tudo em dia.
        </span>
      )}
      {grupos.map((g) => {
        const comCliente = tipoDaEntrega(g.q.nome) === 'cliente';
        const n = dias(g.maisAntigo, hoje);
        return (
          <details key={g.q.id} open={grupos.length <= 4} className="group/at border-t border-[#F4F4F5] py-2.5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#8A8A90] transition group-open/at:rotate-90">▸</span>
                  <b className="truncate text-[14px] font-extrabold">{g.q.nome}</b>
                </span>
                <span className="pl-[18px] text-[12px] text-[#636369]">
                  {plural(g.clientes.length, 'cliente', 'clientes')} · {plural(g.total, g.un[0], g.un[1])} · {comCliente ? 'com o cliente' : 'interno · Lud.'}
                </span>
              </span>
              <Tag st="atr" className="!min-w-0 shrink-0 !text-[11px]">
                venceu {ddmm(g.maisAntigo)} · há {plural(n, 'dia', 'dias')}
              </Tag>
            </summary>
            <div className="mt-2 flex flex-col gap-1.5 pl-[18px]">
              {g.clientes.map((c) => (
                <div key={c.l.projetoId || c.l.handle} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[#FAFAFA] px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Inicial handle={c.l.handle} />
                    <Link href={c.l.projetoId ? rotas.projeto(c.l.projetoId) : '#'} className="truncate text-[13px] font-extrabold hover:underline">
                      {c.l.handle}
                    </Link>
                    <span className="whitespace-nowrap text-[12px] text-[#636369]">
                      {plural(c.n, g.un[0], g.un[1])} · desde {ddmm(c.maisAntigo)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {comCliente && <BotaoLembreteWpp tarefaId={c.tarefaId} clienteNome={c.l.clienteNome} rotulo="📱 Lembrar" verde />}
                    {c.l.projetoId && (
                      <Link href={rotas.entregaDoProjeto(c.l.projetoId, g.q.id)} className={BTN}>
                        Resolver →
                      </Link>
                    )}
                  </span>
                </div>
              ))}
              <Link href={rotas.entrega(g.q.id)} className="self-start pt-0.5 text-[12px] font-extrabold text-[#46464B] hover:text-[#111113]">
                Abrir entrega com todos os clientes →
              </Link>
            </div>
          </details>
        );
      })}
      {grupos.length > 0 && <span className="pt-1 text-[11.5px] text-[#636369]">Em "Resolver" você muda as datas ou conclui post por post.</span>}
    </div>
  );
}
