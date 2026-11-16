import Link from 'next/link';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { listAllClientes } from '@/lib/notion';

export const dynamic = 'force-dynamic';

async function Lista() {
  const clientes = await listAllClientes();
  if (clientes.length === 0) {
    return (
      <p className="text-[13px] text-t3">
        Nenhum cliente ativo com e-mail cadastrado.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clientes.map((c) => (
        <Link
          key={c.id}
          href={`/admin/clientes/${c.id}`}
          className="card p-4 transition hover:border-navy/30 hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]"
        >
          <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {c.nome}
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-t3">
            {c.email}
          </div>
          <span className="mt-3 inline-block rounded-full bg-bgSoft px-2.5 py-1 text-[10px] font-semibold text-t2">
            {c.projetoCount} {c.projetoCount === 1 ? 'projeto' : 'projetos'}
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function ClientesPage() {
  return (
    <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Clientes
      </h1>
      <p className="mt-1 text-[14px] text-t2">
        Todas as empresas ativas. Clique pra ver os projetos e a central de cada
        uma.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[110px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
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
