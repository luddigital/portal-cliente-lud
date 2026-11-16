import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  listAllClientes,
  listAllProjetos,
  listPostsNoIntervalo,
  listarTarefasAbertasDeTodos,
  type PostCalendario,
  type TarefaDeTodos,
} from '@/lib/notion';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { BotaoAtualizar } from './_components/BotaoAtualizar';
import { Barra, Cabecalho, Card, Pagina, Ponto, ST, Tag, TituloCard, Vazio, hojeSP, somaDias, type St } from './_ui/lud';
import { MesDaLud } from './_ui/MesDaLud';
import { CardProjeto, carregarProjetos } from './_ui/ProjetosCards';
import { TarefasDoDia } from './_ui/TarefasDoDia';
import { CalendarioSemanaHome } from './_ui/CalendarioSemanaHome';
import { montarSemana } from './_ui/semanaHome';
import { carregarQuadro, type LinhaCliente, type QuadroEntrega } from './entregas/quadro';
import { entregasDeHoje } from './entregas/HojePrimeiro';
import { tipoDaEntrega } from '@/lib/entrega-dados';

/** Linhas que já venceram: rodadas anteriores + rodada atual com prazo antes de hoje. */
function linhasAtrasadas(q: { colunas: { linhas: LinhaCliente[] }[] }, hoje: string): LinhaCliente[] {
  return [...q.colunas[0].linhas, ...q.colunas[1].linhas.filter((l) => !!l.prazoMaisAntigo && l.prazoMaisAntigo < hoje)];
}

export const dynamic = 'force-dynamic';

const semTraco = (s: string) => s.replace(/-/g, '');
const NOMES_DIA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

function dataPorExtenso(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
  return t[0].toUpperCase() + t.slice(1).replace('-feira', '');
}

/** Dashboard da proposta NOVA: entregas do dia, semana, entregas pendentes, mês da Lud. e projetos. */
export default async function AdminPage({ searchParams }: { searchParams: { semana?: string; dia?: string; tipo?: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/');
  const hoje = hojeSP();
  return (
    <Pagina>
      <Cabecalho eyebrow={dataPorExtenso(hoje)} titulo="Gestão de Projetos" acoes={<BotaoAtualizar variante="compacto" />} />
      <Suspense fallback={<div className="h-[190px] animate-pulse rounded-[20px] border border-[#E9E9EB] bg-white" />}>
        <EntregasDoDia aba={searchParams.dia === 'atrasos' ? 'atrasos' : 'hoje'} />
      </Suspense>
      <Suspense fallback={<div className="h-[380px] animate-pulse rounded-[20px] border border-[#E9E9EB] bg-white" />}>
        <SemanaDosPosts deslocamento={Number(searchParams.semana) || 0} />
      </Suspense>
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[20px] border border-[#E9E9EB] bg-white" />}>
        <EntregasPendentes />
      </Suspense>
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[20px] border border-[#E9E9EB] bg-white" />}>
        <MesComNumeros />
      </Suspense>
      <Suspense fallback={<div className="h-[520px] animate-pulse rounded-[20px] border border-[#E9E9EB] bg-white" />}>
        <ProjetosDestaque tipo={searchParams.tipo ?? ''} />
      </Suspense>
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[20px] border border-[#E9E9EB] bg-white" />}>
        <TarefasDoDiaBloco />
      </Suspense>
    </Pagina>
  );
}

// ---------------------------------------------------------------- dados
async function dados() {
  const [tarefas, projetos] = await Promise.all([
    listarTarefasAbertasDeTodos().catch(() => [] as TarefaDeTodos[]),
    listAllProjetos().catch(() => []),
  ]);
  const nome = new Map(projetos.map((p) => [semTraco(p.id), p.nome]));
  const handle = (t: TarefaDeTodos) => (t.projetoId ? nomeCurtoDoProjeto(nome.get(semTraco(t.projetoId))) : null);
  return { tarefas, handle };
}

/** "Aprovação | Post" e "Aprovação | Post 2" viram a mesma etapa. */
const etapaDe = (titulo: string) => titulo.replace(/\s+\d+$/, '').trim();

// ---------------------------------------------------------------- entregas do dia
/**
 * Mesma lógica da página de Entregas: conta ENTREGAS (Aprovação | Post, Arte…),
 * não tarefas soltas. Hoje = entregas cujo dia é hoje (semanal/mensal no dia fixo).
 * Atrasos = entregas com rodada passada ainda aberta.
 */
async function EntregasDoDia({ aba }: { aba: 'hoje' | 'atrasos' }) {
  const { hoje, quadros } = await carregarQuadro().catch(() => ({ hoje: hojeSP(), quadros: [] as QuadroEntrega[] }));
  const dm = (d: string | null) => (d ? `${d.slice(8)}/${d.slice(5, 7)}` : '');
  const plural = (n: number, un: string) => `${n} ${n === 1 ? un.replace(/s$/, '') : un}`;
  const handles = (ls: LinhaCliente[]) => {
    const hs = Array.from(new Set(ls.map((l) => l.handle).filter((h) => h && h !== 'Projeto')));
    return `${hs.slice(0, 3).join(', ')}${hs.length > 3 ? ` +${hs.length - 3}` : ''}`;
  };
  // Conta posts (como no layout); entrega sem post (relatório, reunião) conta tarefas.
  const contar = (ls: LinhaCliente[]) => {
    const posts = ls.reduce((s, l) => s + l.posts.length, 0);
    return posts > 0 ? { n: posts, un: 'posts' } : { n: ls.reduce((s, l) => s + (l.nTarefas || 1), 0), un: 'tarefas' };
  };
  const deHoje = entregasDeHoje(quadros, hoje).map((q) => {
    const faltam = q.colunas[1].linhas.filter((l) => l.prazoMaisAntigo === hoje);
    const { n, un } = contar(faltam);
    return { q, faltam, n, un, feita: faltam.length === 0 };
  });
  const atrasos = quadros
    .filter((q) => linhasAtrasadas(q, hoje).length > 0)
    .map((q) => {
      const ls = linhasAtrasadas(q, hoje);
      const venceu = ls.map((l) => l.prazoMaisAntigo).filter((d): d is string => !!d).sort()[0] ?? null;
      return { q, ls, venceu, ...contar(ls) };
    })
    .sort((a, b) => (a.venceu ?? '').localeCompare(b.venceu ?? ''));
  const feitas = deHoje.filter((e) => e.feita).length;
  const praHoje = deHoje.length - feitas;
  const total = deHoje.length + atrasos.length;
  const pF = total ? (100 * feitas) / total : 0;
  const pH = total ? (100 * (feitas + praHoje)) / total : 0;
  const aba_ = (ativa: boolean) =>
    `rounded-[9px] px-3 py-1.5 text-[12.5px] ${ativa ? 'bg-white font-extrabold shadow-[0_1px_2px_rgba(17,17,19,0.08)]' : 'font-bold text-[#636369]'}`;
  return (
    <Card>
      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-center">
        <div className="flex items-center gap-4">
          <span
            className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: total
                ? `conic-gradient(${ST.ok[2]} 0 ${pF}%, ${ST.hoje[2]} ${pF}% ${pH}%, ${ST.atr[2]} ${pH}% 100%)`
                : '#E9E9EB',
            }}
          >
            <span className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full bg-white">
              <b className="text-[20px] leading-none">{feitas}/{deHoje.length}</b>
              <span className="text-[10px] text-[#636369]">feitas</span>
            </span>
          </span>
          <span className="flex flex-col gap-1 text-[12.5px]">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">Entregas do dia</span>
            <span className="flex items-center gap-1.5"><Ponto st="ok" />{feitas} {feitas === 1 ? 'feita' : 'feitas'}</span>
            <span className="flex items-center gap-1.5"><Ponto st="hoje" />{praHoje} pra hoje</span>
            <Link href="/admin?dia=atrasos" scroll={false} className="flex items-center gap-1.5 font-bold text-[#7E211C]"><Ponto st="atr" />{atrasos.length} {atrasos.length === 1 ? 'atraso' : 'atrasos'} de antes</Link>
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-0.5 rounded-[11px] bg-[#F4F4F5] p-[3px]">
              <Link href="/admin" scroll={false} className={aba_(aba === 'hoje')}>
                Hoje · {feitas} de {deHoje.length} {feitas === 1 ? 'feita' : 'feitas'}
              </Link>
              <Link href="/admin?dia=atrasos" scroll={false} className={aba_(aba === 'atrasos')}>
                Atrasos <span className="ml-1 rounded-full bg-[#F6CFCB] px-1.5 text-[11px] font-extrabold text-[#7E211C]">{atrasos.length}</span>
              </Link>
            </div>
            <Link href="/admin/entregas" className="text-[12.5px] font-extrabold">Ver todas →</Link>
          </div>
          {aba === 'hoje' ? (
            deHoje.length === 0 ? (
              <Vazio>Nenhuma entrega é pra hoje.</Vazio>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {deHoje.map(({ q, faltam, n, un, feita }) => (
                  <Link key={q.id} href={rotas.entrega(q.id)} className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-[#E9E9EB] p-3 hover:border-[#B4B4B9]">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13.5px]">{q.nome}</b>
                      <Tag st={feita ? 'ok' : 'hoje'}>{feita ? 'Feita' : 'Pra hoje'}</Tag>
                    </span>
                    <span className="text-[12px] font-bold">{feita ? 'Tudo feito' : `Faltam ${plural(n, un)}`}</span>
                    <span className="truncate text-[11.5px] text-[#636369]">{feita ? 'Rodada fechada' : handles(faltam)}</span>
                  </Link>
                ))}
              </div>
            )
          ) : atrasos.length === 0 ? (
            <Vazio>Nenhuma entrega atrasada.</Vazio>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {atrasos.map(({ q, ls, venceu, n, un }) => (
                <Link key={q.id} href={rotas.entrega(q.id)} className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-[#E9E9EB] p-3 hover:border-[#B4B4B9]">
                  <span className="flex items-center justify-between gap-2">
                    <b className="truncate text-[13.5px]">{q.nome}</b>
                    <Tag st="atr">{venceu ? `venceu ${dm(venceu)}` : 'Atrasada'}</Tag>
                  </span>
                  <span className="text-[12px] font-bold">{plural(n, un)} em atraso</span>
                  <span className="truncate text-[11.5px] text-[#636369]">{handles(ls)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- semana
/** Calendário da semana: as setas trocam só o calendário (busca a semana pela API), sem recarregar a página. */
async function SemanaDosPosts({ deslocamento }: { deslocamento: number }) {
  const inicial = await montarSemana(deslocamento);
  return <CalendarioSemanaHome inicial={inicial} />;
}

// ---------------------------------------------------------------- entregas pendentes
/** Frequência visual: 7 tracinhos (o dia fixo aceso) ou todos acesos na diária. */
function SeloFrequencia({ rotulo, cor }: { rotulo: string; cor: string }) {
  const r = rotulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const CURTO = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const diaria = /todo dia/.test(r);
  const mensal = /mes/.test(r);
  const idx = DIAS.findIndex((d) => r.includes(d));
  const titulo = diaria ? 'DIÁRIA' : mensal ? 'MENSAL' : 'SEMANAL';
  const sub = diaria ? 'todo dia' : mensal ? rotulo.replace(/^m[eê]s · /, '') : idx >= 0 ? CURTO[idx] : rotulo;
  return (
    <span title="Frequência da entrega" className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-white/65 px-2 py-1">
      {mensal ? (
        <span className="flex h-[16px] w-[16px] items-center justify-center rounded-[4px] text-[8px] font-extrabold text-white" style={{ background: cor }}>
          {sub.replace(/\D/g, '').slice(0, 2) || 'M'}
        </span>
      ) : (
        <span className="flex items-end gap-[2px]" aria-hidden="true">
          {CURTO.map((_, k) => (
            <span key={k} className="h-3 w-[6px] rounded-[2px]" style={{ background: cor, opacity: diaria || k === idx ? 1 : 0.18 }} />
          ))}
        </span>
      )}
      <span className="flex flex-col leading-[1.05]">
        <b className="text-[10px] font-extrabold tracking-[0.06em]">{titulo}</b>
        <span className="text-[10.5px] font-semibold">{sub}</span>
      </span>
    </span>
  );
}

async function EntregasPendentes() {
  const { hoje, quadros } = await carregarQuadro().catch(() => ({ hoje: hojeSP(), quadros: [] as QuadroEntrega[] }));
  const em7 = somaDias(hoje, 7);
  const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
  // Conta só os posts cujo prazo cai na faixa (atraso, hoje ou próximos 7 dias).
  const contar = (ls: LinhaCliente[], dentro: (d: string | null) => boolean) => {
    const comPosts = ls.filter((l) => l.posts.length > 0);
    const posts = comPosts.reduce((s, l) => s + l.posts.filter((p) => dentro(p.prazo ?? l.prazoMaisAntigo)).length, 0);
    return posts + ls.filter((l) => l.posts.length === 0).reduce((s, l) => s + (l.nTarefas || 1), 0);
  };
  const lista = quadros
    .map((q) => {
      const atrL = linhasAtrasadas(q, hoje);
      const resto = [...q.colunas[1].linhas, ...q.colunas[2].linhas].filter((l) => l.prazoMaisAntigo && l.prazoMaisAntigo >= hoje && l.prazoMaisAntigo <= em7);
      const hojeL = resto.filter((l) => l.prazoMaisAntigo === hoje);
      const chegL = resto.filter((l) => l.prazoMaisAntigo! > hoje);
      const atr = contar(atrL, () => true);
      const hj = contar(hojeL, (d) => d === hoje);
      const cheg = contar(chegL, (d) => !!d && d > hoje && d <= em7);
      const antiga = atrL.map((l) => l.prazoMaisAntigo).filter((d): d is string => !!d).sort()[0] ?? null;
      const prox = chegL.map((l) => l.prazoMaisAntigo!).sort()[0] ?? null;
      const comPosts = [...atrL, ...hojeL, ...chegL].some((l) => l.posts.length > 0);
      const tipo = tipoDaEntrega(q.nome);
      return { q, atr: atrL.length ? atr : 0, hoje: hojeL.length ? hj : 0, cheg: chegL.length ? cheg : 0, antiga, prox, un: comPosts ? 'posts' : 'tarefas', comCliente: tipo !== 'interna' || /aprova/i.test(q.nome) };
    })
    .filter((e) => e.atr + e.hoje + e.cheg > 0)
    .map((e) => ({ ...e, st: (e.atr ? 'atr' : e.hoje ? 'hoje' : 'cheg') as St }))
    .sort((a, b) => b.atr - a.atr || b.hoje - a.hoje || b.cheg - a.cheg)
    .slice(0, 9);
  const ROT: Record<string, string> = { atr: 'ATRASADA', hoje: 'VENCE HOJE', cheg: 'CHEGANDO' };
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[20px] font-extrabold tracking-[-0.01em]">Entregas pendentes</h2>
        <span className="flex gap-3 text-[12px] font-bold">
          {(['atr', 'hoje', 'cheg'] as St[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5" style={{ color: ST[s][1] }}><Ponto st={s} />{s === 'atr' ? 'atrasada' : s === 'hoje' ? 'vence hoje' : 'chegando'}</span>
          ))}
        </span>
      </div>
      {lista.length === 0 ? (
        <Card><Vazio>Nada pendente nos próximos 7 dias.</Vazio></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((e) => (
            <div key={e.q.id} className="flex flex-col gap-3 rounded-[18px] p-4" style={{ background: ST[e.st][0], color: ST[e.st][1] }}>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-white/65 px-2.5 py-[3px] text-[10.5px] font-extrabold tracking-[0.06em]">{ROT[e.st]}</span>
                <SeloFrequencia rotulo={e.q.diaRotulo} cor={ST[e.st][2]} />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <b className="truncate text-[17px]">{e.q.nome}</b>
                <span className="whitespace-nowrap text-[12px] font-bold">{e.atr + e.hoje + e.cheg} {e.atr + e.hoje + e.cheg === 1 ? e.un.replace(/s$/, '') : e.un}</span>
              </div>
              <span className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className={`rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold text-[#111113] ${e.comCliente ? 'bg-white' : 'bg-[rgba(17,17,19,0.08)]'}`}>
                  {e.comCliente ? 'com o cliente' : 'interno · Lud.'}
                </span>
                <span>{e.antiga ? `o mais antigo venceu ${dm(e.antiga)}` : e.hoje ? `${e.hoje} ${e.hoje === 1 ? 'vence' : 'vencem'} hoje` : e.prox ? `o 1º vence ${dm(e.prox)}` : 'nos próximos 7 dias'}</span>
              </span>
              <Barra partes={[{ st: 'atr', valor: e.atr }, { st: 'hoje', valor: e.hoje }, { st: 'cheg', valor: e.cheg }]} />
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['ATRASO', e.atr],
                  ['HOJE', e.hoje],
                  ['CHEGANDO', e.cheg],
                ].map(([l, n]) => (
                  <span key={l as string} className="flex flex-col">
                    <span className="text-[10px] font-extrabold tracking-[0.06em]">{l}</span>
                    <b className="text-[20px] tabular-nums">{n}</b>
                  </span>
                ))}
              </div>
              <Link href={rotas.entrega(e.q.id)} className="self-end rounded-[10px] bg-[#111113] px-3 py-1.5 text-[12px] font-extrabold text-white">Abrir entrega</Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- projetos
async function ProjetosDestaque({ tipo }: { tipo: string }) {
  const todos = await carregarProjetos().catch(() => []);
  const tipos = Array.from(new Set(todos.map((p) => p.tipo))).sort((a, b) => todos.filter((p) => p.tipo === b).length - todos.filter((p) => p.tipo === a).length);
  const lista = (tipo ? todos.filter((p) => p.tipo === tipo) : todos).slice().sort((a, b) => b.atr - a.atr || a.nome.localeCompare(b.nome, 'pt-BR'));
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-[20px] font-extrabold tracking-[-0.01em]">Projetos</h2>
          <span className="text-[12.5px] text-[#636369]">Clique num card pra ver o projeto, as pendências e o cliente.</span>
        </div>
        <span className="flex flex-wrap gap-3 text-[12px] font-bold text-[#46464B]">
          <span className="flex items-center gap-1.5"><Ponto st="atr" />atrasadas</span>
          <span className="flex items-center gap-1.5"><Ponto st="ok" />em dia</span>
          <span className="flex items-center gap-1.5"><Ponto st="cheg" />atenção</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[['', 'Todos', todos.length] as const, ...tipos.map((t) => [t, t, todos.filter((p) => p.tipo === t).length] as const)].map(([k, rot, n]) => (
          <Link
            key={rot}
            href={k ? `/admin?tipo=${encodeURIComponent(k)}` : '/admin'}
            scroll={false}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-bold ${k === tipo ? 'bg-[#111113] text-white' : 'border border-[#E9E9EB] bg-white text-[#46464B] hover:border-[#B4B4B9]'}`}
          >
            {rot} <span className="opacity-60">{n}</span>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((p, i) => (
          <CardProjeto key={p.id} p={p} i={i} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- mês da Lud. com números
async function MesComNumeros() {
  const hoje = hojeSP();
  const ini = hoje.slice(0, 8) + '01';
  const [y, m] = hoje.split('-').map(Number);
  const fim = `${hoje.slice(0, 8)}${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
  const [clientes, projetos, { tarefas }, posts] = await Promise.all([
    listAllClientes().catch(() => []),
    listAllProjetos().catch(() => []),
    dados(),
    listPostsNoIntervalo(ini, fim).catch(() => [] as PostCalendario[]),
  ]);
  const atr = tarefas.filter((t) => t.prazo && t.prazo < hoje).length;
  const postados = posts.filter((p) => p.etapa === 'publicado').length;
  return (
    <MesDaLud
      numeros={[
        { rotulo: 'Clientes ativos', valor: clientes.length },
        { rotulo: 'Projetos ativos', valor: projetos.length },
        { rotulo: 'Tarefas em andamento', valor: tarefas.length, sub: 'abertas no Notion' },
        { rotulo: 'Em atraso', valor: atr, sub: 'tarefas' },
        { rotulo: 'Posts do mês', valor: posts.length, sub: `${postados} postados` },
      ]}
    />
  );
}

// ---------------------------------------------------------------- tarefas do dia
async function TarefasDoDiaBloco() {
  const hoje = hojeSP();
  const { tarefas, handle } = await dados();
  return (
    <TarefasDoDia
      hoje={hoje}
      rotuloHoje={dataPorExtenso(hoje).split(' de ')[0]}
      // Só o que está com " Pronto" ligado no Notion (já dá pra fazer).
      tarefas={tarefas.filter((t) => t.pronto).map((t) => ({
        id: t.id,
        titulo: t.titulo,
        post: t.postTitulo,
        prazo: t.prazo,
        pessoa: t.pessoa ?? 'Sem responsável',
        projeto: handle(t),
      }))}
    />
  );
}
