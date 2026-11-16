import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { listAllProjetos, posicoesDoNotionNoMes } from '@/lib/notion';
import {
  listarPostsDoPortal,
  listarTarefasDoPortal,
  projetoDoPortal,
  tarefaAberta,
  tarefaDoClienteAgora,
} from '@/lib/conteudo-portal';
import { getGruposWhatsappDoProjeto, lerVisualizacoes } from '@/lib/supabase';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { grupoDaTarefa } from '@/lib/pendencias-cliente';
import type { ItemPendenciaUi } from '@/app/admin/projetos/[id]/PendenciasCliente';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { CalendarioConteudo, type PautaLinha } from './CalendarioConteudo';

export const dynamic = 'force-dynamic';

/** Calendário de conteúdo que roda 100% no portal (ver docs/PROCESSO-NO-PORTAL.md). */
export default async function ConteudoPage({
  params,
  searchParams,
}: {
  params: { projetoId: string };
  searchParams: { mes?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) redirect('/');

  const projeto = await projetoDoPortal(params.projetoId);
  if (!projeto) notFound();

  // Mês aberto: o pedido na URL, senão o primeiro mês que roda no portal (ou o atual, se já passou).
  const hoje = hojeEmSaoPaulo();
  const padrao = (projeto.desde > hoje ? projeto.desde : hoje).slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(searchParams.mes ?? '') ? searchParams.mes! : padrao;
  const [ano, m] = mes.split('-').map(Number);
  const inicio = `${mes}-01`;
  const fim = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);

  const [posts, projetos, posicoes] = await Promise.all([
    listarPostsDoPortal({ projetoIds: [projeto.projetoId], inicio, fim }),
    listAllProjetos().catch(() => []),
    inicio >= projeto.desde.slice(0, 7) + '-01'
      ? posicoesDoNotionNoMes(projeto.projetoId, ano, m).catch(() => [])
      : Promise.resolve([]),
  ]);
  const [tarefas, grupos, textos, vistas] = await Promise.all([
    listarTarefasDoPortal(posts.map((p) => p.id)),
    getGruposWhatsappDoProjeto(projeto.projetoId).catch(() => []),
    lerMensagensEditadas().catch(() => ({}) as Record<string, string>),
    lerVisualizacoes(posts.map((p) => p.id)).catch(() => ({}) as Awaited<ReturnType<typeof lerVisualizacoes>>),
  ]);
  const nome =
    projetos.find((p) => p.id.replace(/-/g, '') === projeto.projetoId.replace(/-/g, ''))?.nome ??
    projeto.nome ??
    'Projeto';

  const datasNoPortal = new Set(posts.map((p) => p.dataPostagem));
  const paraImportar = posicoes.filter((p) => p.data >= projeto.desde && !datasNoPortal.has(p.data)).length;

  const linhas: PautaLinha[] = posts.map((p) => {
    const doPost = tarefas.filter((t) => t.postId === p.id);
    const atual = doPost.find(tarefaAberta) ?? null;
    const pautaAprovada = doPost.some((t) => t.titulo === 'Aprovação | Pauta' && t.status === 'Concluído');
    return {
      post: p,
      atual: atual ? { titulo: atual.titulo, prazo: atual.prazo } : null,
      emProducao: doPost.some((t) => t.ordem >= 10),
      pautaAprovada,
    };
  });

  // O que está com o cliente agora (aprovar pauta, mandar informações…): base do aviso no WhatsApp.
  const pendentesCliente: ItemPendenciaUi[] = posts.flatMap((p) => {
    const t = tarefaDoClienteAgora(tarefas.filter((x) => x.postId === p.id));
    if (!t) return [];
    const v = vistas[p.id];
    return [
      {
        tarefaId: t.id,
        tarefaTitulo: t.titulo,
        postId: p.id,
        postTitulo: p.titulo,
        postData: p.dataPostagem,
        prazo: t.prazo ? t.prazo.slice(0, 10) : null,
        link: `${env.app.url}/post/${p.id}?tarefa=${t.id}`,
        grupo: grupoDaTarefa(t.titulo),
        visto: v ? { ultima: v.ultima, total: v.total } : null,
      },
    ];
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10 lg:max-w-6xl">
      <CalendarioConteudo
        projetoId={projeto.projetoId}
        projetoNome={nome}
        mes={mes}
        linhas={linhas}
        paraImportar={paraImportar}
        hojeIso={hoje}
        pendentesCliente={pendentesCliente}
        gruposWpp={grupos.map((g) => ({ id: g.id, nome: g.nome, apelido: g.apelido?.trim() || null }))}
        textos={textos}
      />
    </main>
  );
}
