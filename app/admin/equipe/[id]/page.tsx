import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorById, listProducaoDoColaborador } from '@/lib/notion';
import { ProducaoColaboradorView } from '@/app/_components/ProducaoColaboradorView';

export const dynamic = 'force-dynamic';

export default async function AdminColaboradorPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const colaborador = await getColaboradorById(params.id);
  if (!colaborador) notFound();

  const { pendentes, concluidas } = colaborador.pessoaUserId
    ? await listProducaoDoColaborador(colaborador.pessoaUserId)
    : { pendentes: [], concluidas: [] };

  return (
    <main className="mx-auto max-w-4xl lg:max-w-6xl px-6 py-10 space-y-6">
      <Link
        href="/admin/equipe"
        className="inline-flex items-center gap-1.5 text-[12px] text-mauve transition hover:text-ink"
      >
        ← Voltar pra equipe
      </Link>
      <ProducaoColaboradorView
        colaborador={colaborador}
        pendentes={pendentes}
        concluidas={concluidas}
        fromSlug="admin/equipe"
      />
    </main>
  );
}
