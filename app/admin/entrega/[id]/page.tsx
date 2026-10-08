import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import {
  getEntregaCompleta,
  listarTarefasAbertasDosPosts,
  type TarefaDoProjeto,
} from '@/lib/notion';
import { getGruposWhatsappDoProjeto, lerVisualizacoes } from '@/lib/supabase';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { ehTarefaDoCliente, statusRealDoPost } from '@/lib/etapas-projeto';
import { env } from '@/lib/env';
import { EntregaPorCliente, type GrupoEntrega, type TipoEntrega } from './EntregaPorCliente';

export const dynamic = 'force-dynamic';

export default async function EntregaAdminPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    redirect('/');
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-4xl lg:max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink"
          >
            ← Voltar
          </Link>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            entrega
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-8">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-[100px] rounded-2xl bg-bgSoft animate-pulse" />
              <div className="h-[400px] rounded-2xl bg-bgSoft animate-pulse" />
            </div>
          }
        >
          <Conteudo id={params.id} />
        </Suspense>
      </main>
    </div>
  );
}

async function Conteudo({ id }: { id: string }) {
  const entrega = await getEntregaCompleta(id);
  if (!entrega) notFound();

  const tarefas = entrega.tarefasRelacionadas;
  const postIds = [...new Set(tarefas.map((t) => t.postId).filter((x): x is string => !!x))];
  const projetoIds = [...new Set(tarefas.map((t) => t.projetoId).filter((x): x is string => !!x))];

  const [abertasPorPost, vistas, textos, gruposPorProjeto] = await Promise.all([
    listarTarefasAbertasDosPosts(postIds).catch(() => new Map<string, TarefaDoProjeto[]>()),
    lerVisualizacoes(postIds).catch(() => ({}) as Awaited<ReturnType<typeof lerVisualizacoes>>),
    lerMensagensEditadas().catch(() => ({}) as Record<string, string>),
    Promise.all(
      projetoIds.map(async (pid) => [pid, await getGruposWhatsappDoProjeto(pid).catch(() => [])] as const),
    ),
  ]);
  const gruposWpp = new Map(gruposPorProjeto);

  const grupos = new Map<string, GrupoEntrega>();
  for (const t of tarefas) {
    const chave = t.projetoId ?? 'sem-projeto';
    let g = grupos.get(chave);
    if (!g) {
      g = {
        projetoId: t.projetoId ?? '',
        nome: t.clienteNome ?? t.projetoNome ?? 'Sem cliente',
        projetoNome: t.projetoNome ?? '',
        gruposWpp: (gruposWpp.get(t.projetoId ?? '') ?? []).map((w) => ({
          id: w.id,
          nome: w.nome,
          apelido: w.apelido?.trim() || null,
        })),
        itens: [],
      };
      grupos.set(chave, g);
    }
    const abertas = t.postId ? abertasPorPost.get(t.postId) ?? [] : [];
    const base: TarefaDoProjeto = {
      id: t.tarefaId,
      titulo: t.titulo,
      pessoa: null,
      status: t.status,
      prazo: t.prazo ? t.prazo.slice(0, 10) : null,
      postId: t.postId,
      postTitulo: t.postTitulo,
      postData: null,
    };
    const st = statusRealDoPost(abertas.length ? abertas : [base], t.titulo);
    const aprovacao = abertas.find((x) => /aprova[çc][ãa]o\s*\|\s*post/i.test(x.titulo));
    const v = t.postId ? vistas[t.postId] : undefined;
    g.itens.push({
      tarefaId: t.tarefaId,
      titulo: t.titulo,
      prazo: base.prazo,
      pronto: !!t.pronto,
      postId: t.postId,
      postTitulo: t.postTitulo ?? t.titulo,
      relacao: st.relacao,
      rotulo: st.rotulo,
      comCliente: st.comCliente,
      atualTitulo: st.atual?.titulo ?? null,
      atualPrazo: st.atual?.prazo ?? null,
      responsavel: st.atual?.pessoa ?? null,
      aprovacaoTarefaId: aprovacao?.id ?? null,
      prazoCliente: aprovacao?.prazo ?? null,
      visto: v ? { ultima: v.ultima, total: v.total } : null,
    });
  }
  const lista = [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  for (const g of lista) g.itens.sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));

  const tipo: TipoEntrega = /enviar post/i.test(entrega.nome)
    ? 'envio'
    : ehTarefaDoCliente(entrega.nome) || /materia|pr[ée]vi|conte[úu]do/i.test(entrega.nome)
      ? 'cliente'
      : 'interna';

  return (
    <>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">entrega</div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">{entrega.nome}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {entrega.frequencia && (
            <span className="rounded-full bg-bgSoft px-2 py-0.5 text-t2">{entrega.frequencia}</span>
          )}
          {entrega.proximaData && (
            <span className="rounded-full bg-bgSoft px-2 py-0.5 text-t2">
              Próxima: {entrega.proximaData.replace(/^⏳\s*/, '')}
            </span>
          )}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--prazo-em-dia-soft)' }}>
          <div className="text-[24px]">✨</div>
          <div className="mt-2 text-[14px] font-semibold" style={{ color: 'var(--prazo-em-dia)' }}>
            Entrega zerada
          </div>
          <p className="mt-1 text-[12px] text-t2">Nenhuma tarefa em aberto vinculada a essa entrega.</p>
        </div>
      ) : (
        <EntregaPorCliente
          entregaNome={entrega.nome}
          tipo={tipo}
          grupos={lista}
          textos={textos}
          baseUrl={env.app.url}
          hojeIso={hojeEmSaoPaulo()}
        />
      )}
    </>
  );
}
