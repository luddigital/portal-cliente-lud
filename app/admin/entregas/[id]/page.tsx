import { ehEntregaAprovacoes } from '@/lib/entregasAprovacao';
import { notFound, redirect } from 'next/navigation';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { env } from '@/lib/env';
import { carregarEntrega, type DadosDaEntrega } from '@/lib/entrega-dados';
import { rotas } from '@/lib/rotas';
import { getEntregaCompleta } from '@/lib/notion';
import { Trilha } from '../../_components/Trilha';
import { EntregaPorCliente } from '../../entrega/[id]/EntregaPorCliente';
import { Card, Pagina, TituloCard, Vazio } from '../../_ui/lud';
import { carregarQuadro } from '../quadro';
import { listAllProjetos, listarTarefasAbertasDeTodos } from '@/lib/notion';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import { semTraco, tipoDaEntrega } from '@/lib/entrega-dados';
import { AbrirUmaEntrega, Atrasados, HojeComCliente, HojeInterna, ProximaRodada, Secao } from '../HojePrimeiro';
import { PautaTodos } from './PautaTodos';
import { EntregaSemanas } from './EntregaSemanas';
import { ConferenciaDia } from './ConferenciaDia';
import { lerConferencias } from '@/lib/conferencia';
import { getHorarioDoProjeto } from '@/lib/notion';
import { getFotoDoInstagramDoProjeto } from '@/lib/instagram';
import { ehCriacaoDePauta } from './pautaDados';

/** Materiais para Produção e a aprovação desses materiais ficam na mesma página. */
const MATERIAIS = '2b5d04d23b4a8027b258c0fe766c0928';
const APROVACAO_MATERIAIS = '2b5d04d23b4a80a6b5b9e47e1ea2ac49';

export const dynamic = 'force-dynamic';

/**
 * Entregas › entrega: todos os clientes. Rodada atual, atrasados e próxima
 * rodada (mesma lógica da página Entregas), e embaixo os posts por cliente com
 * os envios de sempre. Cada cliente leva pra entrega do projeto dele.
 */
export default async function EntregaPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { cliente?: string; aba?: string };
}) {
  // "Aprovações" saiu: cada reaprovação está na página própria (Aprovação | Post, | Arte…).
  if (ehEntregaAprovacoes(params.id)) redirect(rotas.entrega('2b5d04d23b4a804d9176c7a743f336d1'));
  // Link antigo com ?cliente= → a entrega daquele projeto.
  if (typeof searchParams.cliente === 'string' && searchParams.cliente) {
    redirect(rotas.entregaDoProjeto(searchParams.cliente, params.id));
  }
  // Criação de Pauta tem tela própria com todos os clientes.
  const ent = await getEntregaCompleta(params.id).catch(() => null);
  // "Aprovação | Materiais para Produção" mora dentro de "Materiais para Produção", numa aba.
  if (semTraco(params.id) === APROVACAO_MATERIAIS) redirect(rotas.entrega(MATERIAIS));
  if (semTraco(params.id) === MATERIAIS) {
    // Uma lista só: os posts em "Aprovação | Materiais" aparecem junto, com o status deles.
    return (
      <Pagina>
        <Suspense fallback={<div className="h-[92px] animate-pulse rounded-[14px] bg-[#F0F0F1]" />}>
          <Topo id={params.id} />
        </Suspense>
        <Suspense fallback={<div className="h-[520px] animate-pulse rounded-[20px] bg-[#F0F0F1]" />}>
          <Semanas id={MATERIAIS} juntarCom={APROVACAO_MATERIAIS} />
        </Suspense>
      </Pagina>
    );
  }
  if (ent && ehCriacaoDePauta(ent.nome)) {
    return (
      <Suspense fallback={<div className="h-[520px] animate-pulse rounded-[20px] bg-[#F0F0F1]" />}>
        <PautaTodos id={params.id} />
      </Suspense>
    );
  }
  return (
    <Pagina>
      <Suspense fallback={<div className="h-[92px] animate-pulse rounded-[14px] bg-[#F0F0F1]" />}>
        <Topo id={params.id} />
      </Suspense>
      <Suspense fallback={<div className="h-[520px] animate-pulse rounded-[20px] bg-[#F0F0F1]" />}>
        <Semanas id={params.id} />
      </Suspense>
    </Pagina>
  );
}

/** Abas por semana (atrasados, esta, próximas), DL em destaque e posts por cliente; a gestão antiga fica recolhida embaixo. */
async function Semanas({ id, juntarCom }: { id: string; juntarCom?: string }) {
  const [principal, extra] = await Promise.all([
    carregarEntrega(id, undefined, { longo: true }),
    juntarCom ? carregarEntrega(juntarCom, undefined, { longo: true }).catch(() => null) : Promise.resolve(null),
  ]);
  if (!principal) notFound();
  const d = extra ? juntarEntregas(principal, extra) : principal;
  const { entrega, grupos, tipo, textos, hojeIso } = d;
  const fotos = Object.fromEntries(
    await Promise.all(
      grupos.map(async (g) => [g.projetoId, await getFotoDoInstagramDoProjeto(g.projetoId, g.projetoNome || g.nome).catch(() => null)] as const),
    ),
  );
  const conferir = /conferir postagem/i.test(entrega.nome);
  const [horarios, conferencias] = conferir
    ? await Promise.all([
        Promise.all(grupos.map(async (g) => [g.projetoId, await getHorarioDoProjeto(g.projetoId).catch(() => null)] as const)).then(Object.fromEntries),
        lerConferencias(grupos.flatMap((g) => g.itens.map((i) => i.postId).filter((x): x is string => !!x))),
      ])
    : [{}, {}];
  return (
    <>
      <EntregaSemanas
        extra={
          conferir
            ? { rotulo: '✅ Conferência do dia', conteudo: <ConferenciaDia grupos={grupos} fotos={fotos} horarios={horarios} conferencias={conferencias} hojeIso={hojeIso} /> }
            : undefined
        }
        fotos={fotos}
        entregaId={entrega.id}
        entregaNome={entrega.nome}
        tipo={tipo}
        grupos={grupos}
        textos={textos}
        baseUrl={env.app.url}
        hojeIso={hojeIso}
        diaria={/di[áa]ria/i.test(entrega.frequencia ?? '') || conferir}
      />
      <details className="group rounded-[16px] border border-[#E9E9EB] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 [&::-webkit-details-marker]:hidden">
          <b className="text-[13.5px]">Gestão completa</b>
          <span className="text-[12.5px] text-[#636369]">filtros, visão por data, mensagens e histórico ▸</span>
        </summary>
        <div className="border-t border-[#F0F0F2] p-4">
          {grupos.length === 0 ? (
            <Vazio>Entrega zerada. Nenhuma tarefa vinculada a essa entrega nesse período.</Vazio>
          ) : (
            <EntregaPorCliente
              entregaId={entrega.id}
              entregaNome={entrega.nome}
              tipo={tipo}
              grupos={grupos}
              textos={textos}
              baseUrl={env.app.url}
              hojeIso={hojeIso}
            />
          )}
        </div>
      </details>
    </>
  );
}

async function Topo({ id }: { id: string }) {
  const entrega = await getEntregaCompleta(id);
  if (!entrega) notFound();
  return (
    <header className="flex flex-col gap-2">
      <Trilha itens={[{ rotulo: 'Entregas', href: rotas.entregas() }, { rotulo: entrega.nome }]} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">{entrega.nome}</h1>
        </div>
      </div>
    </header>
  );
}

/**
 * Mesma lógica da página Entregas, só dessa entrega: a rodada atual (cliente por
 * cliente ou pessoa por pessoa), o que ficou atrasado e a próxima rodada.
 */
async function Rodada({ id }: { id: string }) {
  const [{ quadros, hoje }, tarefas, projetos] = await Promise.all([
    carregarQuadro(),
    listarTarefasAbertasDeTodos().catch(() => []),
    listAllProjetos().catch(() => []),
  ]);
  const q = quadros.find((x) => semTraco(x.id) === semTraco(id));
  if (!q) return null;
  const nomeProj = new Map(projetos.map((p) => [semTraco(p.id), p.nome]));
  const handle = (pid: string | null) => (pid ? nomeCurtoDoProjeto(nomeProj.get(semTraco(pid)) ?? 'Projeto') : 'sem projeto');
  const interna = tipoDaEntrega(q.nome) === 'interna';
  const venceHoje = q.dataAtual === hoje;
  const eyebrow = `Rodada atual · ${q.colunas[1].periodo}${venceHoje ? ' · vence hoje' : ''}`;
  return (
    <>
      <Secao n={1} titulo="Rodada atual" sub={`${q.diaRotulo} · ${q.colunas[1].periodo}`} />
      {interna ? (
        <HojeInterna q={q} hoje={hoje} tarefas={tarefas} handle={handle} de={q.rodadaIni} ate={q.rodadaFim} eyebrow={eyebrow} comLinkEntrega={false} />
      ) : (
        <HojeComCliente q={q} hoje={hoje} de={q.rodadaIni} ate={q.rodadaFim} eyebrow={eyebrow} comLinkEntrega={false} />
      )}
      <Secao n={2} titulo="Atrasado" sub="o que ficou de rodadas anteriores dessa entrega" />
      <Atrasados quadros={[q]} hoje={hoje} mostrarEntrega={false} />
      <Secao n={3} titulo="Próxima rodada" />
      <ProximaRodada q={q} />
    </>
  );
}

async function Atalhos({ id }: { id: string }) {
  const { quadros } = await carregarQuadro();
  return <AbrirUmaEntrega quadros={quadros} atual={id} titulo="Abrir outra entrega" />;
}

async function PostsPorCliente({ id }: { id: string }) {
  const d = await carregarEntrega(id);
  if (!d) notFound();
  const { entrega, grupos, tipo, textos, hojeIso } = d;
  return (
    <Card pad="p-5 sm:p-6">
      <TituloCard titulo="Posts por cliente" sub="de 45 dias atrás até 10 dias pra frente · clique num post pra ver a prévia" />
      {grupos.length === 0 ? (
        <Vazio>Entrega zerada. Nenhuma tarefa vinculada a essa entrega nesse período.</Vazio>
      ) : (
        <EntregaPorCliente
          entregaId={entrega.id}
          entregaNome={entrega.nome}
          tipo={tipo}
          grupos={grupos}
          textos={textos}
          baseUrl={env.app.url}
          hojeIso={hojeIso}
        />
      )}
    </Card>
  );
}

/**
 * Junta duas entregas na mesma lista (Materiais + Aprovação dos materiais). Um post
 * que está nas duas aparece uma vez só: na etapa que ainda está aberta.
 */
function juntarEntregas(a: DadosDaEntrega, b: DadosDaEntrega): DadosDaEntrega {
  const porProjeto = new Map(a.grupos.map((g) => [g.projetoId, { ...g, itens: [...g.itens] }]));
  for (const g of b.grupos) {
    const atual = porProjeto.get(g.projetoId);
    if (atual) atual.itens.push(...g.itens);
    else porProjeto.set(g.projetoId, { ...g, itens: [...g.itens] });
  }
  const grupos = [...porProjeto.values()].map((g) => {
    const doPost = new Map<string, (typeof g.itens)[number]>();
    const semPost: typeof g.itens = [];
    for (const i of g.itens) {
      if (!i.postId) {
        semPost.push(i);
        continue;
      }
      const outro = doPost.get(i.postId);
      // Fica a etapa ainda aberta; se as duas estão feitas, a mais adiante (a aprovação, que vem depois).
      if (!outro || (outro.enviado && !i.enviado) || (outro.enviado && i.enviado)) doPost.set(i.postId, i);
    }
    const itens = [...doPost.values(), ...semPost].sort((x, y) => (x.prazo ?? '9999').localeCompare(y.prazo ?? '9999'));
    return { ...g, itens };
  });
  grupos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  return { ...a, grupos };
}
