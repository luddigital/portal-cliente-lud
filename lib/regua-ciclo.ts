/**
 * Lógica pura da Régua da semana: classifica as tarefas de cada post e
 * monta o ciclo de uma quinta. Sem acesso a banco (testável e importável
 * no cliente). Cadeia do post no Notion:
 * Arte → Aprovação | Arte → Enviar Post Aprovação (qui) → Aprovação | Post (seg).
 */
import type { TarefaRegua } from './notion';
import { somarDias } from './lembrete-aprovacao';
import type { MomentoRegua } from './regua-mensagens';

export type EstadoArte = 'aprovada' | 'aguardando_aprovacao' | 'alteracao' | 'em_producao' | 'sem_tarefa';
export type EstadoCliente = 'aprovado' | 'alteracao' | 'pendente' | 'sem_tarefa';

export type PostRegua = {
  postId: string;
  titulo: string;
  arte: EstadoArte;
  envioTarefaId: string | null;
  envioConcluido: boolean;
  aprovacaoTarefaId: string | null;
  aprovacaoPrazo: string | null;
  cliente: EstadoCliente;
  vistoDesdeEnvio: boolean;
  ultimaVisualizacao: string | null;
};

export type ClienteRegua = {
  projetoId: string;
  projetoNome: string;
  clienteNome: string;
  apelido: string | null;
  grupoNome: string | null;
  posts: PostRegua[];
};

export type CicloRegua = {
  quinta: string;
  prazo: string;
  clientes: ClienteRegua[];
};

const FECHADOS = ['Concluído', 'Cancelado', 'Reprovado', 'Excluída'];
export const DESCARTADOS = ['Cancelado', 'Excluída'];

const ehEnvio = (t: string) => /^enviar post/i.test(t);
const ehAprovArte = (t: string) => /^aprova[çc][ãa]o\s*\|\s*arte/i.test(t);
const ehAltArte = (t: string) => /^altera[çc][ãa]o\s*\|\s*arte/i.test(t);
const ehArte = (t: string) => t.trim().toLowerCase() === 'arte';
const ehAprovPost = (t: string) => /^aprova[çc][ãa]o\s*\|\s*post/i.test(t);
const aberta = (t: TarefaRegua) => !FECHADOS.includes(t.status ?? '');
const concluida = (t: TarefaRegua) => t.status === 'Concluído';

export function diaDaSemana(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function quintasDoCiclo(hoje: string): { proxima: string; anterior: string } {
  const proxima = somarDias(hoje, (4 - diaDaSemana(hoje) + 7) % 7);
  return { proxima, anterior: somarDias(proxima, -7) };
}

export function momentoDoDia(hoje: string, anteriorQuinta: string, hora: number): MomentoRegua | null {
  if (diaDaSemana(hoje) === 4) return 'quinta';
  if (hoje === somarDias(anteriorQuinta, 1)) return 'sexta';
  if (hoje === somarDias(anteriorQuinta, 4)) return hora < 13 ? 'segunda_manha' : 'segunda_tarde';
  if (hoje === somarDias(anteriorQuinta, 5)) return 'terca';
  return null;
}

export function estadoArte(ts: TarefaRegua[]): EstadoArte {
  const aprov = ts.filter((t) => ehAprovArte(t.titulo));
  const alt = ts.filter((t) => ehAltArte(t.titulo));
  const arte = ts.filter((t) => ehArte(t.titulo));
  if (alt.some(aberta)) return 'alteracao';
  if (arte.some(aberta)) return 'em_producao';
  if (aprov.some(aberta)) return 'aguardando_aprovacao';
  if (aprov.some(concluida)) return 'aprovada';
  if (aprov.length === 0 && arte.some(concluida)) return 'aprovada';
  return 'sem_tarefa';
}

export function estadoCliente(ts: TarefaRegua[]): { estado: EstadoCliente; tarefa: TarefaRegua | null } {
  const aprov = ts.filter((t) => ehAprovPost(t.titulo));
  const abertaT = aprov.find(aberta);
  if (abertaT) return { estado: 'pendente', tarefa: abertaT };
  const ok = aprov.find(concluida);
  if (ok) return { estado: 'aprovado', tarefa: ok };
  const rep = aprov.find((t) => t.status === 'Reprovado');
  if (rep) return { estado: 'alteracao', tarefa: rep };
  return { estado: 'sem_tarefa', tarefa: null };
}

export function agruparPorPost(tarefas: TarefaRegua[]): Map<string, TarefaRegua[]> {
  const porPost = new Map<string, TarefaRegua[]>();
  for (const t of tarefas) {
    if (!t.postId || DESCARTADOS.includes(t.status ?? '')) continue;
    const lista = porPost.get(t.postId) ?? [];
    lista.push(t);
    porPost.set(t.postId, lista);
  }
  return porPost;
}

export function montarCiclo(input: {
  quinta: string;
  porPost: Map<string, TarefaRegua[]>;
  visualizacoes: Record<string, { ultima: string }>;
  projetos: Map<string, { nome: string; clienteNome: string }>;
  grupos: Map<string, { nome: string; apelido: string | null }>;
}): CicloRegua {
  const { quinta, porPost, visualizacoes, projetos, grupos } = input;
  const prazo = somarDias(quinta, 4);
  const inicioVisto = new Date(`${quinta}T00:00:00-03:00`).getTime();
  const clientes = new Map<string, ClienteRegua>();

  for (const [postId, ts] of porPost) {
    const envio = ts.find(
      (t) => ehEnvio(t.titulo) && t.prazo && t.prazo >= somarDias(quinta, -3) && t.prazo <= somarDias(quinta, 3),
    );
    if (!envio) continue;
    const projetoId = envio.projetoId ?? ts.find((t) => t.projetoId)?.projetoId;
    if (!projetoId) continue;

    const aprovDoCiclo = ts.filter(
      (t) => ehAprovPost(t.titulo) && t.prazo && t.prazo >= quinta && t.prazo <= somarDias(quinta, 7),
    );
    const { estado, tarefa } = estadoCliente(aprovDoCiclo);
    const v = visualizacoes[postId];

    const post: PostRegua = {
      postId,
      titulo: envio.postTitulo ?? 'Post sem título',
      arte: estadoArte(ts),
      envioTarefaId: envio.tarefaId,
      envioConcluido: concluida(envio),
      aprovacaoTarefaId: tarefa?.tarefaId ?? null,
      aprovacaoPrazo: tarefa?.prazo ?? null,
      cliente: estado,
      vistoDesdeEnvio: !!v && new Date(v.ultima).getTime() >= inicioVisto,
      ultimaVisualizacao: v?.ultima ?? null,
    };

    let c = clientes.get(projetoId);
    if (!c) {
      const p = projetos.get(projetoId);
      const g = grupos.get(projetoId);
      c = {
        projetoId,
        projetoNome: p?.nome ?? 'Projeto',
        clienteNome: p?.clienteNome ?? p?.nome ?? 'Cliente',
        apelido: g?.apelido ?? null,
        grupoNome: g?.nome ?? null,
        posts: [],
      };
      clientes.set(projetoId, c);
    }
    c.posts.push(post);
  }

  return {
    quinta,
    prazo,
    clientes: [...clientes.values()].sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, 'pt-BR')),
  };
}
