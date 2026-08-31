import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listAllProjetos,
  listPostsDoMes,
} from '@/lib/notion';
import { classificarProjeto } from '@/lib/projetoServico';
import { CalendarioAdminView } from './CalendarioAdminView';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SERVICOS_SOCIAL = new Set(['Instagram', 'TikTok', 'Stories']);

export default async function CalendarioAdminPage({
  searchParams,
}: {
  searchParams: { projetoId?: string; ym?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  const projetos = (await listAllProjetos()).filter((p) =>
    SERVICOS_SOCIAL.has(classificarProjeto(p.nome)),
  );
  if (projetos.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-[18px] font-semibold text-ink">
          Nenhum projeto de social media ativo
        </h1>
        <p className="mt-2 text-[13px] text-t2">
          O calendário só cobre projetos de Instagram, TikTok e Stories.
        </p>
      </main>
    );
  }

  const paramProjeto = searchParams.projetoId?.trim();
  const verTodos = !paramProjeto || paramProjeto === 'todos';
  const projetoIdSelecionado = verTodos
    ? 'todos'
    : projetos.find((p) => p.id === paramProjeto)?.id || 'todos';

  const hoje = new Date();
  const ymRaw = searchParams.ym?.trim();
  let year = hoje.getFullYear();
  let month = hoje.getMonth() + 1;
  if (ymRaw && /^\d{4}-\d{2}$/.test(ymRaw)) {
    const [y, m] = ymRaw.split('-').map(Number);
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }

  const idsBuscar =
    projetoIdSelecionado === 'todos' ? projetos.map((p) => p.id) : [projetoIdSelecionado];

  const posts = await listPostsDoMes(idsBuscar, year, month);

  return (
    <CalendarioAdminView
      projetos={projetos}
      projetoIdSelecionado={projetoIdSelecionado}
      year={year}
      month={month}
      posts={posts}
    />
  );
}
