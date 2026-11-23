import {
  getEntregaCompleta,
  getEntregaLonga,
  getEntregaDoProjeto,
  listarTarefasAbertasDosPosts,
  proximaDataDaEntrega,
  type EntregaDetalhe,
  type TarefaDaEntrega,
  type TarefaDoProjeto,
} from '@/lib/notion';
import {
  getGruposWhatsappDoProjeto,
  lerEnviosParaAprovacao,
  lerEnviosRecentesDosPosts,
  lerVisualizacoes,
  type EnvioDoPost,
} from '@/lib/supabase';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { ENTREGA_APROVACOES, entregaDaAprovacao, recebeReaprovacoes } from '@/lib/entregasAprovacao';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { ehTarefaDoCliente, statusRealDoPost } from '@/lib/etapas-projeto';
import type { GrupoEntrega, TipoEntrega } from '@/app/admin/entrega/[id]/EntregaPorCliente';

/**
 * Dados de uma entrega pras duas páginas dela: a geral (/admin/entregas/[id],
 * todos os clientes) e a do projeto (/admin/projetos/[id]/entregas/[entregaId]).
 * Um grupo por projeto, com o status real de cada post.
 */
export type DadosDaEntrega = {
  entrega: EntregaDetalhe;
  grupos: GrupoEntrega[];
  tipo: TipoEntrega;
  textos: Record<string, string>;
  hojeIso: string;
  proximaEntrega: string | null;
};

export const semTraco = (s: string) => s.replace(/-/g, '');

export function tipoDaEntrega(nome: string): TipoEntrega {
  return /enviar post/i.test(nome)
    ? 'envio'
    : ehTarefaDoCliente(nome) || /materia|pr[ée]vi|conte[úu]do/i.test(nome)
      ? 'cliente'
      : 'interna';
}

/** Assunto das mensagens que contam como envio nessa entrega. */
function assuntoDe(nomeEntrega: string): 'aprovacao' | 'materiais' | null {
  if (/aprova|enviar post/i.test(nomeEntrega)) return 'aprovacao';
  if (/materia|pr[ée]vi|conte[úu]do|voice|informa/i.test(nomeEntrega)) return 'materiais';
  return null;
}

/**
 * Reaprovação conta do "Fizemos os ajustes…" pra frente: as mensagens da 1ª
 * rodada não são envio dessa. Sem essa mensagem ainda, nada foi enviado.
 */
function mensagensDaRodada(msgs: EnvioDoPost[], reaprovacao: boolean): EnvioDoPost[] {
  if (!reaprovacao) return msgs;
  // msgs vem da mais recente pra mais antiga: corta na reaprovação mais antiga.
  let corte = -1;
  msgs.forEach((m, i) => {
    if (m.reaprovacao) corte = i;
  });
  return corte >= 0 ? msgs.slice(0, corte + 1) : [];
}

export async function carregarEntrega(id: string, projetoId?: string, opts?: { longo?: boolean }): Promise<DadosDaEntrega | null> {
  // Na página do projeto, lê do Notion só as tarefas dele (não as de todos os clientes).
  // `longo`: página da entrega, com tudo em aberto até 90 dias (o resto usa a janela curta, mais leve).
  const ler = (eid: string) =>
    opts?.longo ? getEntregaLonga(eid, projetoId) : projetoId ? getEntregaDoProjeto(eid, projetoId) : getEntregaCompleta(eid);
  const [entrega, aprovacoes] = await Promise.all([
    ler(id),
    // As reaprovações estão ligadas a "Aprovações" no Notion: entram aqui as dessa etapa.
    recebeReaprovacoes(id) ? ler(ENTREGA_APROVACOES).catch(() => null) : Promise.resolve(null),
  ]);
  if (!entrega) return null;
  if (aprovacoes) {
    const ja = new Set(entrega.tarefasRelacionadas.map((t) => t.tarefaId));
    const destaEtapa = aprovacoes.tarefasRelacionadas.filter(
      (t) => !ja.has(t.tarefaId) && entregaDaAprovacao(t.titulo)?.replace(/-/g, '') === id.replace(/-/g, ''),
    );
    entrega.tarefasRelacionadas = [...entrega.tarefasRelacionadas, ...destaEtapa];
  }

  // Um post por entrega: quando o cliente pede alteração, a "Aprovação | Post"
  // antiga fica Reprovado e nasce outra. Fica a aberta; se todas fecharam, a mais recente.
  const fechada = (s: string | null) => ['Concluído', 'Cancelado', 'Reprovado', 'Excluída'].includes(s ?? '');
  const porPost = new Map<string, TarefaDaEntrega>();
  const semPost: TarefaDaEntrega[] = [];
  for (const t of entrega.tarefasRelacionadas) {
    if (!t.postId) {
      semPost.push(t);
      continue;
    }
    const atual = porPost.get(t.postId);
    const ganha =
      !atual ||
      (fechada(atual.status) !== fechada(t.status)
        ? !fechada(t.status)
        : (t.prazo ?? '') > (atual.prazo ?? ''));
    if (ganha) porPost.set(t.postId, t);
  }
  const tarefas = [...porPost.values(), ...semPost];
  // Quantas vezes essa etapa já voltou pra alteração no post (aprovações reprovadas).
  const reprovadasPorPost = new Map<string, number>();
  for (const t of entrega.tarefasRelacionadas) {
    if (t.postId && t.status === 'Reprovado') {
      reprovadasPorPost.set(t.postId, (reprovadasPorPost.get(t.postId) ?? 0) + 1);
    }
  }
  const postIds = [...new Set(tarefas.map((t) => t.postId).filter((x): x is string => !!x))];
  const projetoIds = [...new Set(tarefas.map((t) => t.projetoId).filter((x): x is string => !!x))];

  const [abertasPorPost, vistas, textos, gruposPorProjeto, enviosPortal, mensagensPorPost] = await Promise.all([
    listarTarefasAbertasDosPosts(postIds).catch(() => new Map<string, TarefaDoProjeto[]>()),
    lerVisualizacoes(postIds).catch(() => ({}) as Awaited<ReturnType<typeof lerVisualizacoes>>),
    lerMensagensEditadas().catch(() => ({}) as Record<string, string>),
    Promise.all(
      projetoIds.map(async (pid) => [pid, await getGruposWhatsappDoProjeto(pid).catch(() => [])] as const),
    ),
    lerEnviosParaAprovacao(postIds).catch(() => ({}) as Record<string, string>),
    lerEnviosRecentesDosPosts(postIds).catch(
      () => ({}) as Record<string, EnvioDoPost[]>,
    ),
  ]);
  const gruposWpp = new Map(gruposPorProjeto);

  const assuntoDaEntrega = assuntoDe(entrega.nome);
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
    const reaprovacao = t.ordemUm === '03' || (t.postId ? (reprovadasPorPost.get(t.postId) ?? 0) > 0 : false);
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
    // Post sem nenhuma tarefa aberta = concluído (não volta a tarefa fechada da entrega).
    const st = statusRealDoPost(abertas.length || t.postId || fechada(t.status) ? abertas : [base], t.titulo);
    const aprovacao = abertas.find((x) => /aprova[çc][ãa]o\s*\|\s*post/i.test(x.titulo));
    const v = t.postId ? vistas[t.postId] : undefined;
    g.itens.push({
      tarefaId: t.tarefaId,
      titulo: t.titulo,
      prazo: base.prazo,
      pronto: !!t.pronto,
      postId: t.postId,
      // Sem o título do post (o Notion falhou ao ler o post), usa o das tarefas abertas dele.
      postTitulo: t.postTitulo ?? abertas.find((a) => a.postTitulo)?.postTitulo ?? t.titulo,
      postData: t.postData ?? null,
      pessoa: t.pessoa ?? null,
      relacao: st.relacao,
      rotulo: st.rotulo,
      comCliente: st.comCliente,
      atualTitulo: st.atual?.titulo ?? null,
      atualPrazo: st.atual?.prazo ?? null,
      responsavel: st.atual?.pessoa ?? null,
      responsavelAvatar: st.atual?.pessoaAvatar ?? null,
      atualTarefaId: st.atual?.id ?? null,
      aprovacaoTarefaId: aprovacao?.id ?? null,
      prazoCliente: aprovacao?.prazo ?? null,
      visto: v ? { ultima: v.ultima, total: v.total } : null,
      // Feito nessa entrega: tarefa concluída ou o post já passou dessa etapa.
      enviado: (t.status === 'Concluído' && st.relacao !== 'antes') || st.relacao === 'depois' || st.relacao === 'concluido',
      // Mensagens de WhatsApp sobre o post nesse ciclo (desde 10 dias antes do prazo).
      mensagens: mensagensDaRodada(
        (t.postId ? mensagensPorPost[t.postId] ?? [] : []).filter(
          (m) =>
            (!base.prazo || m.enviadoEm.slice(0, 10) >= somarDiasIso(base.prazo, -10)) &&
            // Só as do assunto dessa entrega (a cobrança de voice não conta como envio pra aprovação).
            (!assuntoDaEntrega || !m.assunto || m.assunto === assuntoDaEntrega),
        ),
        reaprovacao,
      ),
      // Reaprovação = aprovação nova depois de uma alteração (Ordem (1) = 03 no Notion).
      reaprovacao,
      rodada: Math.max(t.postId ? (reprovadasPorPost.get(t.postId) ?? 0) + 1 : 1, t.ordemUm === '03' ? 2 : 1),
      // Horário exato do envio pelo portal; senão, o "Finalizada em" do Notion (com hora, quando tem).
      enviadoEm: (t.postId && enviosPortal[t.postId]) || t.finalizada || null,
    });
  }
  const lista = [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  for (const g of lista) g.itens.sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));

  const hojeIso = hojeEmSaoPaulo();
  return {
    entrega,
    grupos: lista,
    tipo: tipoDaEntrega(entrega.nome),
    textos,
    hojeIso,
    proximaEntrega: proximaDataDaEntrega(entrega, hojeIso),
  };
}

function somarDiasIso(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
