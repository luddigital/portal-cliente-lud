import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import {
  listTarefasPendentesPorCategoria,
  listPostsDoMes,
  getNomeDoCliente,
  type CategoriaTarefa,
} from '@/lib/notion';
import { EtapaBanner } from './_components/EtapaBanner';
import { TaskCategoryCard } from './_components/TaskCategoryCard';
import { CalendarNavigator } from './_components/CalendarNavigator';

export const dynamic = 'force-dynamic';

const ORDEM_CATEGORIAS: CategoriaTarefa[] = ['pauta', 'previas', 'materiais', 'post'];

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function avancarMes(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const hoje = new Date();
  const year = hoje.getFullYear();
  const month = hoje.getMonth() + 1;
  const proxA = avancarMes(year, month, 1);
  const proxB = avancarMes(year, month, 2);

  const [tarefasPorCat, postsAtual, postsProxA, postsProxB, nomeCliente] = await Promise.all([
    listTarefasPendentesPorCategoria(session.projetoIds),
    listPostsDoMes(session.projetoIds, year, month),
    listPostsDoMes(session.projetoIds, proxA.year, proxA.month),
    listPostsDoMes(session.projetoIds, proxB.year, proxB.month),
    getNomeDoCliente(session.email),
  ]);

  const totalPendencias = ORDEM_CATEGORIAS.reduce(
    (acc, cat) => acc + tarefasPorCat[cat].length,
    0,
  );

  const primeiroNome = (nomeCliente ?? '').split(/\s+/)[0] || 'cliente';
  const saudacao = `Olá, ${primeiroNome} 👋`;
  const mesAtualLabel = MESES_PT[month - 1];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[20px] font-bold tracking-[-0.02em] text-ink">
              Lud<span className="font-light text-mauve">.</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Portal do cliente
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="text-[12px] text-mauve transition hover:text-ink">Sair</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <EtapaBanner
          saudacao={saudacao}
          pendencias={totalPendencias}
          postsNoMes={postsAtual.length}
          mesLabel={mesAtualLabel}
        />

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="hub-section-title">Tarefas pendentes</h2>
              <p className="hub-section-sub">
                {totalPendencias === 0
                  ? 'Tudo em dia. Quando precisarmos de algo, aparece aqui.'
                  : 'Clique nos cards para acessar suas tarefas.'}
              </p>
            </div>
          </div>
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
          <CalendarNavigator
            meses={[
              { year, month, posts: postsAtual },
              { year: proxA.year, month: proxA.month, posts: postsProxA },
              { year: proxB.year, month: proxB.month, posts: postsProxB },
            ]}
          />
        </section>
      </main>
    </div>
  );
}
