/**
 * Dashboard (/admin): os mesmos blocos da página do projeto, juntando todos os
 * clientes. Arquivo puro: recebe as tarefas abertas de todos os projetos, a
 * lista de projetos e os posts do mês, e devolve a semana, os marcos dos
 * próximos 30 dias e a tabela de projetos. Datas YYYY-MM-DD (São Paulo).
 */
import type { PostCalendario, ProjetoListItem, TarefaDeTodos } from './notion';
import { etapaDaTarefa, ehTarefaDoCliente, resumirEtapas } from './etapas-projeto';
import { diasEntre, marcosDosProximos30, semanaDoProjeto, nivelDoPrazo, type NivelPrazo } from './visao-projeto';
import { classificarProjeto } from './projetoServico';

const semTr = (id: string) => id.replace(/-/g, '');

export type InfoProjeto = {
  projetoId: string;
  projetoNome: string;
  /** Nome curto pra etiqueta: @ do Instagram ou o nome do cliente. */
  rotulo: string;
  clienteNome: string;
};

function rotuloDoProjeto(p: ProjetoListItem): string {
  const arroba = p.nome.match(/@[\w.]+/)?.[0];
  if (arroba) return arroba;
  return p.clienteNome || p.nome;
}

/** Tarefas que contam pra cada projeto: a atual de cada post (a que define a
 *  etapa, ordem Ordem → Ordem (1)) + as que não são de post. Igual à página
 *  do projeto. */
function tarefasAtuais(tarefas: TarefaDeTodos[], hoje: string): TarefaDeTodos[] {
  const etapas = resumirEtapas(tarefas, hoje);
  const ids = new Set(etapas.flatMap((e) => e.posts.map((p) => p.tarefa.id)));
  return tarefas.filter((t) => ids.has(t.id) || !t.postId || !etapaDaTarefa(t.titulo));
}

export type VisaoGeral = {
  projetos: Map<string, InfoProjeto>;
  porProjeto: Map<string, { todas: TarefaDeTodos[]; atuais: TarefaDeTodos[] }>;
};

export function montarVisaoGeral(
  tarefas: TarefaDeTodos[],
  projetos: ProjetoListItem[],
  hoje: string,
): VisaoGeral {
  const info = new Map<string, InfoProjeto>();
  for (const p of projetos) {
    info.set(semTr(p.id), {
      projetoId: p.id,
      projetoNome: p.nome,
      rotulo: rotuloDoProjeto(p),
      clienteNome: p.clienteNome,
    });
  }
  const grupos = new Map<string, TarefaDeTodos[]>();
  for (const t of tarefas) {
    if (!t.projetoId) continue;
    const k = semTr(t.projetoId);
    if (!info.has(k)) continue; // projeto de cliente inativo: fora do dashboard
    const g = grupos.get(k) ?? [];
    g.push(t);
    grupos.set(k, g);
  }
  const porProjeto = new Map<string, { todas: TarefaDeTodos[]; atuais: TarefaDeTodos[] }>();
  for (const [k, todas] of grupos) porProjeto.set(k, { todas, atuais: tarefasAtuais(todas, hoje) });
  return { projetos: info, porProjeto };
}

// ---------------------------------------------------------------------------
// Esta semana (todos os clientes)
// ---------------------------------------------------------------------------

export type TarefaDoDia = {
  chave: string;
  tarefaId: string;
  ids: string[];
  titulo: string;
  postId: string;
  postTitulo: string;
  posts: string[];
  prazo: string | null;
  atrasada: boolean;
  comCliente: boolean;
  entregaId: string | null;
  projetoId: string;
  rotulo: string;
};

export type DiaGeral = {
  iso: string;
  rotulo: string;
  num: string;
  hoje: boolean;
  passado: boolean;
  tarefas: TarefaDoDia[];
};

/** Semana de segunda a domingo, tarefas de todos os projetos. O que venceu
 *  entra em hoje; tarefas iguais do mesmo cliente no mesmo dia viram um card. */
export function semanaGeral(v: VisaoGeral, hoje: string): DiaGeral[] {
  let dias: DiaGeral[] | null = null;
  for (const [k, { atuais }] of v.porProjeto) {
    const p = v.projetos.get(k)!;
    const semana = semanaDoProjeto(atuais, hoje);
    if (!dias) dias = semana.map((d) => ({ iso: d.iso, rotulo: d.rotulo, num: d.num, hoje: d.hoje, passado: d.passado, tarefas: [] }));
    semana.forEach((d, i) => {
      for (const t of d.tarefas) {
        dias![i].tarefas.push({
          chave: `${k}|${t.tarefaId}`,
          tarefaId: t.tarefaId,
          ids: t.ids,
          titulo: t.titulo,
          postId: t.postId,
          postTitulo: t.postTitulo,
          posts: t.posts,
          prazo: t.prazo,
          atrasada: t.atrasada,
          comCliente: t.comCliente,
          entregaId: t.entregaId ?? null,
          projetoId: p.projetoId,
          rotulo: p.rotulo,
        });
      }
    });
  }
  if (!dias) dias = semanaDoProjeto([], hoje).map((d) => ({ ...d, tarefas: [] }));
  for (const d of dias) {
    d.tarefas.sort(
      (a, b) => Number(b.atrasada) - Number(a.atrasada) || (a.prazo ?? '').localeCompare(b.prazo ?? '') || a.rotulo.localeCompare(b.rotulo),
    );
  }
  return dias;
}

// ---------------------------------------------------------------------------
// Próximos 30 dias (todos os clientes)
// ---------------------------------------------------------------------------

/** Rotina diária e semanal dos posts (arte, aprovação, envio, programação,
 *  conferência): já aparece em "Esta semana", então não vira marco. */
const ROTINA = /^(arte\b|aprova[cç][aã]o \| (arte|post)|altera[cç][aã]o \||enviar post|programar|conferir postagem|confer[eê]ncia de post)/i;

export type MarcoGeral = {
  chave: string;
  data: string;
  dias: number;
  titulo: string;
  comCliente: boolean;
  /** Um por cliente: etiqueta, quantos posts e o link da entrega. */
  clientes: { projetoId: string; rotulo: string; detalhe: string; entregaId: string | null; postId: string; tarefaId: string }[];
};

/** Marcos dos próximos 30 dias: a mesma tarefa no mesmo dia junta os clientes
 *  ("Entrega de briefing e copy · 3 clientes"). */
export function marcosGerais(v: VisaoGeral, hoje: string): MarcoGeral[] {
  const map = new Map<string, MarcoGeral>();
  for (const [k, { todas }] of v.porProjeto) {
    const p = v.projetos.get(k)!;
    for (const m of marcosDosProximos30(todas, hoje)) {
      if (ROTINA.test(m.titulo)) continue;
      const chave = `${m.data}|${m.titulo.toLowerCase()}`;
      const g = map.get(chave) ?? { chave, data: m.data, dias: m.dias, titulo: m.titulo, comCliente: m.comCliente, clientes: [] };
      g.clientes.push({
        projetoId: p.projetoId,
        rotulo: p.rotulo,
        detalhe: m.detalhe,
        entregaId: m.itens.find((i) => i.entregaId)?.entregaId ?? null,
        postId: m.itens[0]?.postId ?? '',
        tarefaId: m.itens[0]?.tarefaId ?? '',
      });
      map.set(chave, g);
    }
  }
  return [...map.values()].sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo));
}

// ---------------------------------------------------------------------------
// Tabela de projetos (Precisa de você / Em dia)
// ---------------------------------------------------------------------------

export type LinhaProjeto = {
  projetoId: string;
  nome: string;
  rotulo: string;
  clienteNome: string;
  clienteId: string;
  servico: string;
  foto: string | null;
  postsNoAr: number;
  postsMes: number;
  atrasadas: number;
  comCliente: number;
  acao: string | null;
  acaoPrazo: string | null;
  /** "3 atrasadas", "vence hoje", "amanhã", "em 4 dias"… */
  chip: string;
  nivel: NivelPrazo;
  precisa: boolean;
};

function textoChip(prazo: string | null, hoje: string): string {
  if (!prazo) return 'sem data';
  const d = diasEntre(hoje, prazo);
  if (d < 0) return d === -1 ? 'venceu ontem' : `venceu há ${-d} dias`;
  if (d === 0) return 'vence hoje';
  if (d === 1) return 'amanhã';
  return `em ${d} dias`;
}

export function linhasDosProjetos(
  v: VisaoGeral,
  projetos: ProjetoListItem[],
  postsDoMes: PostCalendario[],
  fotos: Map<string, string | null>,
  hoje: string,
): LinhaProjeto[] {
  const posts = new Map<string, { noAr: number; total: number }>();
  for (const p of postsDoMes) {
    const k = semTr(p.projetoId);
    const c = posts.get(k) ?? { noAr: 0, total: 0 };
    c.total += 1;
    if (p.cor === 'publicado') c.noAr += 1;
    posts.set(k, c);
  }
  return projetos.map((p) => {
    const k = semTr(p.id);
    const atuais = [...(v.porProjeto.get(k)?.atuais ?? [])].sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
    const atrasadas = atuais.filter((t) => t.prazo && t.prazo < hoje).length;
    const proxima = atuais[0] ?? null;
    const nivel = nivelDoPrazo(proxima?.prazo ?? null, hoje);
    const pc = posts.get(k) ?? { noAr: 0, total: 0 };
    return {
      projetoId: p.id,
      nome: p.nome,
      rotulo: rotuloDoProjeto(p),
      clienteNome: p.clienteNome,
      clienteId: p.clienteId,
      servico: classificarProjeto(p.nome),
      foto: fotos.get(p.id) ?? null,
      postsNoAr: pc.noAr,
      postsMes: pc.total,
      atrasadas,
      comCliente: atuais.filter((t) => ehTarefaDoCliente(t.titulo)).length,
      acao: proxima ? (proxima.postTitulo ? `${proxima.titulo} · “${proxima.postTitulo}”` : proxima.titulo) : null,
      acaoPrazo: proxima?.prazo ?? null,
      chip: atrasadas > 0 ? `${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : proxima ? textoChip(proxima.prazo, hoje) : 'nada aberto',
      nivel: atrasadas > 0 ? 'atrasado' : nivel,
      precisa: atrasadas > 0 || nivel === 'hoje',
    };
  });
}

