import { ehEntregaAprovacoes, entregaDaAprovacao } from '@/lib/entregasAprovacao';
import {
  listAllProjetos,
  listEntregas,
  listarTarefasAbertasDeTodos,
  proximaDataDaEntrega,
  type EntregaItem,
  type TarefaDeTodos,
} from '@/lib/notion';
import { hojeEmSaoPaulo } from '@/lib/lembrete-aprovacao';
import { tipoDaEntrega } from '@/lib/entrega-dados';
import type { TipoEntrega } from '@/app/admin/entrega/[id]/EntregaPorCliente';
import { nomeCurtoDoProjeto } from '@/lib/rotas';
import type { St } from '../_ui/lud';

/**
 * Quadro das entregas (proposta NOVA "Entregas · todos os clientes"): cada
 * entrega com as colunas Atrasado / Atual / Próxima entrega e os clientes dentro.
 *
 * Tudo sai de duas leituras já cacheadas (lista de entregas + tarefas abertas
 * de todos os projetos, de 90 dias atrás a 31 pra frente) e da lista de
 * projetos. Só tarefas em aberto: as concluídas não entram na conta.
 */

export type ColunaId = 'atr' | 'atu' | 'dep';

export type LinhaCliente = {
  projetoId: string;
  handle: string;
  clienteNome: string;
  /** Quantas tarefas em aberto dessa entrega o projeto tem nessa coluna. */
  qtd: number;
  unidade: string;
  prazoMaisAntigo: string | null;
  tag: { texto: string; st: St } | null;
  detalhe: string | null;
  /** Tarefa usada no lembrete (a de prazo mais antigo). */
  tarefaId: string;
  pessoas: string[];
  /** Tarefas em aberto dessa entrega que o projeto tem nessa coluna. */
  nTarefas: number;
  /** Posts dessa linha (um por post, tarefa de prazo mais antigo), pra abrir a prévia. */
  posts: { id: string; titulo: string; tarefaId: string; prazo: string | null }[];
  /** Quantas tarefas dessa linha cada pessoa tem. */
  porPessoa: { nome: string; n: number }[];
};

export type Coluna = { id: ColunaId; rotulo: string; periodo: string; linhas: LinhaCliente[] };

export type QuadroEntrega = {
  id: string;
  nome: string;
  frequencia: string | null;
  diaRotulo: string;
  tipo: TipoEntrega;
  pessoas: string[];
  /** Dia da rodada atual (YYYY-MM-DD), pra agenda da semana. */
  dataAtual: string | null;
  /** Rodada atual: de `rodadaIni` (inclusive) até `rodadaFim` (exclusive). */
  rodadaIni: string;
  rodadaFim: string;
  colunas: [Coluna, Coluna, Coluna];
};

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_ENTREGA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const DIAS_BONITOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const soma = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
const dias = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86_400_000);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const curta = (iso: string) => `${SEMANA[new Date(utc(iso)).getUTCDay()]}, ${ddmm(iso)}`;
const segunda = (iso: string) => soma(iso, -((new Date(utc(iso)).getUTCDay() + 6) % 7));
const semTraco = (s: string) => s.replace(/-/g, '');

function normDia(dia: string | null): string {
  return (dia ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/-feira$/, '');
}

// Pedido de alteração do cliente: a "Alteração | X" é da entrega Alterações e a
// reaprovação (Ordem (1) = 03) da entrega Aprovações, mesmo que a tarefa tenha
// ficado ligada à entrega de aprovação no Notion. Assim ela aparece em evidência
// (e em atraso, quando vence) e sai da rodada da aprovação.
const ENTREGA_ALTERACOES = '2bcd04d23b4a8088bb31fb2d83e29fbf';
export function entregaEfetiva(t: Pick<TarefaDeTodos, 'titulo' | 'ordemUm' | 'entregaId'>): string | null {
  if (/^altera[çc][ãa]o\s*\|/i.test(t.titulo ?? '')) return ENTREGA_ALTERACOES;
  // Reaprovação vai pra página própria da aprovação (Aprovação | Post, | Arte…).
  if (t.ordemUm === '03' || (t.entregaId && ehEntregaAprovacoes(t.entregaId))) {
    const propria = entregaDaAprovacao(t.titulo);
    if (propria) return propria;
  }
  return t.entregaId ?? null;
}

export function ehSemanal(e: Pick<EntregaItem, 'frequencia'>) {
  return /semanal/i.test(e.frequencia ?? '');
}
export function ehMensal(e: Pick<EntregaItem, 'frequencia'>) {
  return /mensal/i.test(e.frequencia ?? '');
}

/** "toda quarta", "mês · dia 15", "todo dia". */
function rotuloDoDia(e: EntregaItem): string {
  const d = normDia(e.dia);
  if (d === 'todos' || d === 'todo dia') return 'todo dia';
  const i = DIAS_ENTREGA.indexOf(d);
  if (i >= 0) return i === 0 || i === 6 ? `todo ${DIAS_BONITOS[i]}` : `toda ${DIAS_BONITOS[i]}`;
  if (/^\d{1,2}$/.test(d)) return `mês · dia ${d.padStart(2, '0')}`;
  return e.frequencia?.toLowerCase() ?? 'sem dia';
}

/** Limites das rodadas (atual começa em `ini`, a próxima em `prox`) e os rótulos. */
function rodadas(e: EntregaItem, hoje: string) {
  if (ehSemanal(e)) {
    const ini = segunda(hoje);
    const prox = soma(ini, 7);
    const i = DIAS_ENTREGA.indexOf(normDia(e.dia));
    const dataAtual = i >= 0 ? soma(ini, (i + 6) % 7) : proximaDataDaEntrega(e, hoje);
    return {
      ini,
      prox,
      data: dataAtual,
      atual: dataAtual ? curta(dataAtual) : 'esta semana',
      depois: dataAtual ? curta(soma(dataAtual, 7)) : 'próxima semana',
      antes: 'rodadas anteriores',
    };
  }
  if (ehMensal(e)) {
    const ini = `${hoje.slice(0, 7)}-01`;
    const [y, m] = hoje.split('-').map(Number);
    const prox = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    return { ini, prox, data: proximaDataDaEntrega(e, ini), atual: MESES[m - 1], depois: MESES[m % 12], antes: 'meses anteriores' };
  }
  return { ini: hoje, prox: soma(hoje, 1), data: hoje, atual: 'hoje', depois: 'próximos dias', antes: 'dias anteriores' };
}

function montarLinha(
  col: ColunaId,
  projetoId: string,
  nome: string,
  clienteNome: string,
  ts: TarefaDeTodos[],
  hoje: string,
): LinhaCliente {
  const ord = [...ts].sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
  const antigo = ord[0]?.prazo?.slice(0, 10) ?? null;
  const comPost = ord.filter((t) => t.postId).length;
  const qtd = comPost ? new Set(ord.filter((t) => t.postId).map((t) => t.postId)).size : ord.length;
  const unidade = comPost ? (qtd === 1 ? 'post' : 'posts') : qtd === 1 ? 'tarefa' : 'tarefas';
  let tag: LinhaCliente['tag'] = null;
  let detalhe: string | null = null;
  if (antigo) {
    if (col === 'atr') {
      const n = dias(antigo, hoje);
      tag = { texto: `${n} ${n === 1 ? 'dia' : 'dias'}`, st: 'atr' };
      detalhe = `rodada de ${ddmm(antigo)}`;
    } else if (col === 'atu') {
      if (antigo < hoje) tag = { texto: `venceu ${ddmm(antigo)}`, st: 'atr' };
      else if (antigo === hoje) tag = { texto: 'vence hoje', st: 'hoje' };
      else tag = { texto: `até ${ddmm(antigo)}`, st: 'cheg' };
    } else {
      detalhe = `a partir de ${ddmm(antigo)}`;
    }
  }
  const posts: LinhaCliente['posts'] = [];
  const vistos = new Set<string>();
  for (const t of ord) {
    if (!t.postId || vistos.has(t.postId)) continue;
    vistos.add(t.postId);
    posts.push({ id: t.postId, titulo: (t.postTitulo ?? '').trim() || 'Post sem título', tarefaId: t.id, prazo: t.prazo?.slice(0, 10) ?? null });
  }
  if (!comPost && ord.length === 1) detalhe = [ord[0].titulo, detalhe].filter(Boolean).join(' · ');
  return {
    projetoId,
    handle: nomeCurtoDoProjeto(nome),
    clienteNome,
    qtd,
    unidade,
    prazoMaisAntigo: antigo,
    tag,
    detalhe,
    tarefaId: ord[0]?.id ?? '',
    pessoas: [...new Set(ord.map((t) => t.pessoa).filter((p): p is string => !!p))],
    posts,
    nTarefas: ord.length,
    porPessoa: Object.entries(
      ord.reduce<Record<string, number>>((acc, t) => {
        const k = t.pessoa ?? 'Sem responsável';
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([nome, n]) => ({ nome, n }))
      .sort((a, b) => b.n - a.n),
  };
}

export type DadosQuadro = {
  hoje: string;
  quadros: QuadroEntrega[];
};

export async function carregarQuadro(soEntregaId?: string): Promise<DadosQuadro> {
  const [entregas, tarefas, projetos] = await Promise.all([
    listEntregas(),
    listarTarefasAbertasDeTodos().catch(() => [] as TarefaDeTodos[]),
    listAllProjetos().catch(() => []),
  ]);
  const hoje = hojeEmSaoPaulo();
  const projPorId = new Map(projetos.map((p) => [semTraco(p.id), p]));
  const porEntrega = new Map<string, TarefaDeTodos[]>();
  for (const t of tarefas) {
    const ent = entregaEfetiva(t);
    if (!ent) continue;
    const k = semTraco(ent);
    porEntrega.set(k, [...(porEntrega.get(k) ?? []), t]);
  }

  const quadros: QuadroEntrega[] = [];
  for (const e of entregas) {
    if (soEntregaId && semTraco(e.id) !== semTraco(soEntregaId)) continue;
    // "Aprovações" saiu: as reaprovações aparecem nas páginas próprias de cada aprovação.
    if (!soEntregaId && ehEntregaAprovacoes(e.id)) continue;
    const r = rodadas(e, hoje);
    const ts = porEntrega.get(semTraco(e.id)) ?? [];
    const grupos: Record<ColunaId, Map<string, TarefaDeTodos[]>> = { atr: new Map(), atu: new Map(), dep: new Map() };
    for (const t of ts) {
      const p = t.prazo?.slice(0, 10);
      const col: ColunaId = !p ? 'dep' : p < r.ini ? 'atr' : p < r.prox ? 'atu' : 'dep';
      const k = t.projetoId ? semTraco(t.projetoId) : 'sem-projeto';
      grupos[col].set(k, [...(grupos[col].get(k) ?? []), t]);
    }
    const linhas = (col: ColunaId) =>
      [...grupos[col].entries()]
        .map(([k, lista]) => {
          const proj = projPorId.get(k);
          return montarLinha(
            col,
            proj?.id ?? lista[0].projetoId ?? '',
            proj?.nome ?? 'Projeto',
            proj?.clienteNome ?? proj?.nome ?? 'cliente',
            lista,
            hoje,
          );
        })
        .sort(
          (a, b) =>
            (a.prazoMaisAntigo ?? '9999').localeCompare(b.prazoMaisAntigo ?? '9999') ||
            a.handle.localeCompare(b.handle, 'pt-BR'),
        );
    quadros.push({
      id: e.id,
      nome: e.nome,
      frequencia: e.frequencia,
      diaRotulo: rotuloDoDia(e),
      tipo: tipoDaEntrega(e.nome),
      pessoas: [...new Set(ts.map((t) => t.pessoa).filter((p): p is string => !!p))],
      dataAtual: r.data ?? null,
      rodadaIni: r.ini,
      rodadaFim: r.prox,
      colunas: [
        { id: 'atr', rotulo: 'Atrasado', periodo: r.antes, linhas: linhas('atr') },
        { id: 'atu', rotulo: 'Atual', periodo: r.atual, linhas: linhas('atu') },
        { id: 'dep', rotulo: 'Próxima entrega', periodo: r.depois, linhas: linhas('dep') },
      ],
    });
  }

  // Ordem do processo: pela data da rodada atual dentro da semana / do mês.
  const ordem = (e: QuadroEntrega) => {
    const item = entregas.find((x) => x.id === e.id)!;
    return proximaDataDaEntrega(item, segunda(hoje)) ?? '9999';
  };
  quadros.sort((a, b) => ordem(a).localeCompare(ordem(b)) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { hoje, quadros };
}
