import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { env } from '@/lib/env';
import { getProjetoNome, listarTarefasAbertasDosPosts } from '@/lib/notion';
import { lerNotaEntrega } from '@/lib/supabase';
import { carregarEntrega, semTraco } from '@/lib/entrega-dados';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { Trilha } from '../../../../_components/Trilha';
import { Card, Pagina } from '../../../../_ui/lud';
import { EsqueletoBlocos } from '../../../../_ui/EsqueletoBlocos';
import { EntregaProjetoNova } from './EntregaProjetoNova';
import { EntregaPautaNova } from './EntregaPautaNova';
import { ehCriacaoDePauta, montarCliente } from '../../../../entregas/[id]/pautaDados';
import { carregarQuadro } from '../../../../entregas/quadro';

export const dynamic = 'force-dynamic';
// Sem a reserva do cache (logo depois de concluir) a leitura do Notion pode passar de 15s.
export const maxDuration = 60;

/** Projetos › projeto › entrega: a entrega só desse projeto (visual novo "NovaEntrega", linha do tempo por post). */
export default function EntregaDoProjetoPage({ params }: { params: { id: string; entregaId: string } }) {
  return (
    <Suspense fallback={<EsqueletoBlocos kpis={4} blocos={[150, 260, 520]} lateral />}>
      <Conteudo projetoId={params.id} entregaId={params.entregaId} />
    </Suspense>
  );
}

async function Conteudo({ projetoId, entregaId }: { projetoId: string; entregaId: string }) {
  const d = await carregarEntrega(entregaId, projetoId, { longo: true });
  if (!d) notFound();
  const grupo = d.grupos.find((g) => g.projetoId && semTraco(g.projetoId) === semTraco(projetoId)) ?? null;

  if (!grupo) {
    const nome = await getProjetoNome(projetoId).catch(() => 'Projeto');
    return (
      <Pagina>
        <Trilha
          itens={[
            { rotulo: 'Projetos', href: rotas.projetos() },
            { rotulo: nomeCurtoDoProjeto(nome), href: rotas.projeto(projetoId) },
            { rotulo: 'Entregas', href: rotas.entregasDoProjeto(projetoId) },
            { rotulo: d.entrega.nome },
          ]}
        />
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">{d.entrega.nome}</h1>
        <Card>
          <p className="text-[13.5px] text-[#46464B]">
            Esse projeto não tem tarefas nessa entrega agora (olhamos de 45 dias atrás até 10 dias pra frente).{' '}
            <Link href={rotas.entrega(entregaId)} className="font-bold text-[#111113] underline">
              Ver a entrega com todos os clientes
            </Link>
          </p>
        </Card>
      </Pagina>
    );
  }

  // Criação de Pauta tem tela própria (calendário do mês com os dias de post).
  if (ehCriacaoDePauta(d.entrega.nome)) {
    const postIds = grupo.itens.map((i) => i.postId).filter((x): x is string => !!x);
    const [abertas, quadro, notaP] = await Promise.all([
      listarTarefasAbertasDosPosts(postIds).catch(() => new Map()),
      carregarQuadro(d.entrega.id).catch(() => null),
      lerNotaEntrega(d.entrega.id, grupo.projetoId),
    ]);
    const c = montarCliente(grupo, d.hojeIso, abertas);
    if (c) {
      const q = quadro?.quadros.find((x) => semTraco(x.id) === semTraco(d.entrega.id));
      const vistos = new Map<string, { projetoId: string; handle: string }>();
      for (const col of q?.colunas ?? []) for (const l of col.linhas) if (!vistos.has(semTraco(l.projetoId))) vistos.set(semTraco(l.projetoId), { projetoId: l.projetoId, handle: l.handle });
      if (!vistos.has(semTraco(c.projetoId))) vistos.set(semTraco(c.projetoId), { projetoId: c.projetoId, handle: c.handle });
      const clientes = [...vistos.values()].sort((a, b) => a.handle.localeCompare(b.handle, 'pt-BR'));
      return (
        <EntregaPautaNova
          entregaId={d.entrega.id}
          entregaNome={d.entrega.nome}
          frequencia={d.entrega.frequencia ?? null}
          c={c}
          hoje={d.hojeIso}
          clientes={clientes}
          notaInicial={notaP}
        />
      );
    }
  }

  const nota = await lerNotaEntrega(d.entrega.id, grupo.projetoId);
  return (
    <EntregaProjetoNova
      entregaId={d.entrega.id}
      entregaNome={d.entrega.nome}
      frequencia={d.entrega.frequencia ?? null}
      tipo={d.tipo}
      grupo={grupo}
      textos={d.textos}
      baseUrl={env.app.url}
      hojeIso={d.hojeIso}
      notaInicial={nota}
    />
  );
}
