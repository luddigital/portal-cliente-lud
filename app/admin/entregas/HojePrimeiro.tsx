import { entregaEfetiva } from './quadro';
import Link from 'next/link';
import { carregarEntrega, semTraco, tipoDaEntrega } from '@/lib/entrega-dados';
import type { TarefaDeTodos } from '@/lib/notion';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { LinkPrevia } from '../_components/LinkPrevia';
import { MudarPrazo } from '../_ui/MudarPrazo';
import { Avatar, Ponto, Selo, Tag, type St } from '../_ui/lud';
import { BotaoLembreteWpp } from '../aprovacoes/BotaoLembreteWpp';
import { BotaoConcluir } from '../entrega/[id]/BotaoConcluir';
import type { ItemEntrega } from '../entrega/[id]/EntregaPorCliente';
import type { QuadroEntrega } from './quadro';

/**
 * Página de Entregas, proposta "hoje primeiro":
 * 1. Hoje é dia de: uma aba por entrega que vence hoje; a escolhida abre embaixo,
 *    cliente por cliente (entregas com o cliente) ou por pessoa (internas).
 * 2. Atrasado: o que ficou de rodadas anteriores, com o prazo editável.
 * 3. Próximos dias: o que cada entrega da semana ainda tem em aberto e com quem.
 * 4. Abrir uma entrega: atalhos, semanais e mensais.
 */

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const soma = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
const dias = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86_400_000);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const diaSemana = (iso: string) => SEMANA[new Date(utc(iso)).getUTCDay()];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const horaSP = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t);
const ehCiclo = (q: QuadroEntrega) => /semanal|mensal/i.test(q.frequencia ?? '');

function Secao({ n, titulo, sub }: { n: number; titulo: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2.5 px-0.5 pt-2">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">
        {n} · {titulo}
      </span>
      {sub && <span className="text-[12.5px] text-[#8A8A90]">{sub}</span>}
    </div>
  );
}

function Legenda({ itens }: { itens: [St, string][] }) {
  return (
    <span className="flex flex-wrap gap-3.5 text-[12px] text-[#46464B]">
      {itens.map(([st, t]) => (
        <span key={t} className="flex items-center gap-1.5">
          <Ponto st={st} />
          {t}
        </span>
      ))}
    </span>
  );
}

function BarraPartes({ partes }: { partes: [number, string][] }) {
  const tot = partes.reduce((s, [n]) => s + n, 0) || 1;
  return (
    <span className="flex h-2 gap-[2px] overflow-hidden rounded-full">
      {partes
        .filter(([n]) => n > 0)
        .map(([n, cor], i) => (
          <span key={i} style={{ flex: n / tot, background: cor }} />
        ))}
    </span>
  );
}

const BTN = 'whitespace-nowrap rounded-[10px] border border-[#D6D6D9] bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-[#111113] hover:bg-[#F4F4F5]';

// ------------------------------------------------------------------ 1 · hoje

/** Entregas com algo vencendo hoje (mais as semanais/mensais cuja rodada é hoje, mesmo fechadas). */
export function entregasDeHoje(quadros: QuadroEntrega[], hoje: string) {
  // Semanais e mensais: só no dia fixo delas (Dia da entrega no Notion), mesmo se
  // alguma tarefa tiver prazo hoje. As de todo dia / sem frequência: quando têm algo vencendo hoje.
  const comHoje = quadros.filter((q) =>
    ehCiclo(q) ? q.dataAtual === hoje : q.colunas[1].linhas.some((l) => l.prazoMaisAntigo === hoje),
  );
  const nHoje = (q: QuadroEntrega) => q.colunas[1].linhas.filter((l) => l.prazoMaisAntigo === hoje).length;
  return comHoje.sort((a, b) => {
    const ca = (ehCiclo(a) ? 0 : 2) + (tipoDaEntrega(a.nome) !== 'interna' ? 0 : 1);
    const cb = (ehCiclo(b) ? 0 : 2) + (tipoDaEntrega(b.nome) !== 'interna' ? 0 : 1);
    return ca - cb || nHoje(b) - nHoje(a) || a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

function resumoAba(q: QuadroEntrega, hoje: string): { texto: string; st: St } {
  const ls = q.colunas[1].linhas.filter((l) => l.prazoMaisAntigo === hoje);
  if (ls.length === 0) return { texto: 'rodada fechada ✓', st: 'ok' };
  if (tipoDaEntrega(q.nome) === 'interna') {
    const n = ls.reduce((s, l) => s + l.nTarefas, 0);
    return { texto: `${n === 1 ? 'falta 1 tarefa' : `faltam ${n} tarefas`}`, st: 'hoje' };
  }
  return { texto: ls.length === 1 ? 'falta 1 cliente' : `faltam ${ls.length} clientes`, st: 'hoje' };
}

export function AbasDeHoje({ abas, selecionada, hoje }: { abas: QuadroEntrega[]; selecionada: string; hoje: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto min-h-fit pb-1">
      {abas.map((q) => {
        const sel = q.id === selecionada;
        const r = resumoAba(q, hoje);
        const tipo = tipoDaEntrega(q.nome);
        return (
          <Link
            key={q.id}
            href={`/admin/entregas?aba=${semTraco(q.id)}`}
            scroll={false}
            className={`flex min-w-[220px] flex-col gap-1 rounded-[14px] border-[1.5px] px-3.5 py-2.5 ${
              sel ? 'border-[#111113] bg-[#111113] text-white' : 'border-[#E9E9EB] bg-white text-[#111113] hover:border-[#B4B4B9]'
            }`}
          >
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] opacity-75">
              {tipo === 'interna' ? 'interna · time' : tipo === 'envio' ? 'envio pro cliente' : 'esperando o cliente'}
            </span>
            <b className="text-[14px] leading-tight">{q.nome}</b>
            <span>
              <Tag st={r.st} className="!min-w-0 !text-[10.5px]">
                {r.texto}
              </Tag>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export type SituacaoItem = { texto: string; det: string; st: St; comCliente: boolean; feito: boolean };

export function situacaoDoItem(i: ItemEntrega): SituacaoItem {
  if (i.enviado || i.relacao === 'depois' || i.relacao === 'concluido') {
    return { texto: 'Feito', det: i.enviadoEm ? `às ${horaSP(i.enviadoEm)}` : '', st: 'ok', comCliente: false, feito: true };
  }
  if (i.relacao === 'antes') {
    return {
      // Status atual do post (a tarefa aberta mais cedo na ordem do processo).
      texto: cap(i.rotulo || i.atualTitulo || 'Em produção'),
      det: [i.responsavel ? `Com ${i.responsavel.split(' ')[0]}` : null, i.atualPrazo ? `até ${ddmm(i.atualPrazo)}` : null].filter(Boolean).join(' · '),
      st: 'neu',
      comCliente: false,
      feito: false,
    };
  }
  const envio = i.mensagens.length ? `${i.mensagens.length}º envio` : 'Não enviado';
  const rod = i.reaprovacao ? `Reaprovação${i.rodada > 1 ? ` · ${i.rodada}ª rodada` : ''}` : envio;
  return { texto: i.visto ? 'Visto, sem aprovação' : 'Não visto', det: rod, st: i.visto ? 'hoje' : 'atr', comCliente: true, feito: false };
}

/** Entrega com o cliente (aprovação, materiais) ou envio: um bloco por cliente, um post por linha. */
export async function HojeComCliente({
  q,
  hoje,
  de = hoje,
  ate,
  eyebrow = 'Vence hoje',
  comLinkEntrega = true,
}: {
  q: QuadroEntrega;
  hoje: string;
  de?: string;
  ate?: string;
  eyebrow?: string;
  comLinkEntrega?: boolean;
}) {
  const fim = ate ?? soma(de, 1);
  const d = await carregarEntrega(q.id);
  if (!d) return null;
  const tipo = d.tipo;
  const grupos = d.grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => { const p = i.prazo?.slice(0, 10); return !!p && p >= de && p < fim; }) }))
    .filter((g) => g.itens.length > 0)
    .map((g) => {
      const sit = g.itens.map(situacaoDoItem);
      const feitos = sit.filter((s) => s.feito).length;
      const comCliente = sit.some((s) => s.comCliente);
      const viu = g.itens.some((i, k) => sit[k].comCliente && i.visto);
      const estado: { texto: string; st: St } =
        feitos === g.itens.length
          ? { texto: tipo === 'envio' ? 'Enviado' : 'Aprovado', st: 'ok' }
          : comCliente
            ? viu
              ? { texto: 'Cliente viu, sem aprovar', st: 'hoje' }
              : { texto: 'Cliente não viu', st: 'atr' }
            : { texto: 'Em produção na Lud.', st: 'neu' };
      return { g, sit, feitos, comCliente, estado };
    })
    .sort((a, b) => {
      const ordem = (x: typeof a) => (x.estado.st === 'atr' ? 0 : x.estado.st === 'hoje' ? 1 : x.estado.st === 'neu' ? 2 : 3);
      return ordem(a) - ordem(b) || a.g.nome.localeCompare(b.g.nome, 'pt-BR');
    });

  const concluidos = grupos.flatMap(({ g, sit }) => g.itens.filter((_, k) => sit[k].feito).map((i) => ({ g, i })));
  const nCli = grupos.length;
  const nOk = grupos.filter((x) => x.estado.st === 'ok').length;
  const nNaoViu = grupos.filter((x) => x.estado.st === 'atr').length;
  const nViu = grupos.filter((x) => x.estado.st === 'hoje').length;
  const nLud = grupos.filter((x) => x.estado.st === 'neu').length;
  const faltam = nCli - nOk;

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#E9E9EB] bg-white">
      <div className="flex flex-col gap-3 bg-[#FDF1F6] px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#7A1F4C]">
              {eyebrow} · {tipo === 'envio' ? 'envio pro cliente aprovar' : 'esperando o cliente'}
            </span>
            <b className="text-[22px] font-extrabold tracking-[-0.01em]">{q.nome}</b>
            <span className="text-[13px] text-[#46464B]">
              {nCli === 0
                ? 'Nada em aberto nesse período.'
                : faltam === 0
                  ? `Todos os ${nCli} clientes fecharam. ✓`
                  : `${nOk} de ${nCli} ${nCli === 1 ? 'cliente fechou' : 'clientes fecharam'}. ${faltam === 1 ? 'Falta 1' : `Faltam ${faltam}`}: ${[
                      nNaoViu + nViu ? `${nNaoViu + nViu} com o cliente` : null,
                      nLud ? `${nLud} ainda com a Lud.` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')
                      .replace(/\.?$/, '.')}`}
            </span>
          </div>
          {comLinkEntrega && (
            <Link href={rotas.entrega(q.id)} className={BTN}>
              Abrir a entrega →
            </Link>
          )}
        </div>
        {nCli > 0 && (
          <div className="flex flex-col gap-1.5">
            <BarraPartes
              partes={[
                [nOk, '#2E7D4F'],
                [nNaoViu, '#B42318'],
                [nViu, '#C2417E'],
                [nLud, '#D6D6D9'],
              ]}
            />
            <Legenda
              itens={[
                ['ok', plural(nOk, tipo === 'envio' ? 'enviado' : 'aprovou', tipo === 'envio' ? 'enviados' : 'aprovaram')],
                ['atr', `${nNaoViu} não ${nNaoViu === 1 ? 'viu' : 'viram'}`],
                ['hoje', `${nViu} ${nViu === 1 ? 'viu' : 'viram'}, sem aprovar`],
                ['neu', `${nLud} em produção na Lud.`],
              ]}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        {grupos.filter((x) => x.estado.st !== 'ok').map(({ g, sit, comCliente, estado }) => {
          const pend = g.itens.map((i, k) => ({ i, s: sit[k] })).filter((x) => !x.s.feito);
          const nFeitos = g.itens.length - pend.length;
          const primeiraComCliente = g.itens.find((_, k) => sit[k].comCliente);
          const msgs = g.itens.reduce((s, i) => s + i.mensagens.length, 0);
          return (
            <div key={g.projetoId} className="overflow-hidden rounded-[14px] border border-[#E9E9EB] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#FAFAFA] px-3.5 py-2.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Selo handle={nomeCurtoDoProjeto(g.projetoNome || g.nome)} href={rotas.projeto(g.projetoId)} />
                  <b className="text-[13px]">{plural(pend.length, 'post', 'posts')}</b>
                  {nFeitos > 0 && <span className="text-[11.5px] text-[#2E5520]">+ {nFeitos} já {nFeitos === 1 ? 'feito' : 'feitos'}</span>}
                  <span className="flex items-center gap-1.5 text-[12px] font-bold">
                    <Ponto st={estado.st} />
                    {estado.texto}
                  </span>
                  <Tag st={comCliente ? 'cheg' : 'neu'} className="!min-w-0 !text-[10.5px]">
                    {comCliente ? 'Com o cliente' : 'Com a Lud.'}
                  </Tag>
                  <span className="text-[11.5px] text-[#636369]">{msgs ? `📱 ${plural(msgs, 'mensagem', 'mensagens')}` : 'nenhuma mensagem ainda'}</span>
                </span>
                {comCliente && primeiraComCliente && tipo !== 'envio' && (
                  <BotaoLembreteWpp
                    tarefaId={primeiraComCliente.tarefaId}
                    outrasTarefaIds={g.itens.filter((_, k) => sit[k].comCliente && !sit[k].feito).map((i) => i.tarefaId)}
                    clienteNome={g.nome}
                    rotulo="Lembrar no grupo"
                    verde
                  />
                )}
                {tipo === 'envio' && estado.st !== 'ok' && (
                  <Link href={rotas.entregaDoProjeto(g.projetoId, q.id)} className={BTN}>
                    Enviar →
                  </Link>
                )}
              </div>
              {pend.map(({ i, s }, k) => {
                return (
                  <div
                    key={i.tarefaId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 border-t border-[#F0F0F2] px-3.5 py-2.5 md:grid-cols-[minmax(0,1fr)_190px_auto_auto]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-3.5 flex-none text-[11px] text-[#8A8A90]">{k + 1}</span>
                      {i.postId ? (
                        <LinkPrevia postId={i.postId} tarefaId={i.tarefaId} className="group min-w-0">
                          <b className="block truncate text-[13px] group-hover:underline">{i.postTitulo || i.titulo}</b>
                        </LinkPrevia>
                      ) : (
                        <b className="truncate text-[13px]">{i.titulo}</b>
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className="flex items-center gap-1.5 text-[12px] font-bold">
                        <Ponto st={s.st} />
                        {s.texto}
                      </span>
                      {s.det && <span className="text-[11px] text-[#636369]">{s.det}</span>}
                    </span>
                    <span>
                      <MudarPrazo tarefaId={i.tarefaId} prazo={i.prazo?.slice(0, 10) ?? null} hoje={hoje} />
                    </span>
                    {i.postId ? (
                      <LinkPrevia postId={i.postId} tarefaId={i.tarefaId} className={`${BTN} !w-auto`}>
                        Ver prévia
                      </LinkPrevia>
                    ) : (
                      <Link href={rotas.tarefa(i.tarefaId)} className={BTN}>
                        Abrir tarefa
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {concluidos.length > 0 && (
          <details className="group rounded-[14px] border border-[#E9E9EB] bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
              <span className="text-[10px] text-[#8A8A90] transition-transform group-open:rotate-90">▶</span>
              <b className="text-[13px]">Concluídos</b>
              <Tag st="ok" className="!min-w-0 !text-[10.5px]">
                {plural(concluidos.length, 'post', 'posts')}
              </Tag>
              <span className="text-[12px] text-[#636369]">o que já passou dessa etapa</span>
            </summary>
            {concluidos.map(({ g, i }) => (
              <div key={i.tarefaId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#F0F0F2] px-3.5 py-2 md:grid-cols-[200px_minmax(0,1fr)_auto]">
                <Selo handle={nomeCurtoDoProjeto(g.projetoNome || g.nome)} href={rotas.projeto(g.projetoId)} />
                {i.postId ? (
                  <LinkPrevia postId={i.postId} tarefaId={i.tarefaId} className="group/p min-w-0">
                    <span className="block truncate text-[12.5px] font-bold group-hover/p:underline">{i.postTitulo || i.titulo}</span>
                  </LinkPrevia>
                ) : (
                  <span className="truncate text-[12.5px] font-bold">{i.titulo}</span>
                )}
                <span className="flex items-center gap-1.5 text-[12px] text-[#2E5520]">
                  <Ponto st="ok" />
                  {i.enviadoEm ? `feito às ${horaSP(i.enviadoEm)}` : 'feito'}
                </span>
              </div>
            ))}
          </details>
        )}
      </div>
    </section>
  );
}

/** Entrega interna (arte, copy, programar…): o que vence hoje, agrupado por quem faz. */
export function HojeInterna({
  q,
  hoje,
  tarefas,
  handle,
  de = hoje,
  ate,
  eyebrow = 'Vence hoje',
  comLinkEntrega = true,
}: {
  q: QuadroEntrega;
  hoje: string;
  tarefas: TarefaDeTodos[];
  handle: (projetoId: string | null) => string;
  de?: string;
  ate?: string;
  eyebrow?: string;
  comLinkEntrega?: boolean;
}) {
  const fim = ate ?? soma(de, 1);
  const doDia = tarefas.filter((t) => {
    const p = t.prazo?.slice(0, 10);
    const e = entregaEfetiva(t);
    return !!e && semTraco(e) === semTraco(q.id) && !!p && p >= de && p < fim;
  });
  const porPessoa = new Map<string, TarefaDeTodos[]>();
  for (const t of doDia) {
    const k = t.pessoa ?? 'Sem responsável';
    porPessoa.set(k, [...(porPessoa.get(k) ?? []), t]);
  }
  const pessoas = [...porPessoa.entries()].sort((a, b) => b[1].length - a[1].length);
  const nCli = new Set(doDia.map((t) => t.projetoId)).size;
  const porStatus = (re: RegExp) => doDia.filter((t) => re.test(t.status ?? '')).length;
  const andamento = porStatus(/andamento|acompanhar/i);
  const parado = doDia.length - andamento;

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#E9E9EB] bg-white">
      <div className="flex flex-col gap-2.5 bg-[#F7F7F8] px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#46464B]">{eyebrow} · interna, sem mensagem pro cliente</span>
            <b className="text-[22px] font-extrabold tracking-[-0.01em]">{q.nome}</b>
            <span className="text-[13px] text-[#46464B]">
              {doDia.length === 0
                ? 'Nada em aberto nesse período.'
                : `${plural(doDia.length, 'tarefa', 'tarefas')} pra entregar, de ${plural(nCli, 'cliente', 'clientes')}. ${andamento} em andamento, ${parado} sem começar.`}
            </span>
          </div>
          {comLinkEntrega && (
            <Link href={rotas.entrega(q.id)} className={BTN}>
              Abrir a entrega →
            </Link>
          )}
        </div>
        {doDia.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <BarraPartes
              partes={[
                [andamento, '#C2417E'],
                [parado, '#D6D6D9'],
              ]}
            />
            <Legenda
              itens={[
                ['hoje', `${andamento} em andamento`],
                ['neu', `${parado} sem começar`],
              ]}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        {pessoas.map(([nome, ts]) => (
          <div key={nome} className="overflow-hidden rounded-[14px] border border-[#E9E9EB] bg-white">
            <div className="flex items-center justify-between gap-2.5 bg-[#FAFAFA] px-3.5 py-2.5">
              <span className="flex items-center gap-2">
                <Avatar nome={nome} tam={24} />
                <b className="text-[13.5px]">{nome}</b>
                <span className="text-[12px] text-[#636369]">{plural(ts.length, 'tarefa', 'tarefas')}</span>
              </span>
            </div>
            {ts.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-[#F0F0F2] px-3.5 py-2.5 md:grid-cols-[180px_minmax(0,1fr)_120px_auto_auto_auto]"
              >
                <span className="min-w-0">
                  <Selo handle={handle(t.projetoId)} href={t.projetoId ? rotas.projeto(t.projetoId) : undefined} />
                </span>
                {t.postId ? (
                  <LinkPrevia postId={t.postId} tarefaId={t.id} className="group min-w-0">
                    <b className="block truncate text-[13px] group-hover:underline">{t.postTitulo || t.titulo}</b>
                  </LinkPrevia>
                ) : (
                  <b className="truncate text-[13px]">{t.titulo}</b>
                )}
                <span className="flex items-center gap-1.5 text-[12px] font-bold">
                  <Ponto st={/andamento|acompanhar/i.test(t.status ?? '') ? 'hoje' : 'neu'} />
                  {(t.status ?? 'sem status').toLowerCase()}
                </span>
                <span>
                  <MudarPrazo tarefaId={t.id} prazo={t.prazo?.slice(0, 10) ?? null} hoje={hoje} />
                </span>
                <Link href={rotas.tarefa(t.id)} className={BTN}>
                  Abrir
                </Link>
                <BotaoConcluir tarefaId={t.id} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 2 · atrasado

export function Atrasados({ quadros, hoje, mostrarEntrega = true }: { quadros: QuadroEntrega[]; hoje: string; mostrarEntrega?: boolean }) {
  const linhas = quadros.flatMap((q) =>
    q.colunas[0].linhas.flatMap((l) =>
      l.posts.length
        ? l.posts.map((p) => ({ q, l, chave: p.tarefaId, titulo: p.titulo, postId: p.id, tarefaId: p.tarefaId, prazo: p.prazo ?? l.prazoMaisAntigo }))
        : [{ q, l, chave: l.tarefaId, titulo: l.detalhe ?? `${l.qtd} ${l.unidade}`, postId: null as string | null, tarefaId: l.tarefaId, prazo: l.prazoMaisAntigo }],
    ),
  );
  linhas.sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''));
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#E9E9EB] bg-white">
      <div className="flex flex-col gap-1 px-5 pb-2.5 pt-4">
        <span className="flex items-baseline gap-2.5">
          <b className="text-[15px]">Ficou de rodadas anteriores</b>
          {linhas.length > 0 && <Tag st="atr">{plural(linhas.length, 'atrasado', 'atrasados')}</Tag>}
        </span>
        <span className="text-[12.5px] text-[#636369]">Clique na data pra passar pra outro dia. O que é com o cliente tem o lembrete no grupo.</span>
      </div>
      {linhas.length === 0 ? (
        <div className="flex items-center gap-2.5 border-t border-[#F0F0F2] px-5 py-3 text-[13px] text-[#46464B]">
          <Ponto st="ok" />
          Nada atrasado de rodadas anteriores.
        </div>
      ) : (
        linhas.map((x) => {
          const comCliente = tipoDaEntrega(x.q.nome) === 'cliente';
          const n = x.prazo ? dias(x.prazo, hoje) : 0;
          return (
            <div
              key={x.chave}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 border-t border-[#F0F0F2] px-5 py-2.5 md:grid-cols-[200px_minmax(0,1fr)_auto_auto]"
            >
              <span className="flex flex-col gap-1">
                <Selo handle={x.l.handle} href={x.l.projetoId ? rotas.projeto(x.l.projetoId) : undefined} />
                {mostrarEntrega && <span className="text-[11.5px] text-[#636369]">{x.q.nome}</span>}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                {x.postId ? (
                  <LinkPrevia postId={x.postId} tarefaId={x.tarefaId} className="group min-w-0">
                    <b className="block truncate text-[13px] group-hover:underline">{x.titulo}</b>
                  </LinkPrevia>
                ) : (
                  <b className="truncate text-[13px]">{x.titulo}</b>
                )}
                <span className="flex items-center gap-1.5 text-[11.5px] text-[#7E211C]">
                  <Ponto st="atr" />
                  {x.prazo ? `venceu ${ddmm(x.prazo)}, há ${plural(n, 'dia', 'dias')}` : 'sem data'}
                  <Tag st={comCliente ? 'cheg' : 'neu'} className="!min-w-0 !text-[10.5px]">
                    {comCliente ? 'com o cliente' : 'com a Lud.'}
                  </Tag>
                </span>
              </span>
              <span>
                <MudarPrazo tarefaId={x.tarefaId} prazo={x.prazo} hoje={hoje} />
              </span>
              {comCliente ? (
                <BotaoLembreteWpp tarefaId={x.tarefaId} clienteNome={x.l.clienteNome} rotulo="Lembrar" verde />
              ) : x.postId ? (
                <LinkPrevia postId={x.postId} tarefaId={x.tarefaId} className={`${BTN} !w-auto`}>
                  Ver prévia
                </LinkPrevia>
              ) : (
                <Link href={rotas.tarefa(x.tarefaId)} className={BTN}>
                  Abrir tarefa
                </Link>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

// ------------------------------------------------------------------ 3 · próximos dias

export function ProximosDias({ quadros, hoje }: { quadros: QuadroEntrega[]; hoje: string }) {
  const fim = soma(hoje, 7);
  const lista = quadros
    .filter((q) => ehCiclo(q) && q.dataAtual && q.dataAtual > hoje && q.dataAtual <= fim)
    .sort((a, b) => a.dataAtual!.localeCompare(b.dataAtual!) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#E9E9EB] bg-white">
      <div className="flex flex-col gap-1 px-5 pb-2.5 pt-4">
        <b className="text-[15px]">Próximos dias</b>
        <span className="text-[12.5px] text-[#636369]">O que cada entrega dos próximos 7 dias ainda tem em aberto, e com quem está.</span>
      </div>
      {lista.length === 0 && <div className="border-t border-[#F0F0F2] px-5 py-3 text-[13px] text-[#636369]">Nenhuma entrega nos próximos dias.</div>}
      {lista.map((q) => {
        const ls = q.colunas[1].linhas;
        const tarefas = ls.reduce((s, l) => s + l.nTarefas, 0);
        const cli = new Set(ls.map((l) => l.projetoId || l.handle)).size;
        const quem = new Map<string, number>();
        for (const l of ls) for (const p of l.porPessoa) quem.set(p.nome, (quem.get(p.nome) ?? 0) + p.n);
        const quemTxt = [...quem.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([n, c]) => `${c} com ${n.split(' ')[0]}`)
          .join(', ');
        const cliente = tipoDaEntrega(q.nome) === 'cliente';
        return (
          <Link
            key={q.id}
            href={rotas.entrega(q.id)}
            className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 border-t border-[#F0F0F2] px-5 py-3 hover:bg-[#FAFAFA] md:grid-cols-[80px_minmax(0,1.1fr)_minmax(0,1.6fr)_auto]"
          >
            <span className="flex flex-col">
              <b className="text-[13px] uppercase">{diaSemana(q.dataAtual!)}</b>
              <span className="text-[12px] text-[#636369]">{ddmm(q.dataAtual!)}</span>
            </span>
            <span className="flex flex-col">
              <b className="text-[14px]">{q.nome}</b>
              <span className="text-[12px] text-[#636369]">{cliente ? 'o cliente faz a parte dele' : tipoDaEntrega(q.nome) === 'envio' ? 'a Lud. envia pro cliente' : 'a Lud. entrega'}</span>
            </span>
            <span className="col-span-2 flex flex-col gap-0.5 md:col-span-1">
              {tarefas === 0 ? (
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold">
                  <Ponto st="ok" />
                  nada em aberto
                </span>
              ) : (
                <>
                  <b className="text-[12.5px]">
                    {plural(tarefas, 'tarefa em aberto', 'tarefas em aberto')} · {plural(cli, 'cliente', 'clientes')}
                  </b>
                  <span className="text-[12px] text-[#46464B]">{cliente ? 'é o cliente que faz' : quemTxt || 'sem responsável no Notion'}</span>
                </>
              )}
            </span>
            <span className="hidden whitespace-nowrap rounded-[10px] border border-[#D6D6D9] bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-[#111113] md:block">Abrir entrega →</span>
          </Link>
        );
      })}
    </section>
  );
}

/** Próxima rodada de UMA entrega: quem já tem tarefa criada e os posts. */
export function ProximaRodada({ q }: { q: QuadroEntrega }) {
  // Só a rodada seguinte (não tudo o que já existe pra frente).
  const ini = q.rodadaFim;
  const fim = /semanal/i.test(q.frequencia ?? '')
    ? soma(ini, 7)
    : /mensal/i.test(q.frequencia ?? '')
      ? new Date(Date.UTC(+ini.slice(0, 4), +ini.slice(5, 7), 1)).toISOString().slice(0, 10)
      : soma(ini, 1);
  const dentro = (p: string | null) => !!p && p >= ini && p < fim;
  const ls = q.colunas[2].linhas
    .map((l) => ({ ...l, posts: l.posts.filter((p) => dentro(p.prazo)) }))
    .filter((l) => (l.posts.length ? true : dentro(l.prazoMaisAntigo)));
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#E9E9EB] bg-white">
      <div className="flex flex-col gap-1 px-5 pb-2.5 pt-4">
        <span className="flex items-baseline gap-2.5">
          <b className="text-[15px]">Próxima rodada</b>
          <span className="text-[12.5px] text-[#636369]">{q.colunas[2].periodo}</span>
          {ls.length > 0 && <Tag st="cheg">{plural(ls.length, 'cliente', 'clientes')}</Tag>}
        </span>
        <span className="text-[12.5px] text-[#636369]">Quem já tem tarefa criada no Notion pra próxima rodada, e com quem está.</span>
      </div>
      {ls.length === 0 && <div className="border-t border-[#F0F0F2] px-5 py-3 text-[13px] text-[#636369]">Nada criado ainda pra próxima rodada.</div>}
      {ls.map((l) => (
        <div
          key={l.projetoId || l.handle}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 border-t border-[#F0F0F2] px-5 py-3 md:grid-cols-[200px_minmax(0,1fr)_auto]"
        >
          <span className="flex flex-col gap-1">
            <Selo handle={l.handle} href={l.projetoId ? rotas.projeto(l.projetoId) : undefined} />
            <span className="text-[11.5px] text-[#636369]">
              {l.posts.length ? plural(l.posts.length, 'post', 'posts') : `${l.qtd} ${l.unidade}`}
              {l.posts[0]?.prazo ? ` · ${ddmm(l.posts[0].prazo)}` : l.prazoMaisAntigo ? ` · ${ddmm(l.prazoMaisAntigo)}` : ''}
            </span>
          </span>
          <span className="col-span-2 flex min-w-0 flex-col gap-0.5 md:col-span-1">
            {l.posts.length
              ? l.posts.slice(0, 4).map((p) => (
                  <LinkPrevia key={p.id} postId={p.id} tarefaId={p.tarefaId} className="group min-w-0">
                    <span className="block truncate text-[12.5px] font-bold group-hover:underline">{p.titulo}</span>
                  </LinkPrevia>
                ))
              : <span className="text-[12.5px] text-[#46464B]">{l.detalhe ?? ''}</span>}
            {l.posts.length > 4 && l.projetoId && (
              <Link href={rotas.entregaDoProjeto(l.projetoId, q.id)} className="text-[12px] font-bold text-[#46464B] hover:underline">
                + {l.posts.length - 4} {l.posts.length - 4 === 1 ? 'post' : 'posts'}
              </Link>
            )}
          </span>
          <span className="hidden text-[12px] text-[#46464B] md:block">
            {l.porPessoa.length ? `com ${l.porPessoa.slice(0, 2).map((p) => p.nome.split(' ')[0]).join(' e ')}` : ''}
          </span>
        </div>
      ))}
    </section>
  );
}

// ------------------------------------------------------------------ 4 · atalhos

export function AbrirUmaEntrega({ quadros, atual, titulo = 'Abrir uma entrega' }: { quadros: QuadroEntrega[]; atual?: string; titulo?: string }) {
  const semanais = quadros.filter((q) => /semanal/i.test(q.frequencia ?? ''));
  const mensais = quadros.filter((q) => /mensal/i.test(q.frequencia ?? ''));
  const Linha = ({ q }: { q: QuadroEntrega }) => {
    const nA = q.colunas[0].linhas.length;
    const nB = q.colunas[1].linhas.length;
    const st: St = nA ? 'atr' : nB ? 'cheg' : 'ok';
    const txt = nA ? plural(nA, 'cliente atrasado', 'clientes atrasados') : nB ? (nB === 1 ? 'falta 1 cliente' : `faltam ${nB} clientes`) : 'em dia';
    return (
      <Link
        href={rotas.entrega(q.id)}
        className={`grid grid-cols-[70px_minmax(0,1fr)_auto_14px] items-center gap-2.5 border-t border-[#F0F0F2] px-1 py-2.5 hover:bg-[#FAFAFA] ${
          atual && semTraco(q.id) === semTraco(atual) ? 'bg-[#F4F4F5]' : ''
        }`}
      >
        <span className="text-[11.5px] font-extrabold text-[#636369]">{q.diaRotulo.replace(/^toda |^todo /, '').replace('mês · ', '')}</span>
        <span className="flex min-w-0 items-center gap-2">
          <Ponto st={st} />
          <b className="truncate text-[13px]">{q.nome}</b>
        </span>
        <span className="whitespace-nowrap text-[11.5px] text-[#636369]">{txt}</span>
        <span className="text-[12px] text-[#8A8A90]">→</span>
      </Link>
    );
  };
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-[#E9E9EB] bg-white px-5 py-4">
      <div className="flex flex-col gap-1">
        <b className="text-[15px]">{titulo}</b>
        <span className="text-[12.5px] text-[#636369]">Atalho pra página de cada entrega, onde você vê todos os clientes e gerencia.</span>
      </div>
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">Semanais</span>
          {semanais.map((q) => (
            <Linha key={q.id} q={q} />
          ))}
        </div>
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">Mensais</span>
          {mensais.map((q) => (
            <Linha key={q.id} q={q} />
          ))}
        </div>
      </div>
    </section>
  );
}

export { Secao };
