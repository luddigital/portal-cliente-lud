import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorByEmail } from '@/lib/notion';
import { CardsCompararView } from './CardsCompararView';

export const dynamic = 'force-dynamic';

export default async function CardsCompararPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(
    session.email.trim().toLowerCase(),
  );
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {}
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-[rgba(21,21,33,0.08)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/esteira"
              className="text-[13px] text-mauve transition hover:text-ink"
            >
              ← Esteira
            </Link>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
              comparar cards
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <CardsCompararView />
      </main>
    </div>
  );
}
