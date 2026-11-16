import PostDetalhePage from '@/app/post/[id]/page';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTarefaDetalhe, listColaboradores, listarTarefasDoPost } from '@/lib/notion';
import { lerHistoricoPrazos } from '@/lib/supabase';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { ehTarefaDoCliente } from '@/lib/etapas-projeto';
import { nomeCurtoDoProjeto, rotas } from '@/lib/rotas';
import { ChipData } from '@/app/_components/ChipData';
import { Trilha, type ItemTrilha } from '../../_components/Trilha';
import { TodasTarefasCard } from '@/app/post/[id]/PostSidebarLud';
import { AcoesDaTarefa } from './AcoesDaTarefa';

export const dynamic = 'force-dynamic';

function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Projetos › projeto › entrega › tarefa: UMA tarefa, com o que dá pra fazer
 * nela (concluir, prazo) e o caminho de volta pra entrega, o projeto e o post.
 */
export default async function TarefaPage({ params }: { params: { id: string } }) {
  const t = await getTarefaDetalhe(params.id);
  if (!t) notFound();
  // Tarefa de um post: mesma página do post (Visão Lud.), com essa tarefa em foco.
  if (t.postId) {
    return <PostDetalhePage params={{ id: t.postId }} searchParams={{ tarefa: params.id, vista: 'interno', voltar: rotas.tarefas() }} />;
  }

  const [tarefasDoPost, historico, colaboradores] = await Promise.all([
    t.postId ? listarTarefasDoPost(t.postId).catch(() => []) : Promise.resolve([]),
    t.postId ? lerHistoricoPrazos(t.postId).catch(() => []) : Promise.resolve([]),
    listColaboradores().catch(() => []),
  ]);
  const colaboradorPorPessoa: Record<string, string> = {};
  for (const c of colaboradores) if (c.pessoaUserId) colaboradorPorPessoa[c.pessoaUserId] = c.id;
  const colaboradorId = t.pessoa?.id ? colaboradorPorPessoa[t.pessoa.id] ?? null : null;

  const hoje = hojeEmSaoPaulo();
  const comCliente = ehTarefaDoCliente(t.titulo);
  const projeto = t.projetoId ? nomeCurtoDoProjeto(t.projetoNome) : null;

  const trilha: ItemTrilha[] = t.projetoId
    ? [
        { rotulo: 'Projetos', href: rotas.projetos() },
        { rotulo: projeto!, href: rotas.projeto(t.projetoId) },
        t.entregaId
          ? { rotulo: t.entregaNome ?? 'Entrega', href: rotas.entregaDoProjeto(t.projetoId, t.entregaId) }
          : { rotulo: 'Tarefas', href: rotas.tarefas() },
        { rotulo: t.postTitulo ? `“${t.postTitulo}”` : t.titulo },
      ]
    : [{ rotulo: 'Tarefas', href: rotas.tarefas() }, { rotulo: t.titulo }];

  const atrasada = t.aberta && t.prazo && t.prazo < hoje;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8 lg:max-w-6xl">
      <Trilha itens={trilha} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <span className="text-[13px] font-semibold text-t2">
            Tarefa · {comCliente ? 'com o cliente' : 'com a Lud.'}
            {t.status ? ` · ${t.status}` : ''}
          </span>
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">{t.titulo}</h1>
          {t.postTitulo && (
            <p className="text-[15px] text-t2">
              do post <span className="font-semibold italic text-ink">“{t.postTitulo}”</span>
              {t.postData ? ` · vai ao ar ${ddmm(t.postData)}` : ''}
            </p>
          )}
        </div>
        <AcoesDaTarefa tarefaId={t.id} aberta={t.aberta} prazo={t.prazo} postId={t.postId} />
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <div
          className="flex flex-col gap-1.5 rounded-[18px] p-[18px]"
          style={{ background: atrasada ? 'var(--prazo-atrasado)' : '#FFFFFF', color: atrasada ? '#FFFFFF' : undefined }}
        >
          <span className={`text-[12px] font-bold uppercase tracking-[0.05em] ${atrasada ? 'text-white/80' : 'text-t2'}`}>Prazo</span>
          {t.prazo ? (
            atrasada ? (
              <span className="text-[26px] font-extrabold tracking-[-0.02em]">venceu {ddmm(t.prazo)}</span>
            ) : (
              <span className="pt-1">
                <ChipData prazo={t.prazo} hoje={hoje} />
              </span>
            )
          ) : (
            <span className="text-[20px] font-bold text-t3">sem data</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-white p-[18px]">
          <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-t2">Responsável</span>
          {t.pessoa ? (
            colaboradorId ? (
              <Link href={`/admin/equipe/${colaboradorId}`} className="text-[20px] font-bold text-ink hover:underline">
                {t.pessoa.nome}
              </Link>
            ) : (
              <span className="text-[20px] font-bold text-ink">{t.pessoa.nome}</span>
            )
          ) : (
            <span className="text-[20px] font-bold text-t3">ninguém</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-white p-[18px]">
          <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-t2">Faz parte de</span>
          <div className="flex flex-col gap-1 text-[14px]">
            {t.projetoId && (
              <Link href={rotas.projeto(t.projetoId)} className="font-semibold text-ink hover:underline">
                Projeto {projeto} ›
              </Link>
            )}
            {t.entregaId && t.projetoId && (
              <Link href={rotas.entregaDoProjeto(t.projetoId, t.entregaId)} className="font-semibold text-ink hover:underline">
                Entrega {t.entregaNome} ›
              </Link>
            )}
            {t.entregaId && (
              <Link href={rotas.entrega(t.entregaId)} className="text-t2 hover:text-ink hover:underline">
                {t.entregaNome} de todos os clientes ›
              </Link>
            )}
            {t.notionUrl && (
              <a href={t.notionUrl} target="_blank" rel="noreferrer" className="text-t2 hover:text-ink hover:underline">
                Abrir no Notion ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {tarefasDoPost.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[16px] font-bold text-ink">Todas as tarefas desse post</h2>
          <TodasTarefasCard
            tarefas={tarefasDoPost}
            colaboradores={colaboradorPorPessoa}
            historico={historico}
            podeEditarPrazo
            linkAdmin
          />
        </section>
      )}
    </main>
  );
}
