/**
 * Conteúdo 100% no portal (piloto Emanuel Transfer Paris, dez/2026).
 * Posts, tarefas e comentários desses projetos vivem no Supabase, não no
 * Notion. Ver docs/PROCESSO-NO-PORTAL.md.
 *
 * Ids com prefixo: post `lud_…`, tarefa `ludt_…`. `lib/notion.ts` desvia pra
 * cá quando o id tem prefixo, então as telas de sempre funcionam.
 */
import { supabaseAdmin } from './supabase';
import { ehTarefaDoCliente } from './etapas-projeto';
import type {
  MaterialBloco,
  PostDetalhado,
  TarefaDoPost,
  TarefaPendente,
} from './notion';

// ============================================================================
// Ids e projetos
// ============================================================================

export const ehPostDoPortal = (id: string | null | undefined): boolean => !!id && id.startsWith('lud_');
export const ehTarefaDoPortal = (id: string | null | undefined): boolean => !!id && id.startsWith('ludt_');
export const ehIdDoPortal = (id: string | null | undefined): boolean => ehPostDoPortal(id) || ehTarefaDoPortal(id);

export type ProjetoNoPortal = { projetoId: string; nome: string | null; desde: string };

const normalizarId = (id: string) => id.replace(/-/g, '').toLowerCase();

let projetosCache: { ts: number; lista: ProjetoNoPortal[] } | null = null;

/** Projetos cujo conteúdo (a partir de `desde`) roda no portal. Cache de 1 min. */
export async function listarProjetosDoPortal(): Promise<ProjetoNoPortal[]> {
  if (projetosCache && Date.now() - projetosCache.ts < 60_000) return projetosCache.lista;
  try {
    const sb = await supabaseAdmin();
    const { data, error } = await sb.from('conteudo_projetos').select('projeto_id, nome, desde');
    if (error) throw error;
    const lista = (data ?? []).map((r: any) => ({ projetoId: r.projeto_id, nome: r.nome, desde: r.desde }));
    projetosCache = { ts: Date.now(), lista };
    return lista;
  } catch (err: any) {
    console.warn('[conteudo_projetos]', err?.message);
    return projetosCache?.lista ?? [];
  }
}

export async function projetoDoPortal(projetoId: string): Promise<ProjetoNoPortal | null> {
  const alvo = normalizarId(projetoId);
  return (await listarProjetosDoPortal()).find((p) => normalizarId(p.projetoId) === alvo) ?? null;
}

// ============================================================================
// Tipos (linhas do banco em camelCase)
// ============================================================================

export type Link = { name: string; url: string };

export type PostPortal = {
  id: string;
  projetoId: string;
  titulo: string;
  dataPostagem: string | null;
  horario: string | null;
  formato: string | null;
  editoria: string | null;
  funil: string | null;
  objetivo: string | null;
  ideia: string;
  informacoesNecessarias: string;
  materiaisNecessarios: string;
  referencias: string;
  briefing: string;
  roteiro: string;
  legenda: string;
  arteLinks: Link[];
  materiaisLinks: Link[];
  status: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type TarefaPortal = {
  id: string;
  postId: string;
  titulo: string;
  ordem: number;
  ordemUm: string;
  status: string;
  responsavelEmail: string | null;
  responsavelNome: string | null;
  prazo: string | null;
  finalizadaEm: string | null;
  maeId: string | null;
  criadoEm: string;
};

const linhaParaPost = (r: any): PostPortal => ({
  id: r.id,
  projetoId: r.projeto_id,
  titulo: r.titulo,
  dataPostagem: r.data_postagem,
  horario: r.horario,
  formato: r.formato,
  editoria: r.editoria,
  funil: r.funil,
  objetivo: r.objetivo,
  ideia: r.ideia ?? '',
  informacoesNecessarias: r.informacoes_necessarias ?? '',
  materiaisNecessarios: r.materiais_necessarios ?? '',
  referencias: r.referencias ?? '',
  briefing: r.briefing ?? '',
  roteiro: r.roteiro ?? '',
  legenda: r.legenda ?? '',
  arteLinks: Array.isArray(r.arte_links) ? r.arte_links : [],
  materiaisLinks: Array.isArray(r.materiais_links) ? r.materiais_links : [],
  status: r.status,
  criadoEm: r.criado_em,
  atualizadoEm: r.atualizado_em,
});

const linhaParaTarefa = (r: any): TarefaPortal => ({
  id: r.id,
  postId: r.post_id,
  titulo: r.titulo,
  ordem: r.ordem,
  ordemUm: r.ordem_um,
  status: r.status,
  responsavelEmail: r.responsavel_email,
  responsavelNome: r.responsavel_nome,
  prazo: r.prazo,
  finalizadaEm: r.finalizada_em,
  maeId: r.mae_id,
  criadoEm: r.criado_em,
});

/** Campos editáveis do post (nomes do banco). */
const CAMPOS_POST: Record<string, string> = {
  titulo: 'titulo',
  dataPostagem: 'data_postagem',
  horario: 'horario',
  formato: 'formato',
  editoria: 'editoria',
  funil: 'funil',
  objetivo: 'objetivo',
  ideia: 'ideia',
  informacoesNecessarias: 'informacoes_necessarias',
  materiaisNecessarios: 'materiais_necessarios',
  referencias: 'referencias',
  briefing: 'briefing',
  roteiro: 'roteiro',
  legenda: 'legenda',
  arteLinks: 'arte_links',
  materiaisLinks: 'materiais_links',
  status: 'status',
};

export type CamposPost = Partial<Omit<PostPortal, 'id' | 'projetoId' | 'criadoEm' | 'atualizadoEm'>>;

function paraColunas(campos: CamposPost): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(campos)) {
    const col = CAMPOS_POST[k];
    if (col && v !== undefined) out[col] = v;
  }
  return out;
}

// ============================================================================
// Posts
// ============================================================================

export async function listarPostsDoPortal(filtro: {
  projetoIds?: string[];
  inicio?: string;
  fim?: string;
}): Promise<PostPortal[]> {
  const sb = await supabaseAdmin();
  let q = sb.from('conteudo_posts').select('*').neq('status', 'Cancelado');
  if (filtro.projetoIds && filtro.projetoIds.length > 0) q = q.in('projeto_id', filtro.projetoIds);
  if (filtro.inicio) q = q.gte('data_postagem', filtro.inicio);
  if (filtro.fim) q = q.lte('data_postagem', filtro.fim);
  const { data, error } = await q.order('data_postagem', { ascending: true });
  if (error) {
    console.warn('[conteudo_posts]', error.message);
    return [];
  }
  return (data ?? []).map(linhaParaPost);
}

export async function getPostDoPortal(id: string): Promise<PostPortal | null> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb.from('conteudo_posts').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return linhaParaPost(data);
}

export async function criarPostDoPortal(projetoId: string, campos: CamposPost, email: string): Promise<PostPortal> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('conteudo_posts')
    .insert({ projeto_id: projetoId, ...paraColunas(campos), criado_por: email, atualizado_por: email })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const post = linhaParaPost(data);
  await criarTarefas(post.id, tarefasDaPauta(post.dataPostagem));
  return post;
}

export async function atualizarPostDoPortal(id: string, campos: CamposPost, email: string | null): Promise<PostPortal> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('conteudo_posts')
    .update({ ...paraColunas(campos), atualizado_em: new Date().toISOString(), atualizado_por: email })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return linhaParaPost(data);
}

// ============================================================================
// Tarefas
// ============================================================================

export const STATUS_FECHADOS = ['Concluído', 'Cancelado', 'Reprovado', 'Excluída'];
export const tarefaAberta = (t: { status: string; finalizadaEm: string | null }) =>
  !STATUS_FECHADOS.includes(t.status) && !t.finalizadaEm;

/**
 * Tarefa do cliente que está com ele agora: a primeira aberta na ordem cujas
 * anteriores já fecharam ("pronta"). Com `exigirPronto=false`, qualquer aberta.
 */
export function tarefaDoClienteAgora(tarefas: TarefaPortal[], exigirPronto = true): TarefaPortal | null {
  const chave = (t: TarefaPortal) => t.ordem * 10 + Number(t.ordemUm || '01');
  for (const t of tarefas) {
    if (!tarefaAberta(t) || !ehTarefaDoCliente(t.titulo)) continue;
    const pronta = tarefas.every((x) => chave(x) >= chave(t) || !tarefaAberta(x));
    if (!exigirPronto || pronta) return t;
  }
  return null;
}

export async function listarTarefasDoPortal(postIds: string[]): Promise<TarefaPortal[]> {
  if (postIds.length === 0) return [];
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('conteudo_tarefas')
    .select('*')
    .in('post_id', postIds)
    .order('ordem', { ascending: true })
    .order('ordem_um', { ascending: true });
  if (error) {
    console.warn('[conteudo_tarefas]', error.message);
    return [];
  }
  return (data ?? []).map(linhaParaTarefa);
}

export async function getTarefaDoPortal(id: string): Promise<TarefaPortal | null> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb.from('conteudo_tarefas').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return linhaParaTarefa(data);
}

export type NovaTarefa = {
  titulo: string;
  ordem: number;
  ordemUm?: string;
  prazo: string | null;
  maeId?: string | null;
  responsavelEmail?: string | null;
  responsavelNome?: string | null;
};

export async function criarTarefas(postId: string, tarefas: NovaTarefa[]): Promise<TarefaPortal[]> {
  if (tarefas.length === 0) return [];
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('conteudo_tarefas')
    .insert(
      tarefas.map((t) => ({
        post_id: postId,
        titulo: t.titulo,
        ordem: t.ordem,
        ordem_um: t.ordemUm ?? '01',
        prazo: t.prazo,
        mae_id: t.maeId ?? null,
        responsavel_email: t.responsavelEmail ?? null,
        responsavel_nome: t.responsavelNome ?? null,
      })),
    )
    .select('*');
  if (error) throw new Error(error.message);
  return (data ?? []).map(linhaParaTarefa);
}

export async function atualizarTarefaDoPortal(
  id: string,
  campos: Partial<Pick<TarefaPortal, 'status' | 'prazo' | 'finalizadaEm' | 'responsavelEmail' | 'responsavelNome'>>,
): Promise<TarefaPortal> {
  const cols: Record<string, unknown> = {};
  if (campos.status !== undefined) cols.status = campos.status;
  if (campos.prazo !== undefined) cols.prazo = campos.prazo;
  if (campos.finalizadaEm !== undefined) cols.finalizada_em = campos.finalizadaEm;
  if (campos.responsavelEmail !== undefined) cols.responsavel_email = campos.responsavelEmail;
  if (campos.responsavelNome !== undefined) cols.responsavel_nome = campos.responsavelNome;
  const sb = await supabaseAdmin();
  const { data, error } = await sb.from('conteudo_tarefas').update(cols).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return linhaParaTarefa(data);
}

export async function concluirTarefaDoPortal(id: string): Promise<TarefaPortal> {
  return atualizarTarefaDoPortal(id, { status: 'Concluído', finalizadaEm: new Date().toISOString() });
}

export async function reabrirTarefaDoPortal(id: string, status?: string | null): Promise<TarefaPortal> {
  return atualizarTarefaDoPortal(id, { status: status || 'Iniciar', finalizadaEm: null });
}

// ============================================================================
// Comentários
// ============================================================================

export async function comentarPostDoPortal(
  postId: string,
  texto: string,
  autorEmail: string | null,
  tarefaId?: string | null,
): Promise<void> {
  const sb = await supabaseAdmin();
  const { error } = await sb
    .from('conteudo_comentarios')
    .insert({ post_id: postId, texto, autor_email: autorEmail, tarefa_id: tarefaId ?? null });
  if (error) throw new Error(error.message);
}

export async function lerComentariosDoPortal(postId: string): Promise<{ id: string; texto: string; criadoEm: string }[]> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('conteudo_comentarios')
    .select('id, texto, criado_em')
    .eq('post_id', postId)
    .order('criado_em', { ascending: true });
  if (error) return [];
  return (data ?? []).map((r: any) => ({ id: `c${r.id}`, texto: r.texto, criadoEm: r.criado_em }));
}

// ============================================================================
// Processo: tarefas e prazos (mesma régua do Notion — ver docs)
// ============================================================================

const iso = (d: Date) => d.toISOString().slice(0, 10);
function hojeSp(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
/** Segunda-feira da semana do dia. */
function segundaDa(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  return somarDias(dia, -((d.getUTCDay() + 6) % 7));
}
/** Dia `n` do mês que fica `mesesAntes` antes do mês de `dia` (dia 28 de M−2, etc.). */
function diaDoMesAntes(dia: string, mesesAntes: number, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - mesesAntes, n, 12));
  return iso(alvo);
}
/** Prazo às 17h de Brasília; se a régua já passou (calendário atrasado), vence hoje. */
function prazo17h(dia: string): string {
  const hoje = hojeSp();
  const alvo = dia < hoje ? hoje : dia;
  return `${alvo}T17:00:00-03:00`;
}

/** Fase de pauta (4 tarefas, como no Notion). */
export function tarefasDaPauta(dataPostagem: string | null): NovaTarefa[] {
  const D = dataPostagem ?? hojeSp();
  return [
    { titulo: 'Criação de Pauta', ordem: 1, prazo: prazo17h(diaDoMesAntes(D, 2, 5)) },
    { titulo: 'Aprovação | Criação de Pauta', ordem: 2, prazo: prazo17h(diaDoMesAntes(D, 2, 7)) },
    { titulo: 'Aprovação | Pauta', ordem: 3, prazo: prazo17h(diaDoMesAntes(D, 2, 15)) },
    { titulo: 'Botão Produzir Post', ordem: 4, prazo: prazo17h(diaDoMesAntes(D, 2, 16)) },
  ];
}

/** Cadeia de produção criada pelo "Produzir post" (Ordem 10–22, prazos pela semana da postagem). */
export function tarefasDaProducao(dataPostagem: string): NovaTarefa[] {
  const D = dataPostagem;
  const S = segundaDa(D);
  const bc = diaDoMesAntes(D, 2, 28);
  return [
    { titulo: 'Envio de Conteúdos Prévios', ordem: 10, prazo: prazo17h(diaDoMesAntes(D, 2, 20)) },
    { titulo: 'Briefing & Copy', ordem: 11, prazo: prazo17h(bc) },
    { titulo: 'Aprovação | Briefing & Copy', ordem: 12, prazo: prazo17h(somarDias(bc, 2)) },
    { titulo: 'Solicitação Produção', ordem: 13, prazo: prazo17h(somarDias(bc, 2)) },
    { titulo: 'Materiais para Produção', ordem: 14, prazo: prazo17h(somarDias(S, -22)) },
    { titulo: 'Aprovação | Materiais para Produção', ordem: 15, prazo: prazo17h(somarDias(S, -21)) },
    { titulo: 'Arte', ordem: 16, prazo: prazo17h(somarDias(S, -14)) },
    { titulo: 'Aprovação | Arte', ordem: 17, prazo: prazo17h(somarDias(S, -13)) },
    { titulo: 'Aprovação | Geral', ordem: 18, prazo: prazo17h(somarDias(S, -13)) },
    { titulo: 'Enviar Post Aprovação', ordem: 19, prazo: prazo17h(somarDias(S, -11)) },
    { titulo: 'Aprovação | Post', ordem: 20, prazo: prazo17h(somarDias(S, -7)) },
    { titulo: 'Programar', ordem: 21, prazo: prazo17h(somarDias(S, -3)) },
    { titulo: 'Conferir Postagem', ordem: 22, prazo: prazo17h(D) },
  ];
}

/** "Produzir post": fecha a fase de pauta e cria a cadeia de produção (uma vez só). */
export async function produzirPostDoPortal(postId: string): Promise<TarefaPortal[]> {
  const post = await getPostDoPortal(postId);
  if (!post) throw new Error('post não encontrado');
  if (!post.dataPostagem) throw new Error('O post precisa de data de postagem pra calcular os prazos.');
  const tarefas = await listarTarefasDoPortal([postId]);
  if (tarefas.some((t) => t.ordem >= 10)) throw new Error('Esse post já está em produção.');
  for (const t of tarefas) {
    if (t.ordem <= 4 && tarefaAberta(t)) await concluirTarefaDoPortal(t.id);
  }
  await atualizarPostDoPortal(postId, { status: 'Em Produção' }, null);
  return criarTarefas(postId, tarefasDaProducao(post.dataPostagem));
}

// ============================================================================
// Conversão pros formatos que as telas já usam
// ============================================================================

const diaSp = (v: string | null): string | null =>
  !v ? null : v.length <= 10 ? v : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(v));

export function formatoTipoDe(formato: string | null): 'post' | 'reels' | 'story' | 'desconhecido' {
  const f = (formato ?? '').toLowerCase();
  if (/reel/.test(f)) return 'reels';
  if (/stor/.test(f)) return 'story';
  if (/carross|post|est[áa]tic/.test(f)) return 'post';
  return 'desconhecido';
}

/** Texto livre (um item por parágrafo; 1ª linha é o título) → blocos da tela de pauta. */
export function textoParaBlocos(texto: string): MaterialBloco[] | null {
  const blocos = texto
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean))
    .filter((l) => l.length > 0)
    .map(([cabecalho, ...detalhes]) => ({ cabecalho, detalhes }));
  return blocos.length > 0 ? blocos : null;
}

function categoriaDe(titulo: string): TarefaDoPost['categoria'] {
  const t = titulo.toLowerCase().trim();
  if (t.startsWith('aprovação')) return 'aprovacao';
  if (t.startsWith('alteração')) return 'alteracao';
  if (t.includes('briefing')) return 'briefing';
  if (t.includes('arte')) return 'arte';
  if (t.includes('copy')) return 'copy';
  return 'outro';
}

export function paraTarefaDoPost(t: TarefaPortal): TarefaDoPost {
  return {
    tarefaId: t.id,
    titulo: t.titulo,
    status: t.status,
    prazo: diaSp(t.prazo),
    finalizada: diaSp(t.finalizadaEm),
    finalizadaEm: t.finalizadaEm,
    pessoaNome: t.responsavelNome,
    pessoaAvatar: null,
    pessoaId: null,
    ordem: String(t.ordem).padStart(2, '0'),
    ordemUm: t.ordemUm,
    categoria: categoriaDe(t.titulo),
    aberta: tarefaAberta(t),
  };
}

export function paraPostDetalhado(p: PostPortal, projetoNome: string, tarefaIds: string[]): PostDetalhado {
  const formatoTipo = formatoTipoDe(p.formato);
  return {
    id: p.id,
    titulo: p.titulo,
    data: p.dataPostagem,
    status: p.status,
    statusGeral: null,
    projetoId: p.projetoId,
    projetoNome,
    formato: p.formato ? [{ id: p.formato, name: p.formato, icon: null }] : [],
    funil: p.funil ? [{ id: p.funil, name: p.funil, icon: null }] : [],
    objetivo: p.objetivo ? [{ id: p.objetivo, name: p.objetivo, icon: null }] : [],
    demanda: null,
    formatoTipo,
    driveLinks: p.arteLinks,
    materiaisLinks: p.materiaisLinks,
    legenda: p.legenda || null,
    bodyCompleto: [p.briefing, p.roteiro].filter(Boolean).join('\n\n') || null,
    ideiaDoPost: p.ideia || null,
    materiaisNecessarios: textoParaBlocos(p.materiaisNecessarios),
    informacoesNecessarias: textoParaBlocos(p.informacoesNecessarias),
    aprovacaoColaborativa: false,
    tarefaIds,
  };
}

export function paraTarefaPendente(t: TarefaPortal, p: PostPortal, projetoNome: string): TarefaPendente {
  return {
    tarefaId: t.id,
    tarefaTitulo: t.titulo,
    tarefaPrazo: t.prazo,
    postId: p.id,
    postTitulo: p.titulo,
    postData: p.dataPostagem,
    projetoId: p.projetoId,
    projetoNome,
    formato: p.formato ? [{ id: p.formato, name: p.formato, icon: null }] : [],
    funil: [],
    objetivo: [],
    formatoTipo: formatoTipoDe(p.formato),
    formatoNome: p.formato,
  };
}
