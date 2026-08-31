import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listAllProjetos,
  listPostsNoIntervalo,
} from '@/lib/notion';
import { classificarProjeto } from '@/lib/projetoServico';
import { CalendarioAdminView } from './CalendarioAdminView';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SERVICOS_SOCIAL = new Set(['Instagram', 'TikTok', 'Stories']);

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function inicioDaSemana(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // Domingo
  return x;
}

export default async function CalendarioAdminPage({
  searchParams,
}: {
  searchParams: { projetoId?: string; semana?: string };
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

  // Base da semana: ?semana=YYYY-MM-DD (qualquer dia da semana desejada) ou hoje.
  const base = searchParams.semana ? new Date(searchParams.semana + 'T00:00:00') : new Date();
  const baseValida = Number.isNaN(base.getTime()) ? new Date() : base;
  const inicio = inicioDaSemana(baseValida);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);

  // Projetos só pra popular o dropdown. Se demorar, roda em paralelo com posts.
  const [projetos, postsRaw] = await Promise.all([
    listAllProjetos().then((all) =>
      all.filter((p) => SERVICOS_SOCIAL.has(classificarProjeto(p.nome))),
    ),
    listPostsNoIntervalo(ymd(inicio), ymd(fim)),
  ]);

  const paramProjeto = searchParams.projetoId?.trim();
  const projetoIdSelecionado =
    !paramProjeto || paramProjeto === 'todos'
      ? 'todos'
      : projetos.find((p) => p.id === paramProjeto)?.id || 'todos';

  return (
    <Suspense>
      <CalendarioAdminView
        projetos={projetos}
        projetoIdSelecionado={projetoIdSelecionado}
        inicioIso={ymd(inicio)}
        fimIso={ymd(fim)}
        posts={postsRaw}
      />
    </Suspense>
  );
}
