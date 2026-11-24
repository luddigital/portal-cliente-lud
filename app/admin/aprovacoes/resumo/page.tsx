import { redirect } from 'next/navigation';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { planejarResumo } from '@/lib/resumo-tarde';
import { Cabecalho, Pagina } from '../../_ui/lud';
import { Trilha } from '../../_components/Trilha';
import { ResumoLista } from './ResumoLista';

export const dynamic = 'force-dynamic';

/** Revisão da manhã do resumo que sai às 16h no grupo de cada cliente. */
export default async function ResumoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/');
  return (
    <Pagina>
      <Trilha itens={[{ rotulo: 'Aprovações', href: '/admin/aprovacoes' }, { rotulo: 'Resumo das 16h' }]} />
      <Cabecalho titulo="Resumo das 16h" sub="O que ainda está com cada cliente pra aprovar. Revise de manhã: às 16h sai uma mensagem por cliente, no grupo." />
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[20px] bg-[#F0F0F1]" />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}

async function Conteudo() {
  try {
    return <ResumoLista clientes={await planejarResumo()} />;
  } catch (err: any) {
    return <div className="rounded-[16px] border border-[#F3C4BE] bg-[#FBE3E0] px-5 py-4 text-[13.5px] text-[#7E211C]">Não consegui montar o resumo ({err?.message ?? 'erro'}).</div>;
  }
}
