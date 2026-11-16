import { redirect } from 'next/navigation';
import { rotas } from '@/lib/rotas';

/**
 * Endereço antigo da entrega. Hoje: /admin/entregas/[id] (todos os clientes)
 * e /admin/projetos/[id]/entregas/[entregaId] (um projeto).
 */
export default function EntregaAntiga({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { cliente?: string };
}) {
  const cliente = typeof searchParams.cliente === 'string' ? searchParams.cliente : null;
  redirect(cliente ? rotas.entregaDoProjeto(cliente, params.id) : rotas.entrega(params.id));
}
