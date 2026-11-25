import { SemPiscar as Suspense } from '@/app/_ui/SemPiscar';
import { listAllProjetos, listarTarefasAbertasDeTodos, ultimaConclusaoPorPost, type TarefaDeTodos } from '@/lib/notion';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { compararNoFluxo, ehTarefaDoCliente, ehTarefaModeloDoPost, rotuloDaTarefaAtual } from '@/lib/etapas-projeto';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import { getFotoDoInstagramDoProjeto } from '@/lib/instagram';
import { lerEnviosRecentesDosPosts, lerVisualizacoes, lerVisualizacoesDetalhe, type EnvioDoPost } from '@/lib/supabase';
import { Trilha } from '../_components/Trilha';
import { TarefasNotion, type LinhaTarefa } from './TarefasNotion';

export const dynamic = 'force-dynamic';

const semTraco = (s: string) => s.replace(/-/g, '');

/** Tarefas: igual à "Gestão de Projetos" do Notion, por aba (atrasadas, hoje, amanhã…) e por pessoa. */
export default function TarefasPage({ searchParams }: { searchParams: { pessoa?: string; projeto?: string } }) {
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-6 py-8 lg:max-w-7xl">
      <div className="space-y-2">
        <Trilha itens={[{ rotulo: 'Tarefas' }]} />
        <h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink">Tarefas</h1>
      </div>
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-2xl bg-white/60" />}>
        <Lista pessoa={searchParams.pessoa} projeto={searchParams.projeto} />
      </Suspense>
    </main>
  );
}

async function Lista({ pessoa, projeto }: { pessoa?: string; projeto?: string }) {
  const [tarefas, projetos] = await Promise.all([
    listarTarefasAbertasDeTodos().catch(() => [] as TarefaDeTodos[]),
    listAllProjetos().catch(() => []),
  ]);
  const hoje = hojeEmSaoPaulo();
  const nomeProjeto = new Map(projetos.map((p) => [semTraco(p.id), p.nome]));

  // Como no Notion: só "tipo original = TAREFA" (sem a tarefa-modelo "Post").
  const validas = tarefas.filter(
    (t) =>
      (!t.tipoOriginal || t.tipoOriginal === 'TAREFA') &&
      !ehTarefaModeloDoPost(t) &&
      (!projeto || (!!t.projetoId && semTraco(t.projetoId) === semTraco(projeto))),
  );

  // Etapa do post (o "Status Post" do Notion): a tarefa aberta mais cedo na ordem.
  const porPost = new Map<string, TarefaDeTodos[]>();
  for (const t of validas) if (t.postId) porPost.set(t.postId, [...(porPost.get(t.postId) ?? []), t]);
  const etapa = new Map<string, string>();
  const atualDoPost = new Map<string, TarefaDeTodos>();
  for (const [pid, ls] of porPost) {
    const atual = [...ls].sort(compararNoFluxo)[0];
    if (atual) {
      etapa.set(pid, rotuloDaTarefaAtual(atual.titulo, atual.prazo, hoje));
      atualDoPost.set(pid, atual);
    }
  }

  // Tarefas com o cliente: o que já foi mandado no grupo de WhatsApp e se ele abriu o post.
  const idsCliente = [...new Set(validas.filter((t) => t.postId && ehTarefaDoCliente(t.titulo)).map((t) => t.postId as string))];
  const [envios, vistas] = await Promise.all([
    lerEnviosRecentesDosPosts(idsCliente, 45).catch(() => ({}) as Record<string, EnvioDoPost[]>),
    lerVisualizacoes(idsCliente).catch(() => ({}) as Awaited<ReturnType<typeof lerVisualizacoes>>),
  ]);
  const [vistasDetalhe, mudouEm] = await Promise.all([
    lerVisualizacoesDetalhe(idsCliente).catch(() => ({}) as Record<string, string[]>),
    ultimaConclusaoPorPost(10).catch(() => ({}) as Record<string, string>),
  ]);
  // Rodada atual: envio ou visualização de antes da última etapa concluída no post é da versão anterior.
  const daRodada = (postId: string, quando: string) => {
    const m = mudouEm[postId.replace(/-/g, '')];
    return !m || Date.parse(quando) >= Date.parse(m);
  };
  const assunto = (titulo: string) =>
    /aprova|enviar post/i.test(titulo) ? 'aprovacao' : /materia|pr[ée]vi|conte[úu]do|voice|informa/i.test(titulo) ? 'materiais' : null;
  const menos10 = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - 10 * 86_400_000).toISOString().slice(0, 10);
  const wppDa = (t: TarefaDeTodos) => {
    if (!t.postId || !ehTarefaDoCliente(t.titulo)) return null;
    const a = assunto(t.titulo);
    const ms = (envios[t.postId] ?? []).filter(
      (m) => (!t.prazo || m.enviadoEm.slice(0, 10) >= menos10(t.prazo)) && daRodada(t.postId!, m.enviadoEm) && (!a || !m.assunto || m.assunto === a),
    );
    const ultimo = ms.map((m) => m.enviadoEm).sort().pop() ?? null;
    return { n: ms.length, ultimo };
  };
  /** Linha do tempo do sinal: envios no grupo e visualizações do cliente, na ordem em que aconteceram. */
  const tempoDa = (t: TarefaDeTodos) => {
    if (!t.postId || !ehTarefaDoCliente(t.titulo)) return [];
    const a = assunto(t.titulo);
    const desde = t.prazo ? menos10(t.prazo) : '';
    const ev = [
      ...(envios[t.postId] ?? [])
        .filter((m) => (!desde || m.enviadoEm.slice(0, 10) >= desde) && daRodada(t.postId!, m.enviadoEm) && (!a || !m.assunto || m.assunto === a))
        .map((m) => ({ q: m.enviadoEm, t: 'envio' as const, m: m.momento })),
      ...(/aprova/i.test(t.titulo) ? (vistasDetalhe[t.postId] ?? []).filter((v) => (!desde || v.slice(0, 10) >= desde) && daRodada(t.postId!, v)) : []).map((v) => ({ q: v, t: 'visto' as const, m: '' })),
    ].sort((x, y) => Date.parse(x.q) - Date.parse(y.q));
    return ev.slice(-10);
  };

  // Foto do Instagram de cada projeto (a coluna Projeto mostra só o avatar).
  const idsProjeto = [...new Set(validas.map((t) => t.projetoId).filter((x): x is string => !!x))];
  const fotos = new Map(
    await Promise.all(
      idsProjeto.map(async (id) => [id, await getFotoDoInstagramDoProjeto(id, nomeProjeto.get(semTraco(id)) ?? '').catch(() => null)] as const),
    ),
  );

  const linhas: LinhaTarefa[] = validas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    pessoa: t.pessoa,
    pessoaAvatar: t.pessoaAvatar ?? null,
    prazo: t.prazo,
    status: t.status,
    pronto: !!t.pronto,
    // Posição no fluxo do post (Ordem → Ordem (1)), pra ordenar por status.
    etapaIdx: (Number(t.ordem) || 99) * 100 + (Number(t.ordemUm) || 1),
    postId: t.postId,
    postTitulo: t.postTitulo,
    projetoId: t.projetoId,
    projeto: t.projetoId ? nomeCurtoDoProjeto(nomeProjeto.get(semTraco(t.projetoId)) ?? '') || null : null,
    etapaPost: t.postId ? etapa.get(t.postId) ?? null : null,
    projetoFoto: t.projetoId ? fotos.get(t.projetoId) ?? null : null,
    doCliente: ehTarefaDoCliente(t.titulo),
    wpp: wppDa(t),
    tempo: tempoDa(t),
    // Bloqueada: o post ainda está numa etapa anterior (quem segura e até quando).
    antes: (() => {
      if (t.pronto || !t.postId) return null;
      const a = atualDoPost.get(t.postId);
      return a && a.id !== t.id ? { titulo: a.titulo, pessoa: a.pessoa, avatar: a.pessoaAvatar ?? null, prazo: a.prazo } : null;
    })(),
    visto: (() => {
      if (!t.postId || !ehTarefaDoCliente(t.titulo) || !/aprova/i.test(t.titulo)) return null;
      const u = vistas[t.postId]?.ultima ?? null;
      return u && daRodada(t.postId, u) ? u : null;
    })(),
  }));

  return <TarefasNotion tarefas={linhas} hoje={hoje} pessoaInicial={pessoa} />;
}
