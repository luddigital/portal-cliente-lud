import { redirect } from 'next/navigation';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { Cabecalho, Pagina, Vazio } from '../_ui/lud';
import { carregarQuadro } from './quadro';
import { entregasDeHoje } from './HojePrimeiro';
import { Kpis, LegendaTipo, ListaEntregas, Secao, TodasEntregas } from './EntregasVisao';

export const dynamic = 'force-dynamic';
// Sem a reserva do cache (logo depois de concluir) a leitura do Notion pode passar de 15s.
export const maxDuration = 60;

/**
 * Entregas: hoje e em atraso lado a lado (por cliente ou por pessoa, sem abrir
 * post por post), os próximos dias e os atalhos pra cada entrega.
 * Tudo das tarefas abertas no Notion.
 */
export default async function EntregasPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/');

  return (
    <Pagina>
      <Suspense fallback={<Esqueleto />}>
        <Conteudo />
      </Suspense>
    </Pagina>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="h-[72px] animate-pulse rounded-[14px] bg-[#F0F0F1]" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[84px] w-[220px] animate-pulse rounded-[14px] bg-[#F0F0F1]" />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-[20px] bg-[#F0F0F1]" />
      <div className="h-[160px] animate-pulse rounded-[20px] bg-[#F0F0F1]" />
    </div>
  );
}

const SEMANA_LONGA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

async function Conteudo() {
  const { quadros, hoje } = await carregarQuadro();
  if (quadros.length === 0) return <Vazio>Nenhuma entrega no banco do Notion.</Vazio>;

  const deHoje = entregasDeHoje(quadros, hoje);
  const d = new Date(`${hoje}T12:00:00Z`);
  const nomes = deHoje.map((q) => q.nome);
  const dia = `${SEMANA_LONGA[d.getUTCDay()]}, ${hoje.slice(8, 10)}/${hoje.slice(5, 7)}.`;
  const sub =
    nomes.length === 0 ? (
      `${dia} Nenhuma entrega vence hoje.`
    ) : (
      <>
        {dia} Hoje vence <b className="text-[#111113]">{nomes.slice(0, 3).join(', ')}</b>
        {nomes.length > 3 ? ` e mais ${nomes.length - 3}` : ''}.
      </>
    );

  return (
    <>
      <Cabecalho eyebrow="Dia a dia" titulo="Entregas" sub={sub} />
      <Kpis quadros={quadros} hoje={hoje} deHoje={deHoje} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Secao n={1} titulo="Hoje, em atraso e próximos 7 dias" sub="tudo numa lista só" />
        <LegendaTipo />
      </div>
      <ListaEntregas quadros={quadros} hoje={hoje} deHoje={deHoje} />
      <Secao n={2} titulo="Todas as entregas" sub={`${quadros.length} entregas. Clique pra abrir.`} />
      <TodasEntregas quadros={quadros} hoje={hoje} deHoje={deHoje} />
    </>
  );
}
