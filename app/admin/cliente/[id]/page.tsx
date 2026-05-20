import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import {
  getClienteById,
  getProjetosDoCliente,
  listTarefasPendentesPorCategoria,
  listPostsDoMes,
  CATEGORIA_LABEL,
  type CategoriaTarefa,
  type TarefaPendente,
} from '@/lib/notion';
import { env } from '@/lib/env';
import { CalendarNavigator } from '@/app/_components/CalendarNavigator';
import { BotaoAvisar } from './BotaoAvisar';
import { BotaoCopiarLink } from '../../BotaoCopiarLink';

export const dynamic = 'force-dynamic';

const ORDEM_CATEGORIAS: CategoriaTarefa[] = [
  'pauta',
  'previas',
  'materiais',
  'post',
  'stories',
];

const CATEGORIA_EMOJI: Record<CategoriaTarefa, string> = {
  pauta: '📋',
  previas: '✍️',
  materiais: '📷',
  post: '✅',
  stories: '📱',
};

export default async function ClienteAdminPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }
  const cliente = await getClienteById(params.id);
  if (!cliente) notFound();

  const loginAsHref = cliente.email
    ? `/api/admin/login-as?email=${encodeURIComponent(cliente.email)}`
    : '#';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-4xl lg:max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink"
          >
            ← Voltar
          </Link>
          <a
            href={loginAsHref}
            className="text-[12px] font-medium text-navy underline-offset-2 hover:underline"
          >
            Entrar como cliente →
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-10">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            cliente
          </div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">
            {cliente.nome}
          </h1>
          {cliente.email && (
            <p className="mt-1 font-mono text-[12px] text-t3">{cliente.email}</p>
          )}
          <p className="mt-2 text-[13px] text-t2">
            {cliente.projetoCount} {cliente.projetoCount === 1 ? 'projeto' : 'projetos'} vinculado
            {cliente.projetoCount === 1 ? '' : 's'}.
          </p>
          {cliente.email && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <BotaoAvisar email={cliente.email} />
              <BotaoCopiarLink email={cliente.email} />
            </div>
          )}
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="hub-section-title">Tarefas pendentes</h2>
            <p className="hub-section-sub">Tudo que tá esperando ação do cliente, agrupado por etapa.</p>
          </div>
          <Suspense
            fallback={
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[120px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
                  />
                ))}
              </div>
            }
          >
            <TarefasDoCliente clienteId={cliente.id} />
          </Suspense>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="hub-section-title">Calendário</h2>
            <p className="hub-section-sub">Posts agendados do cliente.</p>
          </div>
          <Suspense
            fallback={
              <div className="h-[400px] rounded-2xl bg-bgSoft animate-pulse" />
            }
          >
            <CalendarioCliente clienteId={cliente.id} />
          </Suspense>
        </section>
      </main>
    </div>
  );
}

async function TarefasDoCliente({ clienteId }: { clienteId: string }) {
  const projetoIds = await getProjetosDoCliente(clienteId);
  if (projetoIds.length === 0) {
    return <p className="text-[13px] text-t3">Sem projetos vinculados.</p>;
  }
  const porCat = await listTarefasPendentesPorCategoria(projetoIds);
  const total = ORDEM_CATEGORIAS.reduce((s, c) => s + porCat[c].length, 0);
  if (total === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'var(--prazo-em-dia-soft)' }}
      >
        <div className="text-[24px]">✨</div>
        <div
          className="mt-2 text-[14px] font-semibold"
          style={{ color: 'var(--prazo-em-dia)' }}
        >
          Cliente em dia
        </div>
        <p className="mt-1 text-[12px] text-t2">Nenhuma tarefa pendente no momento.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {ORDEM_CATEGORIAS.map((cat) => {
        const tarefas = porCat[cat];
        if (tarefas.length === 0) return null;
        return (
          <div key={cat} className="card p-4">
            <div className="flex items-center gap-2">
              <span className="text-[16px]">{CATEGORIA_EMOJI[cat]}</span>
              <div className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                {CATEGORIA_LABEL[cat].tituloLongo}
              </div>
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: 'var(--prazo-hoje-soft)',
                  color: 'var(--prazo-hoje)',
                }}
              >
                {tarefas.length}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {tarefas.map((t) => (
                <TarefaLinha key={t.tarefaId} tarefa={t} categoria={cat} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function TarefaLinha({
  tarefa,
  categoria,
}: {
  tarefa: TarefaPendente;
  categoria: CategoriaTarefa;
}) {
  const href = `/post/${tarefa.postId}?tarefa=${tarefa.tarefaId}&from=${categoria}`;
  const prazo = tarefa.tarefaPrazo
    ? new Date(tarefa.tarefaPrazo.split('T')[0] + 'T00:00:00')
    : null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = prazo
    ? Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000)
    : null;
  const prazoLabel =
    dias === null
      ? null
      : dias < 0
        ? `atrasada ${Math.abs(dias)}d`
        : dias === 0
          ? 'hoje'
          : dias === 1
            ? 'amanhã'
            : `em ${dias} dias`;
  const urgente = dias !== null && dias <= 0;
  return (
    <li>
      <a
        href={href}
        className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition hover:bg-bgSoft"
      >
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
          {tarefa.postTitulo}
        </span>
        {prazoLabel && (
          <span
            className="shrink-0 text-[11px] font-semibold"
            style={{
              color: urgente ? 'var(--prazo-atrasado)' : 'var(--prazo-tranquilo)',
            }}
          >
            {prazoLabel}
          </span>
        )}
        <span className="shrink-0 text-t3 transition group-hover:text-ink">→</span>
      </a>
    </li>
  );
}

async function CalendarioCliente({ clienteId }: { clienteId: string }) {
  const projetoIds = await getProjetosDoCliente(clienteId);
  if (projetoIds.length === 0) return null;
  const hoje = new Date();
  const year = hoje.getFullYear();
  const month = hoje.getMonth() + 1;
  const posts = await listPostsDoMes(projetoIds, year, month);
  return (
    <CalendarNavigator
      mesInicial={{ year, month, posts }}
      totalMesesAFrente={2}
      projetoIdsOverride={projetoIds}
    />
  );
}
