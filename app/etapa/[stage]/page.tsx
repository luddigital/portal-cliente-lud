import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import {
  listTarefasPendentesPorCategoria,
  CATEGORIA_LABEL,
  type CategoriaTarefa,
} from '@/lib/notion';
import { TaskItemCard } from '../../_components/TaskItemCard';

export const dynamic = 'force-dynamic';

const STAGES_VALIDOS: CategoriaTarefa[] = ['pauta', 'post', 'materiais', 'previas', 'stories'];

const COPY_INTRO: Record<CategoriaTarefa, string> = {
  pauta: 'Esses são os temas propostos pra você revisar. Clique pra ver os detalhes e aprovar ou pedir alteração.',
  post: 'Posts produzidos esperando seu OK pra entrar no ar. Revise, aprove ou peça ajustes.',
  materiais: 'A gente precisa de fotos ou vídeos seus pra esses posts. Clique e faça o upload.',
  previas: 'Antes de produzir, precisamos de algumas informações suas pra montar esses posts.',
  stories: 'Esses stories estão aguardando seu direcionamento pra entrar na produção.',
};

export default async function EtapaPage({ params }: { params: { stage: string } }) {
  const stage = params.stage as CategoriaTarefa;
  if (!STAGES_VALIDOS.includes(stage)) notFound();

  const session = await getSession();
  if (!session) redirect('/login');

  const todas = await listTarefasPendentesPorCategoria(session.projetoIds);
  const tarefas = todas[stage];
  const meta = CATEGORIA_LABEL[stage];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl lg:max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink"
          >
            ← Voltar pra área do cliente
          </Link>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            {session.email}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl lg:max-w-4xl px-6 py-8 space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-ink">{meta.label}</h1>
          <p className="mt-1 text-[14px] text-t2">{COPY_INTRO[stage]}</p>
        </div>

        {tarefas.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-[14px] font-semibold text-ink">Tudo em dia ✨</div>
            <p className="mt-2 text-[13px] text-mauve">
              Nada pendente nessa categoria agora. Quando precisarmos, te avisamos por aqui.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-[12px] font-medium text-navy hover:underline"
            >
              ← voltar pro dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tarefas.map((t) => (
              <TaskItemCard key={t.tarefaId} tarefa={t} categoria={stage} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
