import { redirect } from 'next/navigation';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { AtualizacoesRecentes } from '../_components/AtualizacoesRecentes';

export const dynamic = 'force-dynamic';

export default async function NotificacoesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  return (
    <main className="mx-auto max-w-4xl lg:max-w-5xl px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
            Notificações
          </h1>
          <p className="mt-1 text-[14px] text-t2">
            Mudanças de status e novos comentários nos posts — feed completo,
            ordenado pelo mais recente.
          </p>
        </div>
        <a
          href="/api/admin/atualizar"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-navy px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 3v6h-6" />
          </svg>
          Atualizar agora
        </a>
      </div>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`h-[78px] bg-bgSoft/40 animate-pulse ${
                  i > 0 ? 'border-t border-[rgba(21,21,33,0.05)]' : ''
                }`}
              />
            ))}
          </div>
        }
      >
        <AtualizacoesRecentes limit={40} />
      </Suspense>
    </main>
  );
}
