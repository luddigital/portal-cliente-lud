import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { getEntregaDetalhe, type TarefaDaEntrega } from '@/lib/notion';
import { env } from '@/lib/env';
import { EntregaTarefas } from './EntregaTarefas';

export const dynamic = 'force-dynamic';

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
}

function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

export default async function EntregaAdminPage({ params }: { params: { id: string } }) {
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
            entrega
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-8">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-[100px] rounded-2xl bg-bgSoft animate-pulse" />
              <div className="h-[400px] rounded-2xl bg-bgSoft animate-pulse" />
            </div>
          }
        >
          <Conteudo id={params.id} />
        </Suspense>
      </main>
    </div>
  );
}

async function Conteudo({ id }: { id: string }) {
  const entrega = await getEntregaDetalhe(id);
  if (!entrega) notFound();

  // Agrupa tarefas por cliente (ou projeto se não tiver cliente)
  const grupos = new Map<string, { titulo: string; tarefas: TarefaDaEntrega[] }>();
  for (const t of entrega.tarefasRelacionadas) {
    const chave = t.clienteNome ?? t.projetoNome ?? '(sem projeto)';
    if (!grupos.has(chave)) grupos.set(chave, { titulo: chave, tarefas: [] });
    grupos.get(chave)!.tarefas.push(t);
  }
  const gruposOrdenados = [...grupos.values()].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, 'pt-BR'),
  );

  // Data da tarefa pendente mais antiga (a que está esperando há mais tempo).
  const prazoMaisAntigo =
    entrega.tarefasRelacionadas
      .map((t) => t.prazo)
      .filter((p): p is string => !!p)
      .sort()[0] ?? null;

  return (
    <>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          entrega
        </div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">
          {entrega.nome}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {entrega.frequencia && (
            <span className="rounded-full bg-bgSoft px-2 py-0.5 text-t2">
              {entrega.frequencia}
            </span>
          )}
          {entrega.proximaData && (
            <span className="rounded-full bg-bgSoft px-2 py-0.5 text-t2">
              Próxima: {entrega.proximaData.replace(/^⏳\s*/, '')}
            </span>
          )}
          {prazoMaisAntigo &&
            (diasAte(prazoMaisAntigo) < 0 ? (
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{
                  background: 'var(--prazo-atrasado-soft)',
                  color: 'var(--prazo-atrasado)',
                }}
              >
                ⚠ Mais antiga pendente: {fmtDataBR(prazoMaisAntigo)}
              </span>
            ) : (
              <span className="rounded-full bg-bgSoft px-2 py-0.5 text-t2">
                Mais antiga pendente: {fmtDataBR(prazoMaisAntigo)}
              </span>
            ))}
        </div>
      </div>

      <div
        className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-5 flex items-center justify-between gap-4 flex-wrap"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Tarefas em aberto
          </div>
          <div className="mt-1 text-[13px] text-t2">
            Tarefas prontas (check ativado) ainda não concluídas, agrupadas por cliente.
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
            {entrega.tarefasRelacionadas.length}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
            em aberto
          </div>
        </div>
      </div>

      {gruposOrdenados.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--prazo-em-dia-soft)' }}
        >
          <div className="text-[24px]">✨</div>
          <div
            className="mt-2 text-[14px] font-semibold"
            style={{ color: 'var(--prazo-em-dia)' }}
          >
            Entrega zerada
          </div>
          <p className="mt-1 text-[12px] text-t2">
            Nenhuma tarefa em aberto vinculada a essa entrega.
          </p>
        </div>
      ) : (
        <EntregaTarefas grupos={gruposOrdenados} />
      )}
    </>
  );
}
