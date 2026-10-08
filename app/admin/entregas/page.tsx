import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { EntregasLista, EntregasResumo } from '../_components/EntregasPainel';

export const dynamic = 'force-dynamic';

export default async function EntregasPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/');

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10 lg:max-w-7xl">
      <Suspense fallback={<div className="h-[260px] animate-pulse rounded-2xl bg-white/60" />}>
        <EntregasResumo titulo="Entregas" />
      </Suspense>
      <section className="space-y-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">Todas as entregas</h2>
          <p className="mt-0.5 text-[13px] text-t2">Clica numa entrega pra ver os posts por cliente e enviar o que estiver pronto.</p>
        </div>
        <Suspense fallback={<div className="h-[320px] animate-pulse rounded-2xl bg-white/60" />}>
          <EntregasLista />
        </Suspense>
      </section>
    </main>
  );
}
