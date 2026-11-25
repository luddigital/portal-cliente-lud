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
import { FazerAgora } from './_ui/FazerAgora';
import { CalendarioSemanaHome } from './_ui/CalendarioSemanaHome';
import { montarSemana } from './_ui/semanaHome';
import { carregarQuadro, type LinhaCliente, type QuadroEntrega } from './entregas/quadro';
import { entregasDeHoje } from './entregas/HojePrimeiro';
import { ListaEntregas } from './entregas/EntregasVisao';
import { tipoDaEntrega } from '@/lib/entrega-dados';
import { ehTarefaDoCliente } from '@/lib/etapas-projeto';

/** Linhas que já venceram: rodadas anteriores + rodada atual com prazo antes de hoje. */
function linhasAtrasadas(q: { colunas: { linhas: LinhaCliente[] }[] }, hoje: string): LinhaCliente[] {
  return [...q.colunas[0].linhas, ...q.colunas[1].linhas.filter((l) => !!l.prazoMaisAntigo && l.prazoMaisAntigo < hoje)];
}

export const dynamic = 'force-dynamic';
// Sem a reserva do cache (logo depois de concluir) a leitura do Notion pode passar de 15s.
export const maxDuration = 60;

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
  const hora = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const esqueleto = (h: number) => <div className="animate-pulse rounded-[16px] bg-[#F0F0F1]" style={{ height: h }} />;
  return (
    <Pagina>
      <Cabecalho eyebrow={dataPorExtenso(hoje)} titulo={`${saudacao}, Luiza`} acoes={<BotaoAtualizar variante="compacto" />} />
      <Suspense fallback={<div className="grid gap-3.5 md:grid-cols-3">{esqueleto(92)}{esqueleto(92)}{esqueleto(92)}</div>}>
        <TopoComQuem />
      </Suspense>
      <Bloco titulo="✅ Fazer agora" aberto>
        <Suspense fallback={esqueleto(360)}>
          <TarefasDoDiaBloco />
        </Suspense>
      </Bloco>
      <Bloco titulo="🗓 Semana" sub="posts de cada dia" aberto>
        <Suspense fallback={esqueleto(380)}>
          <SemanaDosPosts deslocamento={Number(searchParams.semana) || 0} />
        </Suspense>
      </Bloco>
      <Secao titulo="📦 Entregas">
        <Suspense fallback={<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{esqueleto(110)}{esqueleto(110)}{esqueleto(110)}{esqueleto(110)}</div>}>
          <EntregasNumeros />
        </Suspense>
      </Secao>
      <Secao titulo="🗂 Projetos">
        <Suspense fallback={<div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">{esqueleto(100)}{esqueleto(100)}{esqueleto(100)}{esqueleto(100)}</div>}>
          <ProjetosFotos />
        </Suspense>
      </Secao>
      <Bloco titulo="🔄 Mês da Lud." sub="ciclo do mês e números">
        <Suspense fallback={esqueleto(420)}>
          <MesComNumeros />
        </Suspense>
      </Bloco>
    </Pagina>
  );
}

/** Seção sempre aberta da home (título solto, sem caixa). */
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <b className="text-[18px] font-extrabold text-[#111113]">{titulo}</b>
      {children}
    </section>
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// ---------------------------------------------------------------- topo: com quem está
/** Topo da Home: o que está com você, com os clientes e com a equipe (tarefas prontas pra andar). */
async function TopoComQuem() {
  const hoje = hojeSP();
  const { tarefas } = await dados();
  const prontas = tarefas.filter((t) => t.pronto);
  const ehLuiza = (p: string | null) => !!p && /luiza/i.test(p);
  const minhas = prontas.filter((t) => !ehTarefaDoCliente(t.titulo) && ehLuiza(t.pessoa) && t.prazo && t.prazo.slice(0, 10) <= hoje);
  const minhasAtr = minhas.filter((t) => t.prazo!.slice(0, 10) < hoje).length;
  const doCliente = prontas.filter((t) => ehTarefaDoCliente(t.titulo));
  const aprovar = doCliente.filter((t) => /aprova/i.test(t.titulo)).length;
  const materiais = doCliente.filter((t) => /materia/i.test(t.titulo)).length;
  const infos = doCliente.length - aprovar - materiais;
  const equipe = prontas.filter((t) => !ehTarefaDoCliente(t.titulo) && t.pessoa && !ehLuiza(t.pessoa));
  const equipeAtr = equipe.filter((t) => t.prazo && t.prazo.slice(0, 10) < hoje).length;
  const cards: { rot: string; n: number; sub: string; href: string }[] = [
    { rot: 'COM VOCÊ', n: minhas.length, sub: `pra hoje · ${plural(minhasAtr, 'atrasada', 'atrasadas')}`, href: '/admin/tarefas' },
    {
      rot: 'COM OS CLIENTES',
      n: doCliente.length,
      sub: [aprovar && `${aprovar} aprovar`, materiais && plural(materiais, 'material', 'materiais'), infos && plural(infos, 'informação', 'informações')].filter(Boolean).join(' · ') || 'nada com eles',
      href: '/admin/aprovacoes/resumo',
    },
    { rot: 'COM A EQUIPE', n: equipe.length, sub: equipeAtr ? `tarefas com o time · ${plural(equipeAtr, 'atrasada', 'atrasadas')}` : 'tarefas com o time', href: '/admin/tarefas' },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.rot} href={c.href} className="flex flex-col gap-1 rounded-[18px] border border-[#E9E9EB] bg-white px-4 py-3.5 hover:border-[#B4B4B9]">
          <span className="text-[10.5px] font-extrabold tracking-[0.08em] text-[#8A8A90]">{c.rot}</span>
          <b className="text-[26px] font-extrabold leading-[1.1] tabular-nums text-[#111113]">{c.n}</b>
          <span className="truncate text-[12px] text-[#636369]">{c.sub}</span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- entregas em números
/** Entregas da Home: hoje, amanhã, chegando (até domingo) e próxima semana. Conta entregas e posts. */
async function EntregasNumeros() {
  const { hoje, quadros } = await carregarQuadro().catch(() => ({ hoje: hojeSP(), quadros: [] as QuadroEntrega[] }));
  const dow = (new Date(hoje + 'T12:00:00Z').getUTCDay() + 6) % 7; // seg = 0
  const domingo = somaDias(hoje, 6 - dow);
  const amanha = somaDias(hoje, 1);
  const faixas = [
    { rot: 'HOJE', cor: '#C2417E', de: hoje, ate: hoje },
    { rot: 'AMANHÃ', cor: '#7462D6', de: amanha, ate: amanha },
    { rot: 'CHEGANDO', cor: '#B4B4B9', de: somaDias(hoje, 2), ate: domingo, sub: 'até domingo' },
    { rot: 'PRÓXIMA SEMANA', cor: '#E4E4E7', de: somaDias(domingo, 1), ate: somaDias(domingo, 7) },
  ];
  const contar = (de: string, ate: string) => {
    let entregas = 0;
    let posts = 0;
    for (const q of quadros) {
      let n = 0;
      let tem = false;
      for (const l of [...q.colunas[1].linhas, ...q.colunas[2].linhas]) {
        if (l.posts.length) {
          const k = l.posts.filter((p) => {
            const d = (p.prazo ?? l.prazoMaisAntigo)?.slice(0, 10);
            return !!d && d >= de && d <= ate;
          }).length;
          n += k;
          if (k) tem = true;
        } else {
          const d = l.prazoMaisAntigo?.slice(0, 10);
          if (d && d >= de && d <= ate) tem = true;
        }
      }
      if (tem) entregas++;
      posts += n;
    }
    return { entregas, posts };
  };
  const atrasadas = quadros.filter((q) => linhasAtrasadas(q, hoje).length > 0).length;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {faixas.map((f, i) => {
        const { entregas, posts } = f.de > f.ate ? { entregas: 0, posts: 0 } : contar(f.de, f.ate);
        const partes = [entregas === 1 ? 'entrega' : 'entregas', f.sub, plural(posts, 'post', 'posts'), i === 0 && atrasadas ? plural(atrasadas, 'atrasada', 'atrasadas') : null].filter(Boolean);
        return (
          <Link key={f.rot} href="/admin/entregas" className="flex flex-col gap-1 rounded-[18px] border border-[#E9E9EB] bg-white px-[18px] py-4 hover:border-[#B4B4B9]">
            <span className="flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.08em] text-[#8A8A90]">
              <span className="h-2 w-2 rounded-full" style={{ background: f.cor }} />
              {f.rot}
            </span>
            <b className="text-[34px] font-extrabold leading-[1.1] tabular-nums text-[#111113]">{entregas}</b>
            <span className={`text-[12px] ${i === 0 && atrasadas ? 'text-[#B42318]' : 'text-[#636369]'}`}>{partes.join(' · ')}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- projetos com foto
/** Projetos da Home: a foto de cada projeto com o @ por cima. */
async function ProjetosFotos() {
  const todos = await carregarProjetos().catch(() => []);
  const lista = todos.filter((p) => p.atr > 0 || p.p7 > 0).sort((a, b) => b.p7 - a.p7 || a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!lista.length) return <Vazio>Nenhum projeto com tarefa pros próximos dias.</Vazio>;
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {lista.map((p) => {
        const nome = nomeCurtoDoProjeto(p.nome) ?? p.nome;
        const arroba = nome.startsWith('@') ? nome : `@${nome}`;
        return (
          <Link key={p.id} href={rotas.projeto(p.id)} className="relative block aspect-[3/1] overflow-hidden rounded-[16px] bg-[#F0F0F1] hover:brightness-[0.97]">
            {p.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.capa} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[22px] font-extrabold text-[#8A8A90]">{arroba.slice(1, 3).toUpperCase()}</span>
            )}
            <span className="absolute left-3 top-3 max-w-[calc(100%-24px)] truncate rounded-full bg-white px-3 py-[5px] text-[13px] font-bold text-[#111113]">{arroba}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Entregas da home: a mesma lista da página Entregas, na versão limpa (sem faixas coloridas). */
async function EntregasLista() {
  const { hoje, quadros } = await carregarQuadro().catch(() => ({ hoje: hojeSP(), quadros: [] as QuadroEntrega[] }));
  if (quadros.length === 0) return <Vazio>Nenhuma entrega no Notion.</Vazio>;
  return <ListaEntregas quadros={quadros} hoje={hoje} deHoje={entregasDeHoje(quadros, hoje)} limpa />;
}

/** Bloco da home que abre e fecha (toggle). */
function Bloco({ titulo, sub, aberto = false, children }: { titulo: string; sub?: string; aberto?: boolean; children: React.ReactNode }) {
  return (
    <details open={aberto} className="group rounded-[18px] border border-[#E9E9EB] bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="text-[10px] text-[#8A8A90] transition group-open:rotate-90">▶</span>
        <b className="text-[15px] font-extrabold text-[#111113]">{titulo}</b>
        {sub && <span className="ml-auto text-[12.5px] font-semibold text-[#8A8A90]">{sub}</span>}
      </summary>
      <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------- alertas do topo
async function Alertas() {
  const hoje = hojeSP();
  const ini = hoje.slice(0, 8) + '01';
  const [y, m] = hoje.split('-').map(Number);
  const fim = `${hoje.slice(0, 8)}${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
  const [{ tarefas }, posts] = await Promise.all([dados(), listPostsNoIntervalo(ini, fim).catch(() => [] as PostCalendario[])]);
  const atrasadas = tarefas.filter((t) => t.prazo && t.prazo < hoje);
  const deHoje = tarefas.filter((t) => t.prazo && t.prazo.slice(0, 10) === hoje);
  const maisAntiga = atrasadas.map((t) => t.prazo!).sort()[0] ?? null;
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const doCliente = atrasadas.filter((t) => /^aprova|materia|conte[uú]dos? pr[eé]vio/i.test(t.titulo)).length;
  const porEtapa = Object.entries(
    deHoje.reduce<Record<string, number>>((acc, t) => ((acc[etapaDe(t.titulo)] = (acc[etapaDe(t.titulo)] ?? 0) + 1), acc), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([e, n]) => `${n} ${e}`)
    .join(' · ');
  const postados = posts.filter((p) => p.etapa === 'publicado').length;
  const pct = posts.length ? Math.round((100 * postados) / posts.length) : 0;
  return (
    <div className="grid gap-3.5 md:grid-cols-3">
      <Link href="/admin/tarefas" className="flex flex-col gap-1 rounded-[16px] border border-[#F2B8B0] bg-[#FBE3E0] px-5 py-4 hover:brightness-[0.98]">
        <b className="text-[16px] font-extrabold text-[#B42318]">🚨 {atrasadas.length} atrasadas</b>
        <span className="text-[12.5px] text-[#7E211C]">
          {maisAntiga ? `mais antiga ${dm(maisAntiga)}` : 'nada atrasado'}
          {doCliente ? ` · ${doCliente} com o cliente` : ''}
        </span>
      </Link>
      <Link href="/admin/tarefas" className="flex flex-col gap-1 rounded-[16px] border border-[#F5E6C8] bg-[#FFF8EC] px-5 py-4 hover:brightness-[0.98]">
        <b className="text-[16px] font-extrabold text-[#8A5A0B]">☀️ {deHoje.length} pra hoje</b>
        <span className="truncate text-[12.5px] text-[#7A4A0B]">{porEtapa || 'nada pra hoje'}</span>
      </Link>
      <Link href="/admin/postagens" className="flex flex-col gap-2 rounded-[16px] border border-[#D8EDCF] bg-[#EEF4EA] px-5 py-4 hover:brightness-[0.98]">
        <b className="text-[16px] font-extrabold text-[#2E5520]">
          ✓ {postados} de {posts.length} no ar
        </b>
        <span className="h-1.5 overflow-hidden rounded-full bg-[#D8EDCF]">
          <span className="block h-full rounded-full bg-[#2E7D4F]" style={{ width: `${pct}%` }} />
        </span>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------- clientes (compacto)
async function ClientesCompacto() {
  const todos = await carregarProjetos().catch(() => []);
  const lista = [...todos].sort((a, b) => b.atr - a.atr || b.p7 - a.p7).filter((p) => p.atr > 0 || p.p7 > 0);
  if (!lista.length) return <Vazio>Nenhum projeto com tarefa pros próximos dias.</Vazio>;
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
      {lista.map((p) => {
        const cor = p.atr >= 3 ? '#D9564F' : p.atr > 0 ? '#D99A2B' : '#2E7D4F';
        const nome = nomeCurtoDoProjeto(p.nome);
        return (
          <Link key={p.id} href={rotas.projeto(p.id)} className="flex flex-col gap-2 rounded-[14px] border border-[#EDEDEF] p-3 hover:border-[#B4B4B9]">
            <span className="flex min-w-0 items-center gap-2.5">
              {p.capa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.capa} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0F0F1] text-[11px] font-extrabold">{(nome ?? '?').replace(/^@/, '').slice(0, 2).toUpperCase()}</span>
              )}
              <b className="truncate text-[13.5px] text-[#111113]">{nome}</b>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-[#F0F0F1]">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(8, 100 - p.atr * 18)}%`, background: cor }} />
            </span>
            <span className="flex items-center justify-between text-[12px] font-bold">
              <span style={{ color: p.atr ? '#B42318' : '#2E5520' }}>{p.atr ? `${p.atr} ${p.atr === 1 ? 'atrasada' : 'atrasadas'}` : 'em dia'}</span>
              <span className="font-semibold text-[#8A8A90]">{p.p7} nos próx. 7 dias</span>
            </span>
          </Link>
        );
      })}
    </div>
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
  // Só o que já dá pra fazer (" Pronto" no Notion), atrasado ou pra hoje; mais antigo primeiro.
  const itens = tarefas
    .filter((t) => t.pronto && t.prazo && t.prazo.slice(0, 10) <= hoje)
    .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''))
    .map((t) => ({ id: t.id, titulo: t.titulo, post: t.postTitulo, prazo: t.prazo, pessoa: t.pessoa ?? 'Sem responsável', projeto: handle(t) }));
  const pessoas = Array.from(new Set(itens.map((t) => t.pessoa)))
    .sort((a, b) => itens.filter((t) => t.pessoa === b).length - itens.filter((t) => t.pessoa === a).length);
  return <FazerAgora itens={itens} hoje={hoje} pessoas={pessoas} />;
}
