import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { CompartilharDriveBotao } from './CompartilharDriveBotao';

export const dynamic = 'force-dynamic';

export default async function CompartilharDrivePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Compartilhar Drive com admins
            </h1>
            <p className="text-[11px] text-t3">
              Dá acesso de escrita na pasta raiz do Drive da Lud. pra todos os admins
              configurados. Idempotente — pode rodar quantas vezes quiser.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6 space-y-6">
        <div className="card p-5 space-y-3 text-[12.5px] leading-[1.6] text-t2">
          <p>
            As pastas criadas pelo portal ficam no Drive da conta OAuth
            (<code className="font-mono text-[11.5px]">oi@lud.digital</code>). Admins que
            abrem o link do Drive com outra conta Google veem tela preta / &quot;sem permissão&quot;.
          </p>
          <p>
            Esse botão compartilha a <b>pasta raiz</b> com cada admin da lista. Como
            o Drive herda permissões pra subpastas, todo mundo passa a conseguir
            abrir qualquer pasta de qualquer cliente/post abaixo da raiz.
          </p>
          <p>
            Admins atuais:{' '}
            <code className="font-mono text-[11.5px]">
              {env.auth.adminEmails.join(', ')}
            </code>
          </p>
        </div>

        <CompartilharDriveBotao />
      </main>
    </div>
  );
}
