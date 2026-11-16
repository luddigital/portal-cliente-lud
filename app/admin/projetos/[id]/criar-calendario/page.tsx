import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getProjetoDetalhe } from '@/lib/notion';
import { CriarCalendarioForm } from './CriarCalendarioForm';

export const dynamic = 'force-dynamic';

export default async function CriarCalendarioPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const projeto = await getProjetoDetalhe(params.id);
  if (!projeto) notFound();

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <Link
          href={`/admin/projetos/${params.id}`}
          className="text-[11px] text-mauve transition hover:text-ink"
        >
          ← Voltar pro projeto
        </Link>

        <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Criar calendário
        </h1>
        <p className="mt-1 text-[13px] text-t2">
          Preenche o briefing abaixo. Quando terminar, o portal abre uma conversa nova no{' '}
          <b>claude.ai</b> com tudo pronto pra você rodar as suas skills (
          <code className="rounded bg-bgSoft px-1 py-0.5 text-[11px]">/planejamento-mensal</code>,{' '}
          <code className="rounded bg-bgSoft px-1 py-0.5 text-[11px]">@agente-estrategista</code>).
          Depois é só colar o calendário pronto de volta no portal.
        </p>

        <div className="mt-6">
          <CriarCalendarioForm
            projetoId={projeto.id}
            projetoNome={projeto.nome}
            clienteNome={projeto.clienteNome ?? projeto.nome}
          />
        </div>
      </div>
    </div>
  );
}
