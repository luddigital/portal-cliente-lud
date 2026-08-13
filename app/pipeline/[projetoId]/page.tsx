import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  listAllProjetos,
  listPostsDoMes,
  type PostCalendario,
} from '@/lib/notion';
import { lerPipelineDosPosts } from '@/lib/pipelineCopy';
import { PipelineBoard } from './PipelineBoard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: { projetoId: string };
  searchParams: { ano?: string; mes?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      ehColaborador = !!(await getColaboradorByEmail(session.email));
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  const projetos = await listAllProjetos();
  const projeto = projetos.find((p) => p.id === params.projetoId) ?? null;

  const hoje = new Date();
  const ano = Number(searchParams.ano) || hoje.getFullYear();
  const mes = Number(searchParams.mes) || hoje.getMonth() + 1;

  let posts: PostCalendario[] = [];
  if (projeto) {
    try {
      posts = await listPostsDoMes([projeto.id], ano, mes);
    } catch {
      posts = [];
    }
  }

  const pipeline = await lerPipelineDosPosts(posts.map((p) => p.id));

  const mesLabel = `${MESES[mes - 1]} de ${ano}`;

  if (!projeto) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-[18px] font-semibold text-ink">Projeto não encontrado</h1>
        <p className="mt-2 text-[13px] text-t2">
          Confira o link do pipeline. O id precisa ser de um projeto ativo no Notion.
        </p>
      </main>
    );
  }

  return (
    <PipelineBoard
      projetoId={projeto.id}
      clienteNome={projeto.nome}
      mesLabel={mesLabel}
      ano={ano}
      mes={mes}
      posts={posts.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        formato: p.formatoNome ?? p.tipo,
        data: p.data,
        etapaMacro: p.etapaLabel,
        cor: p.cor,
      }))}
      pipelineInicial={pipeline}
    />
  );
}
