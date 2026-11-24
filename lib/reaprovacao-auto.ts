/**
 * Reaprovação automática no grupo do WhatsApp.
 *
 * Quando um post sai da alteração e volta pra aprovação do cliente (tarefa de
 * aprovação com Ordem (1) = 03), o portal manda sozinho a mensagem de reaprovação
 * no GRUPO do cliente (nunca no privado). A leva de quinta (primeira aprovação)
 * não passa por aqui.
 *
 * Regras:
 *  - espera 30 min depois da última etapa concluída do post, pra juntar os posts
 *    do mesmo cliente que saírem da alteração nesse tempo numa mensagem só;
 *  - só manda se nada foi enviado sobre o post depois dessa última etapa;
 *  - cada mensagem dá 1 dia de prazo: a aprovação passa a vencer amanhã;
 *  - a tarefa "Enviar Post Aprovação" reaberta pelo ciclo de alteração é concluída.
 */
import { env } from '@/lib/env';
import { compararNoFluxo } from '@/lib/etapas-projeto';
import {
  atualizarPrazoTarefa,
  concluirTarefa,
  invalidarCachesAposMudanca,
  listAllProjetos,
  listarTarefasAbertasDeTodos,
  listarTarefasDoPost,
  type TarefaDoPost,
} from '@/lib/notion';
import { getGruposWhatsappDoProjeto, lerEnviosRecentesDosPosts, supabaseAdmin } from '@/lib/supabase';
import { enviarMensagemTexto, zapiConfigured } from '@/lib/zapi';
import { hojeEmSaoPaulo, montarLembrete, somarDias } from '@/lib/lembrete-aprovacao';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { nomeCurtoDoProjeto } from '@/lib/rotas';

export const ESPERA_MIN = 30;

const ehAprovacaoPost = (titulo: string) => /^aprova[çc][ãa]o\s*\|\s*post/i.test(titulo.trim());
const ehEnviarPost = (titulo: string) => /enviar\s*post|enviar.*aprova/i.test(titulo);

type Candidato = {
  postId: string;
  projetoId: string;
  titulo: string;
  postData: string | null;
  aprovacao: TarefaDoPost;
  enviarPost: TarefaDoPost | null;
  mudouEm: string;
};

export type ResultadoReaprovacao = {
  enviados: { projeto: string; posts: string[] }[];
  esperando: { projeto: string; post: string; liberaEm: string }[];
  erros: string[];
};

export async function rodarReaprovacaoAutomatica(opts: { enviar: boolean; agora?: Date }): Promise<ResultadoReaprovacao> {
  const agora = opts.agora ?? new Date();
  const res: ResultadoReaprovacao = { enviados: [], esperando: [], erros: [] };

  // 1) Posts com a aprovação do cliente aberta numa rodada de reaprovação.
  const abertas = await listarTarefasAbertasDeTodos();
  const posts = new Map<string, { projetoId: string; titulo: string; postData: string | null }>();
  for (const t of abertas) {
    if (!t.postId || !t.projetoId || t.ordemUm !== '03' || !ehAprovacaoPost(t.titulo)) continue;
    posts.set(t.postId, { projetoId: t.projetoId, titulo: t.postTitulo || t.titulo, postData: (t as any).postData ?? null });
  }
  if (!posts.size) return res;

  const envios = await lerEnviosRecentesDosPosts([...posts.keys()], 30).catch(() => ({}) as Record<string, { enviadoEm: string }[]>);

  // 2) Pra cada post: a etapa atual tem que ser a aprovação (ou o "Enviar Post" antes dela).
  const candidatos: Candidato[] = [];
  for (const [postId, p] of posts) {
    const tarefas = await listarTarefasDoPost(postId).catch(() => [] as TarefaDoPost[]);
    const abertasDoPost = tarefas.filter((x) => x.aberta).sort((a, b) => compararNoFluxo(a as any, b as any));
    const atual = abertasDoPost[0];
    if (!atual) continue;
    const aprovacao = abertasDoPost.find((x) => x.ordemUm === '03' && ehAprovacaoPost(x.titulo));
    if (!aprovacao) continue;
    if (atual.tarefaId !== aprovacao.tarefaId && !ehEnviarPost(atual.titulo)) continue; // ainda em alteração
    const mudouEm = tarefas
      .map((x) => x.finalizadaEm)
      .filter((x): x is string => !!x && !Number.isNaN(Date.parse(x)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    if (!mudouEm) continue;
    // Já mandamos algo depois da última mudança? Então essa rodada já foi.
    if ((envios[postId] ?? []).some((m) => Date.parse(m.enviadoEm) >= Date.parse(mudouEm))) continue;
    candidatos.push({
      postId,
      projetoId: p.projetoId,
      titulo: p.titulo,
      postData: p.postData,
      aprovacao,
      enviarPost: ehEnviarPost(atual.titulo) ? atual : null,
      mudouEm,
    });
  }
  if (!candidatos.length) return res;

  const projetos = await listAllProjetos().catch(() => []);
  const nomeProjeto = new Map(projetos.map((p) => [p.id.replace(/-/g, ''), p.nome]));
  const nome = (id: string) => nomeCurtoDoProjeto(nomeProjeto.get(id.replace(/-/g, '')) ?? 'Projeto');
  const textos = await lerMensagensEditadas().catch(() => ({}));
  const hoje = hojeEmSaoPaulo();
  const amanha = somarDias(hoje, 1);

  // 3) Junta por cliente. Se algum post do cliente mudou há menos de 30 min, espera ele.
  const porProjeto = new Map<string, Candidato[]>();
  for (const c of candidatos) porProjeto.set(c.projetoId, [...(porProjeto.get(c.projetoId) ?? []), c]);

  for (const [projetoId, lista] of porProjeto) {
    const maisRecente = Math.max(...lista.map((c) => Date.parse(c.mudouEm)));
    const liberaEm = maisRecente + ESPERA_MIN * 60_000;
    if (agora.getTime() < liberaEm) {
      for (const c of lista) res.esperando.push({ projeto: nome(projetoId), post: c.titulo, liberaEm: new Date(liberaEm).toISOString() });
      continue;
    }
    const grupos = await getGruposWhatsappDoProjeto(projetoId).catch(() => []);
    const grupo = grupos[0];
    if (!grupo?.id) {
      res.erros.push(`${nome(projetoId)}: sem grupo do WhatsApp`);
      continue;
    }
    const link = (c: Candidato) => `${env.app.url}/post/${c.postId}?tarefa=${c.aprovacao.tarefaId}`;
    const primeiro = lista[0];
    const { mensagem } = montarLembrete({
      apelido: grupo.apelido?.trim() || nome(projetoId),
      tarefaTitulo: 'Aprovação | Post',
      postTitulo: primeiro.titulo,
      prazo: amanha,
      postData: primeiro.postData,
      link: link(primeiro),
      textos,
      hoje,
      forcarEtapa: 'reaprovacao',
      primeiroEnvio: true,
      posts: lista.map((c) => ({ titulo: c.titulo, link: link(c) })),
    });
    if (!opts.enviar) {
      res.enviados.push({ projeto: `${nome(projetoId)} (prévia)`, posts: lista.map((c) => c.titulo) });
      continue;
    }
    if (!zapiConfigured()) {
      res.erros.push('WhatsApp (Z-API) não configurado');
      break;
    }

    // Registra ANTES de mandar: se o registro falhar, não manda (evita mandar de novo a cada rodada).
    const sb = await supabaseAdmin();
    const { data: reg, error } = await sb
      .from('regua_envios')
      .insert({
        projeto_id: projetoId,
        ciclo: null,
        momento: 'reaprovacao',
        variante: 'auto',
        texto: mensagem,
        post_ids: lista.map((c) => c.postId),
        grupo_id: grupo.id,
        message_id: null,
        enviado_por: 'reaprovacao automatica',
      })
      .select('id')
      .single();
    if (error || !reg) {
      res.erros.push(`${nome(projetoId)}: não consegui registrar o envio (${error?.message ?? 'sem id'}), não mandei`);
      continue;
    }
    const r = await enviarMensagemTexto(grupo.id, mensagem);
    if (!r.ok) {
      await sb.from('regua_envios').delete().eq('id', reg.id);
      res.erros.push(`${nome(projetoId)}: falhou no WhatsApp (${r.erro})`);
      continue;
    }
    if (r.messageId) await sb.from('regua_envios').update({ message_id: r.messageId }).eq('id', reg.id);

    // Prazo de 1 dia e "Enviar Post Aprovação" concluída.
    for (const c of lista) {
      await atualizarPrazoTarefa(c.aprovacao.tarefaId, amanha).catch((e) => res.erros.push(`${c.titulo}: prazo (${e?.message})`));
      if (c.enviarPost) await concluirTarefa(c.enviarPost.tarefaId).catch((e) => res.erros.push(`${c.titulo}: concluir envio (${e?.message})`));
    }
    res.enviados.push({ projeto: nome(projetoId), posts: lista.map((c) => c.titulo) });
  }
  if (opts.enviar && res.enviados.length) {
    try {
      invalidarCachesAposMudanca();
    } catch {}
  }
  return res;
}
