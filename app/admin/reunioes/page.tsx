import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listAllProjetos } from '@/lib/notion';
import { listarReunioes } from '@/lib/supabase';
import { classificarProjeto } from '@/lib/projetoServico';
import { ReunioesView } from './ReunioesView';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function ReunioesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  const [projetos, reunioes] = await Promise.all([
    listAllProjetos(),
    listarReunioes({ limite: 200 }),
  ]);

  const projetosOrdenados = [...projetos].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
          ← Admin
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
              Reuniões com clientes
            </h1>
            <p className="mt-1 text-[13px] text-t2">
              Agende, marque como feita e guarde as anotações.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <ReunioesView
            reunioes={reunioes}
            projetos={projetosOrdenados.map((p) => ({
              id: p.id,
              nome: p.nome,
              servico: classificarProjeto(p.nome),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
