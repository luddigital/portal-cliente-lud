import Link from 'next/link';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { listAllProjetos } from '@/lib/notion';

export const dynamic = 'force-dynamic';
// Sem a reserva do cache (logo depois de concluir) a leitura do Notion pode passar de 15s.
export const maxDuration = 60;

async function Lista() {
  const projetos = await listAllProjetos();
  if (projetos.length === 0) {
    return <p className="text-[13px] text-t3">Nenhum projeto encontrado.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projetos.map((p) => (
        <Link
          key={p.id}
          href={`/admin/projetos/${p.id}`}
          className="card p-4 transition hover:border-navy/30 hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]"
        >
          <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {p.nome}
          </div>
          <div className="mt-1 truncate text-[11px] text-t3">
            {p.clienteNome}
          </div>
          {p.status && (
            <span className="mt-3 inline-block rounded-full bg-bgSoft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-t2">
              {p.status}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export default function ProjetosPage() {
  return (
    <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Projetos
      </h1>
      <p className="mt-1 text-[14px] text-t2">
        Todos os projetos ativos. Clique pra ver o detalhe e editar objetivo e
        metas.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[100px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
                />
              ))}
            </div>
          }
        >
          <Lista />
        </Suspense>
      </div>
    </main>
  );
}
