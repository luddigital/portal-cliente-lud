/**
 * Dados da entrega "Criação de Pauta", usados nas duas telas dela:
 * a de um cliente (/admin/projetos/[id]/entregas/[entregaId]) e a de todos
 * os clientes (/admin/entregas/[id]).
 *
 * "Pauta com tema" = a tarefa de Criação de Pauta do post já foi concluída
 * (ou o post já passou dessa etapa) OU o post já tem um título de verdade
 * (diferente de "Novo Post" / vazio).
 */
import type { GrupoEntrega, ItemEntrega } from '../../entrega/[id]/EntregaPorCliente';
import type { TarefaDoProjeto } from '@/lib/notion';
import { nomeCurtoDoProjeto } from '@/lib/rotas';

export const ehCriacaoDePauta = (nome: string) => /cria[cç][aã]o\s*(de\s*)?pauta/i.test(nome);

export type PautaPost = {
  postId: string;
  tarefaId: string;
  titulo: string;
  /** Data Postagem (YYYY-MM-DD). */
  data: string;
  tema: boolean;
  tipo: string | null;
  pessoa: string | null;
  prazo: string | null;
  feitaEm: string | null;
  aberta: boolean;
};

export type EstadoPauta = 'atr' | 'and' | 'pronta' | 'enviada';

export type PautaCliente = {
  projetoId: string;
  handle: string;
  clienteNome: string;
  /** Mês dos posts dessa rodada (YYYY-MM). */
  mes: string;
  posts: PautaPost[];
  comTema: number;
  /** Prazo da rodada (a tarefa aberta mais antiga; sem abertas, a mais recente). */
  prazo: string | null;
  tarefasAbertas: { id: string; prazo: string | null }[];
  quemCria: string[];
  /** Prazo da Aprovação | Pauta (próxima etapa), quando existe. */
  aprovacao: string | null;
  /** Quem faz a tarefa de Aprovação | Pauta (normalmente a cliente). */
  aprovador: string | null;
  estado: EstadoPauta;
};

const fechadoNaEntrega = (i: ItemEntrega) => i.enviado || i.relacao === 'depois' || i.relacao === 'concluido';

function temTema(i: ItemEntrega): boolean {
  if (fechadoNaEntrega(i)) return true;
  const t = (i.postTitulo ?? '').trim();
  if (!t || t === i.titulo) return false;
  return !/^novo post$/i.test(t);
}

/** "AUTOMAÇÃO ROTEIRO | Quanto custa…" → "Automação roteiro". */
export function tipoDoTitulo(titulo: string): string | null {
  const m = titulo.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ]{3,})\s*\|/);
  if (!m) return null;
  const s = m[1].trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function montarCliente(
  g: GrupoEntrega,
  hoje: string,
  abertasPorPost: Map<string, TarefaDoProjeto[]>,
): PautaCliente | null {
  const comData = g.itens.filter((i) => i.postId && i.postData);
  if (comData.length === 0) return null;
  // A rodada atual: o mês dos posts da tarefa com o prazo mais recente.
  const ref = [...comData].sort((a, b) => (b.prazo ?? '').localeCompare(a.prazo ?? ''))[0];
  const mes = ref.postData!.slice(0, 7);
  const doMes = comData.filter((i) => i.postData!.slice(0, 7) === mes);
  const posts: PautaPost[] = doMes
    .map((i) => {
      const tema = temTema(i);
      const titulo = (i.postTitulo ?? '').trim() === i.titulo ? 'Novo Post' : (i.postTitulo ?? 'Novo Post').trim() || 'Novo Post';
      return {
        postId: i.postId!,
        tarefaId: i.tarefaId,
        titulo,
        data: i.postData!.slice(0, 10),
        tema,
        tipo: tema ? tipoDoTitulo(titulo) : null,
        pessoa: i.pessoa,
        prazo: i.prazo,
        feitaEm: fechadoNaEntrega(i) ? i.enviadoEm : null,
        aberta: !fechadoNaEntrega(i),
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data));
  const abertas = posts.filter((p) => p.aberta);
  const prazos = abertas.map((p) => p.prazo).filter((d): d is string => !!d).sort();
  const prazo = prazos[0] ?? posts.map((p) => p.prazo).filter((d): d is string => !!d).sort().slice(-1)[0] ?? null;
  const comTema = posts.filter((p) => p.tema).length;
  let aprovacao: string | null = null;
  let aprovador: string | null = null;
  for (const p of posts) {
    for (const t of abertasPorPost.get(p.postId) ?? []) {
      if (/aprova[çc][ãa]o\s*\|\s*pauta/i.test(t.titulo) && t.prazo && (!aprovacao || t.prazo < aprovacao)) {
        aprovacao = t.prazo;
        aprovador = (t as { pessoa?: string | null }).pessoa ?? aprovador;
      }
    }
  }
  const todosPassaram = doMes.every((i) => i.relacao === 'depois' || i.relacao === 'concluido');
  const estado: EstadoPauta = todosPassaram
    ? 'enviada'
    : comTema === posts.length
      ? 'pronta'
      : prazo && prazo < hoje
        ? 'atr'
        : 'and';
  const quemCria = [...new Set(posts.map((p) => p.pessoa).filter((x): x is string => !!x))];
  return {
    projetoId: g.projetoId,
    handle: nomeCurtoDoProjeto(g.projetoNome || g.nome),
    clienteNome: g.nome,
    mes,
    posts,
    comTema,
    prazo,
    tarefasAbertas: abertas.map((p) => ({ id: p.tarefaId, prazo: p.prazo })),
    quemCria,
    aprovacao,
    aprovador,
    estado,
  };
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const dm = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
export const diaSemana = (iso: string) => SEMANA[new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()];
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / 86_400_000);
}
export function somaDiasIso(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const primeiroNome = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] ?? '';
