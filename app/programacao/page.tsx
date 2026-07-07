import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listAllProjetos,
  listPostsDoMes,
} from '@/lib/notion';
import { classificarProjeto } from '@/lib/projetoServico';
import { ProgramacaoView } from './ProgramacaoView';

const SERVICOS_SOCIAL = new Set(['Instagram', 'TikTok', 'Stories']);

export const dynamic = 'force-dynamic';

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: { projetoId?: string; year?: string; month?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  // Só equipe Lud. (admin ou colaborador registrado)
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

  // Só social media: Instagram, TikTok e Stories. Tráfego Pago, sites,
  // consultoria etc. não têm calendário de posts pra programar.
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
          A programação só cobre projetos de Instagram, TikTok e Stories.
        </p>
      </main>
    );
  }

  const projetoIdSelecionado =
    (searchParams.projetoId?.trim() && projetos.find((p) => p.id === searchParams.projetoId!.trim())?.id) ||
    projetos[0].id;

  const hoje = new Date();
  const year = parseInt(searchParams.year ?? '', 10) || hoje.getFullYear();
  const month = parseInt(searchParams.month ?? '', 10) || hoje.getMonth() + 1;

  const posts = await listPostsDoMes([projetoIdSelecionado], year, month);

  return (
    <ProgramacaoView
      projetos={projetos}
      projetoIdSelecionado={projetoIdSelecionado}
      year={year}
      month={month}
      posts={posts}
    />
  );
}
