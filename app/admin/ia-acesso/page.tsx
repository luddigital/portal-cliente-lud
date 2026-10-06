import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { GeradorLinkIA } from './GeradorLinkIA';

export const dynamic = 'force-dynamic';

export default async function IAAcessoPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin) redirect('/');

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Acesso pra IA
            </h1>
            <p className="text-[11px] text-t3">
              Gera um link mágico pra uma IA acessar o portal sem senha.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6 space-y-6">
        <div className="card p-4 text-[12px] leading-[1.6] text-t2">
          <p>
            <b>Como funciona:</b> você escolhe um e-mail (admin ou de cliente), o portal
            gera uma URL de 7 dias, você cola essa URL no prompt da IA. Quando a IA
            (ou qualquer browser) abre a URL, vira uma sessão de 30 dias. Sem senha em
            nenhuma etapa.
          </p>
          <p className="mt-2 text-t3">
            O e-mail define <b>o que a IA vê</b>: admin vê tudo, cliente vê só o dele.
          </p>
        </div>

        <GeradorLinkIA defaultEmail={session.email} />
      </main>
    </div>
  );
}
