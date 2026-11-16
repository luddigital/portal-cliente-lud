/**
 * Avisos automáticos de aprovação de post no grupo do WhatsApp do cliente.
 *
 * Pega os posts cuja etapa atual (tarefa "Pronta") é a aprovação do cliente
 * ("Aprovação | Post" ou a reaprovação depois de uma alteração) e decide, pela
 * última mensagem que o portal mandou no grupo sobre aquele post:
 *
 *   nunca mandamos            → mensagem normal de aprovação
 *   menos de 5 horas          → não manda nada
 *   hoje, há 5 horas ou mais  → reforço do dia ("auto_hoje")
 *   ontem / último dia útil   → lembrete do dia seguinte ("auto_ontem")
 *   anteontem ou antes        → para e mostra pra equipe decidir
 *   já teve 2 avisos automáticos depois da última mensagem manual → para e mostra
 *
 * Uma mensagem por grupo e por tipo, com todos os posts juntos.
 * Mensagens SÓ pro grupo do cliente, nunca no privado.
 */
import { env } from '@/lib/env';
import { listAllProjetos, listarTarefasAbertasDeTodos, listarTarefasDoPost, type TarefaDeTodos } from '@/lib/notion';
import { getGruposWhatsappDoProjeto, lerHistoricoDeAvisos, registrarEnvioAvulso } from '@/lib/supabase';
import { enviarMensagemTexto, zapiConfigured } from '@/lib/zapi';
import { montarLembrete, hojeEmSaoPaulo, type EtapaLembrete } from '@/lib/lembrete-aprovacao';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { nomeCurtoDoProjeto } from '@/lib/rotas';

import { decidirAviso, type MotivoParado, type TipoAviso } from '@/lib/aviso-aprovacao-regra';
export { HORAS_MINIMAS, MAX_AUTOS, decidirAviso, type MotivoParado, type TipoAviso } from '@/lib/aviso-aprovacao-regra';

export type PostDoAviso = {
  postId: string;
  tarefaId: string;
  titulo: string;
  prazo: string | null;
  postData: string | null;
  ultimoEnvio: string | null;
  autos: number;
};

export type GrupoDeAviso = {
  chave: string; // projetoId:tipo
  projetoId: string;
  projetoNome: string;
  grupoId: string;
  grupoNome: string;
  tipo: TipoAviso;
  posts: PostDoAviso[];
  mensagem: string;
};

export type PlanoDeAvisos = {
  geradoEm: string;
  enviar: GrupoDeAviso[];
  esperando: (PostDoAviso & { projetoNome: string; liberaEm: string })[];
  /** Post novo pronto antes da data de envio pra aprovação (quinta): só sai nessa data. */
  antesDaData: (PostDoAviso & { projetoNome: string; enviaEm: string })[];
  parados: (PostDoAviso & { projetoNome: string; motivo: MotivoParado })[];
};

const TIPO_ETAPA: Record<TipoAviso, EtapaLembrete> = {
  post: 'post',
  reaprovacao: 'reaprovacao',
  auto_hoje: 'auto_hoje',
  auto_ontem: 'auto_ontem',
};

/** A tarefa é a aprovação do post pelo cliente (não arte, pauta nem materiais). */
export function ehAprovacaoDoCliente(t: Pick<TarefaDeTodos, 'titulo'>): boolean {
  const titulo = t.titulo.trim();
  if (!/^aprova[çc][ãa]o\s*\|/i.test(titulo)) return false;
  return !/\|\s*(arte|pauta|materia)/i.test(titulo);
}

function ehReaprovacao(t: TarefaDeTodos): boolean {
  return t.ordemUm === '03' && !/\|\s*post\s*$/i.test(t.titulo.trim());
}

/**
 * Data em que o post vai pro cliente aprovar: o prazo da tarefa "Enviar Post
 * Aprovação" do post. Sem ela, a quinta-feira antes do prazo da aprovação.
 */
async function dataDeEnvioDoPost(postId: string, prazoAprovacao: string | null): Promise<string | null> {
  const tarefas = await listarTarefasDoPost(postId).catch(() => []);
  const envio = tarefas.find((x) => /enviar\s*post|enviar.*aprova/i.test(x.titulo) && x.prazo);
  if (envio?.prazo) return envio.prazo.slice(0, 10);
  if (!prazoAprovacao) return null;
  let d = prazoAprovacao.slice(0, 10);
  for (let i = 0; i < 7; i++) {
    d = new Date(Date.parse(`${d}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    if (new Date(`${d}T12:00:00Z`).getUTCDay() === 4) return d;
  }
  return null;
}

/** Monta o plano: o que mandar agora, o que espera as 5 horas e o que parou. */
export async function planejarAvisos(agora = new Date()): Promise<PlanoDeAvisos> {
  const tarefas = await listarTarefasAbertasDeTodos();
  // Uma aprovação por post: a tarefa "Pronta" de aprovação do cliente.
  const porPost = new Map<string, TarefaDeTodos>();
  for (const t of tarefas) {
    if (!t.pronto || !t.postId || !t.projetoId || !ehAprovacaoDoCliente(t)) continue;
    if (!porPost.has(t.postId)) porPost.set(t.postId, t);
  }
  const [historico, projetos, textos] = await Promise.all([
    lerHistoricoDeAvisos([...porPost.keys()]),
    listAllProjetos().catch(() => []),
    lerMensagensEditadas().catch(() => ({})),
  ]);
  const nomeProjeto = new Map(projetos.map((p) => [p.id.replace(/-/g, ''), p.nome]));
  const nome = (id: string) => nomeCurtoDoProjeto(nomeProjeto.get(id.replace(/-/g, '')) ?? 'Projeto');

  const plano: PlanoDeAvisos = { geradoEm: agora.toISOString(), enviar: [], esperando: [], antesDaData: [], parados: [] };
  const juntar = new Map<string, { projetoId: string; tipo: TipoAviso; posts: PostDoAviso[] }>();
  const hoje = hojeEmSaoPaulo();

  for (const [postId, t] of porPost) {
    const h = historico.get(postId);
    const item: PostDoAviso = {
      postId,
      tarefaId: t.id,
      titulo: t.postTitulo || t.titulo,
      prazo: t.prazo ?? null,
      postData: t.postData ?? null,
      ultimoEnvio: h?.ultimo ?? null,
      autos: h?.autos ?? 0,
    };
    const d = decidirAviso(h, agora, ehReaprovacao(t));
    if (d.acao === 'esperar') plano.esperando.push({ ...item, projetoNome: nome(t.projetoId!), liberaEm: d.liberaEm });
    else if (d.acao === 'parar') plano.parados.push({ ...item, projetoNome: nome(t.projetoId!), motivo: d.motivo });
    else {
      if (d.tipo === 'post') {
        // Primeiro envio de post novo: só a partir da data de envio pra aprovação (quinta).
        const enviaEm = await dataDeEnvioDoPost(postId, t.prazo ?? null);
        if (enviaEm && hoje < enviaEm) {
          plano.antesDaData.push({ ...item, projetoNome: nome(t.projetoId!), enviaEm });
          continue;
        }
      }
      const chave = `${t.projetoId}:${d.tipo}`;
      const g = juntar.get(chave) ?? { projetoId: t.projetoId!, tipo: d.tipo, posts: [] };
      g.posts.push(item);
      juntar.set(chave, g);
    }
  }

  for (const [chave, g] of juntar) {
    const grupos = await getGruposWhatsappDoProjeto(g.projetoId).catch(() => []);
    const grupo = grupos[0];
    if (!grupo?.id) {
      for (const p of g.posts) plano.parados.push({ ...p, projetoNome: nome(g.projetoId), motivo: 'sem_grupo' });
      continue;
    }
    g.posts.sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
    const link = (p: PostDoAviso) => `${env.app.url}/post/${p.postId}?tarefa=${p.tarefaId}`;
    const primeiro = g.posts[0];
    const { mensagem } = montarLembrete({
      apelido: grupo.apelido?.trim() || nome(g.projetoId),
      tarefaTitulo: 'Aprovação | Post',
      postTitulo: primeiro.titulo,
      prazo: primeiro.prazo,
      postData: primeiro.postData,
      link: link(primeiro),
      textos,
      hoje,
      forcarEtapa: TIPO_ETAPA[g.tipo],
      primeiroEnvio: g.tipo === 'post' || g.tipo === 'reaprovacao',
      posts: g.posts.map((p) => ({ titulo: p.titulo, link: link(p) })),
    });
    plano.enviar.push({
      chave,
      projetoId: g.projetoId,
      projetoNome: nome(g.projetoId),
      grupoId: grupo.id,
      grupoNome: grupo.nome,
      tipo: g.tipo,
      posts: g.posts,
      mensagem,
    });
  }
  plano.enviar.sort((a, b) => a.projetoNome.localeCompare(b.projetoNome, 'pt-BR'));
  return plano;
}

/** Manda um grupo do plano e registra o envio em cada post. */
export async function enviarAviso(g: GrupoDeAviso, quem: string, mensagem?: string): Promise<{ ok: boolean; erro?: string }> {
  if (!zapiConfigured()) return { ok: false, erro: 'WhatsApp (Z-API) não configurado' };
  const texto = mensagem?.trim() || g.mensagem;
  const r = await enviarMensagemTexto(g.grupoId, texto);
  if (!r.ok) return { ok: false, erro: r.erro };
  // Primeiro envio não conta como lembrete; só auto_hoje/auto_ontem contam pro limite.
  const momento = g.tipo === 'post' || g.tipo === 'reaprovacao' ? `envio_auto_${g.tipo}` : g.tipo;
  await registrarEnvioAvulso({
    projetoId: g.projetoId,
    postId: null,
    postIds: g.posts.map((p) => p.postId),
    momento,
    situacao: g.tipo,
    texto,
    grupoId: g.grupoId,
    messageId: r.messageId ?? null,
    email: quem,
  });
  return { ok: true };
}
