import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { getAprovacoesAgrupadas, type TarefaDaEntrega } from '@/lib/notion';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function AprovacoesAdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

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
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            aprovações
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-8">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-[90px] rounded-2xl bg-bgSoft animate-pulse" />
              <div className="h-[300px] rounded-2xl bg-bgSoft animate-pulse" />
            </div>
          }
        >
          <Conteudo />
        </Suspense>
      </main>
    </div>
  );
}

async function Conteudo() {
  const grupos = await getAprovacoesAgrupadas();
  const total = grupos.reduce((s, g) => s + g.tarefas.length, 0);

  return (
    <>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          entregas
        </div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">
          Aprovações
        </h1>
        <p className="mt-2 text-[14px] text-t2">
          Tudo que está aguardando aprovação, reunido aqui e separado por
          categoria.
        </p>
      </div>

      <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Aguardando aprovação
          </div>
          <div className="mt-1 text-[13px] text-t2">
            {grupos.length} categoria{grupos.length === 1 ? '' : 's'} com tarefas
            em aberto.
          </div>
        </div>
        <div
          className="rounded-xl px-5 py-3 text-center min-w-[100px]"
          style={{
            background: 'var(--prazo-hoje-soft)',
            color: 'var(--prazo-hoje)',
          }}
        >
          <div className="text-[28px] font-semibold leading-none tracking-[-0.03em]">
            {total}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
            em aberto
          </div>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--prazo-em-dia-soft)' }}
        >
          <div className="text-[24px]">✨</div>
          <div
            className="mt-2 text-[14px] font-semibold"
            style={{ color: 'var(--prazo-em-dia)' }}
          >
            Nada pra aprovar
          </div>
          <p className="mt-1 text-[12px] text-t2">
            Nenhuma tarefa de aprovação em aberto no momento.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.categoria} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
                  {g.categoria}
                </h2>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: 'var(--prazo-hoje-soft)',
                    color: 'var(--prazo-hoje)',
                  }}
                >
                  {g.tarefas.length}
                </span>
              </div>
              <div className="card divide-y divide-[rgba(21,21,33,0.06)] overflow-hidden p-0">
                {g.tarefas.map((t) => (
                  <TarefaRow key={t.tarefaId} tarefa={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function TarefaRow({ tarefa: t }: { tarefa: TarefaDaEntrega }) {
  const href = t.postId
    ? `/post/${t.postId}?tarefa=${t.tarefaId}`
    : `/tarefa/${t.tarefaId}`;
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-bgSoft/60"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-ink">
          {t.postTitulo || t.titulo}
        </div>
        <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.06em] text-t3">
          {t.clienteNome ?? t.projetoNome ?? '(sem cliente)'} · {t.titulo}
        </div>
      </div>
      {t.status && (
        <span className="shrink-0 rounded bg-bgSoft px-2 py-0.5 text-[10px] font-semibold text-t2">
          {t.status}
        </span>
      )}
      <span className="shrink-0 text-[16px] text-t3">›</span>
    </Link>
  );
}
