import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  getColaboradorById,
  listProducaoDoColaborador,
} from '@/lib/notion';
import { ProducaoColaboradorView } from '@/app/_components/ProducaoColaboradorView';

export const dynamic = 'force-dynamic';

export default async function EquipeMePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Pega o colaborador pela session (preferência) ou pelo email (fallback —
  // caso a session venha de antes da feature de colaborador existir).
  const colaborador = session.colaboradorId
    ? await getColaboradorById(session.colaboradorId)
    : await getColaboradorByEmail(session.email);

  if (!colaborador) {
    // Não é colaborador — manda pra área certa
    const ehAdmin = env.auth.adminEmails.includes(
      session.email.trim().toLowerCase(),
    );
    if (ehAdmin) redirect('/admin');
    redirect('/');
  }

  const { pendentes, concluidas } = colaborador.pessoaUserId
    ? await listProducaoDoColaborador(colaborador.pessoaUserId)
    : { pendentes: [], concluidas: [] };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-4xl lg:max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[20px] font-bold tracking-[-0.02em] text-ink">
              Lud<span className="font-light text-mauve">.</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Área da equipe
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="text-[12px] text-mauve transition hover:text-ink">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl lg:max-w-6xl px-6 py-10">
        <ProducaoColaboradorView
          colaborador={colaborador}
          pendentes={pendentes}
          concluidas={concluidas}
          fromSlug="equipe/me"
        />
      </main>
    </div>
  );
}
