import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { ApagadorPastas } from './ApagadorPastas';

export const dynamic = 'force-dynamic';

export default async function DrivePastasPage() {
  // Check de admin feito pelo layout.tsx — não duplica aqui pra não ter
  // chance de redirect inesperado. Em caso raro de layout não pegar,
  // mostra mensagem clara em vez de redirecionar silenciosamente.
  const session = await getSession();
  const emailAdmin = session
    ? env.auth.adminEmails.includes(session.email.trim().toLowerCase())
    : false;

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-[18px] font-semibold text-ink">Sem sessão</h1>
        <p className="mt-2 text-[13px] text-t2">
          Faz login no portal pra acessar essa página.
        </p>
        <Link href="/login" className="mt-4 inline-block btn-primary">
          Ir pro login
        </Link>
      </div>
    );
  }

  if (!emailAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-[18px] font-semibold text-ink">Sem acesso admin</h1>
        <p className="mt-2 text-[13px] text-t2">
          Seu email ({session.email}) não está em{' '}
          <code className="font-mono text-[11px]">ADMIN_EMAILS</code>.
        </p>
        <p className="mt-1 text-[11px] text-t3">
          Lista atual: {env.auth.adminEmails.join(', ')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Pastas do Drive
            </h1>
            <p className="text-[11px] text-t3">
              Lista tudo que o portal criou no Drive. Marca o que quer apagar e envia pra lixeira.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        <div className="card p-4 text-[12.5px] leading-[1.6] text-t2">
          <p>
            <b>Como funciona:</b> as pastas apagadas vão pra <b>lixeira</b> do
            Drive (não é delete definitivo). Dá pra recuperar entrando no Drive →
            Lixeira → clicar com o botão direito → Restaurar. O Google limpa a lixeira
            depois de 30 dias automaticamente.
          </p>
        </div>

        <ApagadorPastas />
      </main>
    </div>
  );
}
