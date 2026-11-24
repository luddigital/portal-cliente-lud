/**
 * Resumo do fim da tarde (16h, seg a sex): uma mensagem por cliente, no GRUPO,
 * com os posts que ainda estão com ele pra aprovar.
 *
 *  - entra só post que o cliente já recebeu nessa rodada (houve mensagem depois da última mudança);
 *  - sai o post que já teve mensagem do portal hoje (reaprovação automática, lembrete…);
 *  - sai o post que a Luiza tirou do resumo na revisão da manhã;
 *  - marca "ainda não abriu" quando o cliente não viu a versão atual.
 */
import { env } from '@/lib/env';
import { ehAprovacaoDoCliente } from '@/lib/aviso-aprovacao';
import { listAllProjetos, listarTarefasAbertasDeTodos, ultimaConclusaoPorPost } from '@/lib/notion';
import { getGruposWhatsappDoProjeto, lerEnviosRecentesDosPosts, lerVisualizacoesDetalhe, registrarEnvioAvulso, supabaseAdmin } from '@/lib/supabase';
import { enviarMensagemTexto, zapiConfigured } from '@/lib/zapi';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { lerMensagensEditadas } from '@/lib/mensagens-padrao';
import { nomeCurtoDoProjeto } from '@/lib/rotas';

export type PostDoResumo = {
  postId: string;
  tarefaId: string;
  titulo: string;
  prazo: string | null;
  abriu: boolean;
  fora: boolean;
  motivoFora?: string;
};
export type ResumoDoCliente = { projetoId: string; projetoNome: string; grupoId: string | null; grupoNome: string | null; posts: PostDoResumo[]; mensagem: string };

const sem = (id: string) => id.replace(/-/g, '');
const diaSp = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const diaCurto = (d: string) => `${SEM[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;

// "Tirar do resumo de hoje" fica guardado em mensagens_padrao (chave por dia), sem tabela nova.
const chaveFora = (dia: string) => `resumo_fora:${dia}`;
export async function lerForaDoResumo(dia = hojeEmSaoPaulo()): Promise<Set<string>> {
  const sb = await supabaseAdmin();
  const { data } = await sb.from('mensagens_padrao').select('texto').eq('chave', chaveFora(dia)).maybeSingle();
  try {
    return new Set((JSON.parse((data as any)?.texto ?? '[]') as string[]).map(sem));
  } catch {
    return new Set();
  }
}
export async function marcarForaDoResumo(postId: string, fora: boolean, dia = hojeEmSaoPaulo()): Promise<void> {
  const atual = await lerForaDoResumo(dia);
  if (fora) atual.add(sem(postId));
  else atual.delete(sem(postId));
  const sb = await supabaseAdmin();
  const { error } = await sb.from('mensagens_padrao').upsert({ chave: chaveFora(dia), texto: JSON.stringify([...atual]) });
  if (error) throw new Error(error.message);
}

function montarMensagem(apelido: string, posts: PostDoResumo[], textos: Record<string, string>, hoje: string): string {
  const saud = (textos['lembrete.saudacao'] ?? 'Oie, {apelido}! Tudo bem? 😊').replace(/\{apelido\}/g, apelido);
  const fech = textos['lembrete.fechamento'] ?? 'Qualquer dúvida, pode me chamar! 💜';
  const um = posts.length === 1;
  const abertura = um ? 'Passando pra lembrar do post que ainda está com você pra aprovar:' : 'Passando pra lembrar dos posts que ainda estão com você pra aprovar:';
  const linha = (p: PostDoResumo) => {
    const prazo = !p.prazo ? '' : p.prazo.slice(0, 10) < hoje ? `prazo era ${diaCurto(p.prazo.slice(0, 10))}` : p.prazo.slice(0, 10) === hoje ? 'prazo termina hoje' : `prazo até ${diaCurto(p.prazo.slice(0, 10))}`;
    const info = [prazo, p.abriu ? '' : 'você ainda não abriu'].filter(Boolean).join(' · ');
    return [`*${p.titulo}*`, info, `${env.app.url}/post/${p.postId}?tarefa=${p.tarefaId}`].filter(Boolean).join('\n');
  };
  return [saud, abertura, ...posts.map(linha), fech].join('\n\n');
}

export async function planejarResumo(): Promise<ResumoDoCliente[]> {
  const hoje = hojeEmSaoPaulo();
  const tarefas = await listarTarefasAbertasDeTodos();
  const porPost = new Map<string, (typeof tarefas)[number]>();
  for (const t of tarefas) {
    if (!t.pronto || !t.postId || !t.projetoId || !ehAprovacaoDoCliente(t)) continue;
    if (!porPost.has(t.postId)) porPost.set(t.postId, t);
  }
  const ids = [...porPost.keys()];
  const [envios, vistas, mudouEm, fora, projetos, textos] = await Promise.all([
    lerEnviosRecentesDosPosts(ids, 30),
    lerVisualizacoesDetalhe(ids).catch(() => ({}) as Record<string, string[]>),
    ultimaConclusaoPorPost(10).catch(() => ({}) as Record<string, string>),
    lerForaDoResumo(hoje).catch(() => new Set<string>()),
    listAllProjetos().catch(() => []),
    lerMensagensEditadas().catch(() => ({}) as Record<string, string>),
  ]);
  const nomeProjeto = new Map(projetos.map((p) => [sem(p.id), p.nome]));

  const porProjeto = new Map<string, PostDoResumo[]>();
  for (const [postId, t] of porPost) {
    const inicio = mudouEm[sem(postId)] ?? null;
    const daRodada = (q: string) => !inicio || Date.parse(q) >= Date.parse(inicio);
    const msgs = (envios[postId] ?? []).filter((m) => daRodada(m.enviadoEm));
    if (!msgs.length) continue; // cliente ainda não recebeu essa versão: não cobra
    const p: PostDoResumo = {
      postId,
      tarefaId: t.id,
      titulo: t.postTitulo || t.titulo,
      prazo: t.prazo ?? null,
      abriu: (vistas[postId] ?? []).some(daRodada),
      fora: false,
    };
    if (msgs.some((m) => diaSp(m.enviadoEm) === hoje)) Object.assign(p, { fora: true, motivoFora: 'já teve mensagem hoje' });
    else if (fora.has(sem(postId))) Object.assign(p, { fora: true, motivoFora: 'você tirou do resumo de hoje' });
    porProjeto.set(t.projetoId!, [...(porProjeto.get(t.projetoId!) ?? []), p]);
  }

  const out: ResumoDoCliente[] = [];
  for (const [projetoId, posts] of porProjeto) {
    posts.sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
    const grupos = await getGruposWhatsappDoProjeto(projetoId).catch(() => []);
    const grupo = grupos[0] ?? null;
    const nome = nomeCurtoDoProjeto(nomeProjeto.get(sem(projetoId)) ?? 'Projeto');
    const vao = posts.filter((p) => !p.fora);
    out.push({
      projetoId,
      projetoNome: nome,
      grupoId: grupo?.id ?? null,
      grupoNome: grupo?.nome ?? null,
      posts,
      mensagem: vao.length ? montarMensagem(grupo?.apelido?.trim() || nome, vao, textos, hoje) : '',
    });
  }
  return out.sort((a, b) => a.projetoNome.localeCompare(b.projetoNome, 'pt-BR'));
}

export async function enviarResumos(): Promise<{ enviados: string[]; erros: string[] }> {
  const r = { enviados: [] as string[], erros: [] as string[] };
  if (!zapiConfigured()) return { ...r, erros: ['WhatsApp (Z-API) não configurado'] };
  for (const c of await planejarResumo()) {
    const vao = c.posts.filter((p) => !p.fora);
    if (!vao.length || !c.mensagem) continue;
    if (!c.grupoId) {
      r.erros.push(`${c.projetoNome}: sem grupo`);
      continue;
    }
    const e = await enviarMensagemTexto(c.grupoId, c.mensagem);
    if (!e.ok) {
      r.erros.push(`${c.projetoNome}: ${e.erro}`);
      continue;
    }
    await registrarEnvioAvulso({
      projetoId: c.projetoId,
      postId: null,
      postIds: vao.map((p) => p.postId),
      momento: 'resumo_tarde',
      situacao: 'resumo',
      texto: c.mensagem,
      grupoId: c.grupoId,
      messageId: e.messageId ?? null,
      email: 'resumo automatico',
    });
    r.enviados.push(`${c.projetoNome} (${vao.length})`);
  }
  return r;
}
