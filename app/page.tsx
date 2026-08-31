import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession, getProjetoAtivo } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  listTarefasPendentesPorCategoria,
  listPostsDoMes,
  getNomeDoCliente,
  findProjetosByEmail,
  type CategoriaTarefa,
} from '@/lib/notion';
import { ProjetoSwitcher } from './_components/ProjetoSwitcher';
import { escolherProjetoPadrao } from '@/lib/projetoServico';
import { EtapaBanner } from './_components/EtapaBanner';
import { TaskCategoryCard } from './_components/TaskCategoryCard';
import { CalendarNavigator } from './_components/CalendarNavigator';
import {
  CardsSkeleton,
  CalendarSkeleton,
  StatsSkeleton,
} from './_components/Skeletons';
import { AvisosToggle } from './_components/AvisosToggle';
import { NotificacoesBell, type NotificacaoItem } from './_components/NotificacoesBell';
import { SincronizarNotion } from './_components/SincronizarNotion';
import { EnviarMateriais } from './_components/EnviarMateriais';
import Link from 'next/link';
import { listarGruposDoUsuario } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ORDEM_CATEGORIAS: CategoriaTarefa[] = ['pauta', 'previas', 'materiais', 'post'];

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Admin sem projetos vinculados não tem o que ver na área do cliente — manda pro admin.
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  const ehEquipe = ehAdmin || !!session.colaboradorId;
  if (ehAdmin && session.projetoIds.length === 0) redirect('/admin');
  // Colaborador sem projetos vinculados vai pra área da equipe.
  if (session.colaboradorId && session.projetoIds.length === 0) redirect('/equipe/me');

  // Cliente com 2+ projetos: pré-seleciona via Instagram (ou primeiro da
  // lista) e seta o cookie via /api/projetos/escolher. Switcher no header
  // permite trocar depois — sem página intermediária de escolha.
  let projetoIdsAtivos = session.projetoIds;
  const projetoAtivo = getProjetoAtivo();
  const multiplos = session.projetoIds.length > 1;
  const projetosCliente = multiplos
    ? await findProjetosByEmail(session.email)
    : [];
  if (multiplos) {
    if (!projetoAtivo || !session.projetoIds.includes(projetoAtivo)) {
      const escolhido =
        escolherProjetoPadrao(projetosCliente) ?? projetosCliente[0];
      if (!escolhido) redirect('/login?err=notfound');
      redirect(`/api/projetos/escolher?id=${escolhido.id}`);
    }
    projetoIdsAtivos = [projetoAtivo];
  }

  const hoje = new Date();
  const year = hoje.getFullYear();
  const month = hoje.getMonth() + 1;
  const mesAtualLabel = MESES_PT[month - 1];
  const projetoAtivoId = projetoIdsAtivos[0] ?? '';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[20px] font-bold tracking-[-0.02em] text-ink">
              Lud<span className="font-light text-mauve">.</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Portal do cliente
            </div>
          </div>
          <div className="flex items-center gap-3">
            {ehEquipe && <SincronizarNotion />}
            {multiplos && (
              <ProjetoSwitcher
                projetos={projetosCliente.map((p) => ({ id: p.id, nome: p.nome }))}
                ativoId={projetoAtivoId}
              />
            )}
            <Suspense
              fallback={
                <div className="h-9 w-9 rounded-full bg-bgSoft animate-pulse" />
              }
            >
              <Sino projetoIds={projetoIdsAtivos} />
            </Suspense>
            <Link
              href="/boas-vindas"
              className="text-[12px] text-mauve transition hover:text-ink"
            >
              Como funciona
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="text-[12px] text-mauve transition hover:text-ink">Sair</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl xl:max-w-7xl px-6 py-8 space-y-8">
        <Suspense fallback={<StatsSkeleton />}>
          <BannerStats
            email={session.email}
            projetoIds={projetoIdsAtivos}
            year={year}
            month={month}
            mesAtualLabel={mesAtualLabel}
          />
        </Suspense>

        <AvisosToggle />

        <Suspense fallback={null}>
          <ConversasShortcut email={session.email} />
        </Suspense>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="hub-section-title">Tarefas pendentes</h2>
              <p className="hub-section-sub">Clique nos cards para acessar suas tarefas.</p>
            </div>
          </div>
          <Suspense fallback={<CardsSkeleton />}>
            <TarefasCards projetoIds={projetoIdsAtivos} />
          </Suspense>
        </section>

        <section className="space-y-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="hub-section-title">Calendário de posts</h2>
              <p className="hub-section-sub">
                Tudo que vai pro ar nos próximos meses, com status atualizado.
              </p>
            </div>
          </div>
          <Suspense fallback={<CalendarSkeleton />}>
            <CalendarioMes projetoIds={projetoIdsAtivos} year={year} month={month} />
          </Suspense>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="hub-section-title">Materiais</h2>
            <p className="hub-section-sub">
              Mande fotos, vídeos e arquivos pra equipe quando quiser.
            </p>
          </div>
          <EnviarMateriais />
        </section>
      </main>
    </div>
  );
}

async function BannerStats({
  email,
  projetoIds,
  year,
  month,
  mesAtualLabel,
}: {
  email: string;
  projetoIds: string[];
  year: number;
  month: number;
  mesAtualLabel: string;
}) {
  const [nomeCliente, postsAtual, tarefasPorCat] = await Promise.all([
    getNomeDoCliente(email),
    listPostsDoMes(projetoIds, year, month),
    listTarefasPendentesPorCategoria(projetoIds),
  ]);
  const primeiroNome = (nomeCliente ?? '').split(/\s+/)[0] || 'cliente';
  const saudacao = `Olá, ${primeiroNome} 👋`;
  const totalPendencias = ORDEM_CATEGORIAS.reduce(
    (acc, cat) => acc + tarefasPorCat[cat].length,
    0,
  );
  return (
    <EtapaBanner
      saudacao={saudacao}
      pendencias={totalPendencias}
      postsNoMes={postsAtual.length}
      mesLabel={mesAtualLabel}
    />
  );
}

async function TarefasCards({ projetoIds }: { projetoIds: string[] }) {
  const tarefasPorCat = await listTarefasPendentesPorCategoria(projetoIds);
  return (
    <div className="grid gap-2.5 grid-cols-2 md:grid-cols-2 xl:grid-cols-4">
      {ORDEM_CATEGORIAS.map((cat) => (
        <TaskCategoryCard
          key={cat}
          categoria={cat}
          tarefas={tarefasPorCat[cat]}
          href={`/etapa/${cat}`}
        />
      ))}
    </div>
  );
}

async function CalendarioMes({
  projetoIds,
  year,
  month,
}: {
  projetoIds: string[];
  year: number;
  month: number;
}) {
  const postsAtual = await listPostsDoMes(projetoIds, year, month);
  return (
    <CalendarNavigator
      mesInicial={{ year, month, posts: postsAtual }}
      totalMesesAFrente={2}
    />
  );
}

async function ConversasShortcut({ email }: { email: string }) {
  // Mostra só se o usuário tem grupos do WhatsApp liberados.
  let totalGrupos = 0;
  try {
    const grupos = await listarGruposDoUsuario(email);
    totalGrupos = grupos.length;
  } catch {
    // Supabase pode não estar configurado ainda — silencioso.
    return null;
  }
  if (totalGrupos === 0) return null;

  return (
    <Link
      href="/chat"
      className="flex items-center gap-3 rounded-lg border border-[rgba(21,21,33,0.08)] bg-white px-4 py-3 transition hover:border-navy/30 hover:bg-bgSoft"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">Conversas com a Lud.</div>
        <div className="text-[11px] text-t3">
          {totalGrupos === 1 ? '1 conversa disponível' : `${totalGrupos} conversas disponíveis`}
        </div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-t3">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

async function Sino({ projetoIds }: { projetoIds: string[] }) {
  const tarefasPorCat = await listTarefasPendentesPorCategoria(projetoIds);
  const items: NotificacaoItem[] = [];
  const categorias: CategoriaTarefa[] = ['pauta', 'previas', 'materiais', 'post', 'stories'];
  for (const cat of categorias) {
    for (const t of tarefasPorCat[cat]) {
      items.push({
        tarefaId: t.tarefaId,
        postId: t.postId,
        postTitulo: t.postTitulo,
        categoria: cat,
        prazo: t.tarefaPrazo,
      });
    }
  }
  return <NotificacoesBell items={items} />;
}
