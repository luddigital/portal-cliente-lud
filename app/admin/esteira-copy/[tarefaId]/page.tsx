import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { EMAIL_FEEDBACK_COPY } from '@/lib/esteira';
import { cardDaEsteiraPorTarefa, listarTarefasDaEsteira } from '@/lib/notion';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import { Trilha } from '../../_components/Trilha';
import { Pagina } from '../../_ui/lud';
import { etapaDoCard } from '../etapa';
import { RevisaoPagina } from './RevisaoPagina';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Esteira Copy › revisão completa de um post (editar, pedir alteração, aprovar). */
export default async function RevisaoCopyPage({ params }: { params: { tarefaId: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/esteira');
  const [c, todos] = await Promise.all([cardDaEsteiraPorTarefa(params.tarefaId), listarTarefasDaEsteira().catch(() => null)]);
  if (!c) notFound();
  const card = {
    tarefaId: c.tarefaId,
    postId: c.postId,
    titulo: c.postTitulo,
    handle: nomeCurtoDoProjeto(c.projetoNome),
    pessoa: c.responsavelNome,
    prazo: c.prazo ? c.prazo.slice(0, 10) : null,
    etapa: etapaDoCard(c),
    etapaNome: c.entregaNome,
    fila: null,
    formato: c.formatoNome ?? null,
  };
  // Fila de revisão (aprovação), pelo prazo: "X de N" e o próximo.
  const fila = (todos ?? [])
    .filter((t) => etapaDoCard(t) === 'aprovacao')
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
  const idx = fila.findIndex((t) => t.tarefaId === c.tarefaId);
  const proximo = idx >= 0 ? fila[idx + 1] ?? null : fila[0] ?? null;
  const anterior = idx > 0 ? fila[idx - 1] : null;
  const etapas = (todos ?? []).map((t) => etapaDoCard(t));
  const contagem = todos
    ? { revisar: etapas.filter((e) => e === 'aprovacao' || e === 'alteracao').length, nao: etapas.filter((e) => e === 'nao').length, andamento: etapas.filter((e) => e === 'andamento').length }
    : null;
  return (
    <Pagina>
      <Trilha itens={[{ rotulo: 'Esteira Copy', href: '/admin/esteira-copy' }, { rotulo: card.titulo }]} />
      <RevisaoPagina
        card={card}
        souLuiza={session.email.trim().toLowerCase() === EMAIL_FEEDBACK_COPY}
        posicao={idx >= 0 ? idx + 1 : null}
        total={fila.length}
        proximoId={proximo && proximo.tarefaId !== c.tarefaId ? proximo.tarefaId : null}
        anteriorId={anterior ? anterior.tarefaId : null}
        contagem={contagem}
      />
    </Pagina>
  );
}
