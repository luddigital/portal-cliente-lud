import {
  listAllClientes,
  listAllProjetos,
  type ClienteResumo,
  type ProjetoListItem,
} from '@/lib/notion';
import { TrafegoPagoView } from './TrafegoPagoView';

export const dynamic = 'force-dynamic';

export default async function TrafegoPagoPage() {
  const [clientes, projetos] = await Promise.all([
    listAllClientes(),
    listAllProjetos(),
  ]);
  return (
    <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        Tráfego pago
      </h1>
      <p className="mt-1 text-[14px] text-t2">
        Preencha o contexto da campanha, suba o relatório da Meta e veja o
        dashboard pronto pra mandar pro cliente.
      </p>
      <div className="mt-6">
        <TrafegoPagoView
          clientes={clientes as ClienteResumo[]}
          projetos={projetos as ProjetoListItem[]}
        />
      </div>
    </main>
  );
}
