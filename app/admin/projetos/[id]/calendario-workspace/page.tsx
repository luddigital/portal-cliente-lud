import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getProjetoDetalhe } from '@/lib/notion';
import {
  lerCalendarioWorkspace,
  listarCalendariosDoProjeto,
} from '@/lib/supabase';
import { CalendarioWorkspace } from './CalendarioWorkspace';

export const dynamic = 'force-dynamic';

function parseMes(raw: string | undefined): { ano: number; mes: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number);
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) return { ano: y, mes: m };
  }
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export default async function CalendarioWorkspacePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { mes?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const projeto = await getProjetoDetalhe(params.id);
  if (!projeto) notFound();

  const { ano, mes } = parseMes(searchParams.mes);

  const [workspace, historico] = await Promise.all([
    lerCalendarioWorkspace(params.id, ano, mes),
    listarCalendariosDoProjeto(params.id, 12),
  ]);

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
        <Link
          href={`/admin/projetos/${params.id}`}
          className="text-[11px] text-mauve transition hover:text-ink"
        >
          ← Voltar pro projeto
        </Link>

        <CalendarioWorkspace
          projetoId={projeto.id}
          projetoNome={projeto.nome}
          clienteNome={projeto.clienteNome ?? projeto.nome}
          ano={ano}
          mes={mes}
          inicial={workspace}
          historico={historico.map((h) => ({
            ano: h.ano,
            mes: h.mes,
            atualizadoEm: h.atualizadoEm,
            versoesCount: h.versoes.length,
            temRascunho: h.rascunho.trim().length > 0,
          }))}
        />
      </div>
    </div>
  );
}
