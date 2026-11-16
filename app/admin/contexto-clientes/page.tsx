import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { CATEGORIAS_CONTEXTO, listarContextos } from '@/lib/contextoClientes';
import { Cabecalho, Pagina, Vazio } from '../_ui/lud';
import { Trilha } from '../_components/Trilha';
import { ContextoClientes } from './ContextoClientes';

export const dynamic = 'force-dynamic';

/** Contexto dos clientes: espelho dos projetos do Claude, usado pela Esteira Copy e pela Fila de Copy. */
export default async function ContextoClientesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/');
  let docs: Awaited<ReturnType<typeof listarContextos>> = [];
  let erro: string | null = null;
  try {
    docs = await listarContextos();
  } catch (e: any) {
    erro = e?.message ?? 'erro';
  }
  return (
    <Pagina>
      <Trilha itens={[{ rotulo: 'Recursos' }, { rotulo: 'Contexto dos clientes' }]} />
      <Cabecalho
        titulo="Contexto dos clientes"
        sub="O mesmo material dos projetos de cada cliente no Claude: briefing, tom de voz, guia de copy e referências. A Esteira Copy e a Fila de Copy leem daqui, e a melhoria contínua atualiza as regras de cada cliente."
      />
      {erro ? <Vazio>Não consegui ler o contexto: {erro}</Vazio> : <ContextoClientes docs={docs} categorias={CATEGORIAS_CONTEXTO} />}
    </Pagina>
  );
}
