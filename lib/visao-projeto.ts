/**
 * Visão geral do projeto (página única): monta, a partir das tarefas abertas,
 * os blocos da página — cards de entregas por com quem está (opção E), os
 * próximos 30 dias, a semana dia a dia e o próximo passo. Arquivo puro, sem
 * banco: recebe as tarefas já lidas do Notion. Datas sempre YYYY-MM-DD no fuso
 * de São Paulo.
 */
import type { TarefaDoProjeto } from './notion';
import { ehTarefaDoCliente, type ResumoEtapa } from './etapas-projeto';

const DIA_MS = 86_400_000;
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function utc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / DIA_MS);
}
export function somarDias(iso: string, n: number): string {
  return new Date(utc(iso) + n * DIA_MS).toISOString().slice(0, 10);
}
export function diaDaSemana(iso: string): number {
  return new Date(utc(iso)).getUTCDay();
}
export function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
export function nomeDiaLongo(iso: string): string {
  return SEMANA_LONGA[diaDaSemana(iso)];
}

/** Cor da bolinha pelo prazo (design system › prazos). */
export type NivelPrazo = 'atrasado' | 'hoje' | 'chegando' | 'em-dia' | 'sem';
export function nivelDoPrazo(prazo: string | null, hoje: string): NivelPrazo {
  if (!prazo) return 'sem';
  const d = diasEntre(hoje, prazo);
  if (d < 0) return 'atrasado';
  if (d === 0) return 'hoje';
  if (d <= 2) return 'chegando';
  return 'em-dia';
}

/** "ATRASADA", "HOJE", "AMANHÃ", "QUARTA" (até 6 dias) ou "28/10". */
export function quandoVence(prazo: string | null, hoje: string): string {
  if (!prazo) return 'SEM DATA';
  const d = diasEntre(hoje, prazo);
  if (d < 0) return 'ATRASADA';
  if (d === 0) return 'HOJE';
  if (d === 1) return 'AMANHÃ';
  if (d <= 6) return SEMANA_LONGA[diaDaSemana(prazo)].toUpperCase();
  return ddmm(prazo);
}

// ---------------------------------------------------------------------------
// Cards de entregas (opção E)
// ---------------------------------------------------------------------------

export type ItemCard = {
  postId: string;
  postTitulo: string;
  tarefaId: string;
  prazo: string | null;
  /** Entrega do Notion da tarefa: o clique leva pra página dela, filtrada no cliente. */
  entregaId?: string | null;
};

export type CardEntrega = {
  chave: string;
  /** Nome da tarefa como está no Notion ("Aprovação | Post"). */
  titulo: string;
  /** Etiqueta de cima: "ATRASADA · SEMANAL", "QUARTA", "28/10"… */
  tag: string;
  nivel: NivelPrazo;
  comCliente: boolean;
  /** Número grande: atrasadas quando tem atraso, senão o total. */
  n: number;
  /** Linha ao lado do número: "atrasada há 34 dias", "vence em 2 dias". */
  sub: string;
  /** Posts da entrega, do mais urgente pro menos. */
  itens: ItemCard[];
  /** Link da entrega (dashboard). Na página do projeto o clique abre o post. */
  href?: string;
  /** Rótulo do botão: "Lembrar no grupo", "Programar", "Abrir". */
  acao: string;
};

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function rotuloAcao(titulo: string, comCliente: boolean): string {
  if (comCliente) return 'Lembrar no grupo';
  const t = titulo.toLowerCase();
  if (/programar/.test(t)) return 'Programar';
  if (/enviar post/.test(t)) return 'Enviar';
  if (/conferir/.test(t)) return 'Conferir';
  return 'Abrir';
}

function chave(t: string) {
  return t.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Um card por tarefa atual dos posts (a etapa em que cada post está agora). */
export function cardsDoProjeto(etapas: ResumoEtapa[], hoje: string): CardEntrega[] {
  const grupos = new Map<string, { titulo: string; itens: ItemCard[] }>();
  for (const e of etapas) {
    for (const p of e.posts) {
      const k = chave(p.tarefa.titulo);
      const g = grupos.get(k) ?? { titulo: p.tarefa.titulo.trim(), itens: [] };
      g.itens.push({
        postId: p.postId,
        postTitulo: p.postTitulo,
        tarefaId: p.tarefa.id,
        prazo: p.tarefa.prazo,
        entregaId: p.tarefa.entregaId ?? null,
      });
      grupos.set(k, g);
    }
  }
  const cards: CardEntrega[] = [];
  for (const [k, g] of grupos) {
    const itens = [...g.itens].sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
    const atrasadas = itens.filter((i) => i.prazo && i.prazo < hoje);
    const primeiro = itens[0].prazo;
    const comCliente = ehTarefaDoCliente(g.titulo);
    // Etiqueta diz o quando ("ATRASADA HÁ 13 DIAS", "HOJE"); a linha do número
    // fica curta pra nunca quebrar ao lado do botão.
    const varios = itens.length > 1;
    let tag: string;
    let sub: string;
    if (atrasadas.length) {
      const dias = diasEntre(atrasadas[0].prazo!, hoje);
      tag = dias === 1 ? 'ATRASADA DESDE ONTEM' : `ATRASADA HÁ ${dias} DIAS`;
      sub = atrasadas.length === 1 ? 'atrasada' : 'atrasadas';
    } else if (primeiro) {
      const d = diasEntre(hoje, primeiro);
      tag = quandoVence(primeiro, hoje);
      if (d === 0) sub = varios ? 'vencem hoje' : 'vence hoje';
      else if (d === 1) sub = varios ? 'vencem amanhã' : 'vence amanhã';
      else sub = varios ? `a 1ª em ${d} dias` : `vence em ${d} dias`;
    } else {
      tag = 'SEM DATA';
      sub = 'sem data';
    }
    cards.push({
      chave: k,
      titulo: g.titulo,
      tag,
      nivel: nivelDoPrazo(primeiro, hoje),
      comCliente,
      n: atrasadas.length || itens.length,
      sub,
      itens,
      acao: rotuloAcao(g.titulo, comCliente),
    });
  }
  return ordenarCards(cards, hoje);
}

/** Atrasadas primeiro (mais antigas antes), depois pelo prazo mais próximo. */
export function ordenarCards(cards: CardEntrega[], hoje: string): CardEntrega[] {
  const peso = (c: CardEntrega) => {
    const p = c.itens[0]?.prazo ?? null;
    if (!p) return 99999;
    return diasEntre(hoje, p);
  };
  return [...cards].sort((a, b) => peso(a) - peso(b));
}

// ---------------------------------------------------------------------------
// Próximos 30 dias e semana
// ---------------------------------------------------------------------------

export type Marco = {
  chave: string;
  data: string;
  titulo: string;
  detalhe: string;
  comCliente: boolean;
  dias: number;
  itens: ItemCard[];
};

/** Tarefas abertas dos próximos 30 dias, juntando a mesma tarefa no mesmo dia. */
export function marcosDosProximos30(tarefas: TarefaDoProjeto[], hoje: string): Marco[] {
  const limite = somarDias(hoje, 30);
  const map = new Map<string, Marco>();
  for (const t of tarefas) {
    if (!t.prazo || t.prazo < hoje || t.prazo > limite) continue;
    const k = `${t.prazo}|${chave(t.titulo)}`;
    const m = map.get(k) ?? {
      chave: k,
      data: t.prazo,
      titulo: t.titulo.trim(),
      detalhe: '',
      comCliente: ehTarefaDoCliente(t.titulo),
      dias: diasEntre(hoje, t.prazo),
      itens: [],
    };
    m.itens.push({
      postId: t.postId ?? '',
      postTitulo: t.postTitulo ?? t.titulo,
      tarefaId: t.id,
      prazo: t.prazo,
      entregaId: t.entregaId ?? null,
    });
    map.set(k, m);
  }
  const lista = [...map.values()].sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo));
  for (const m of lista) {
    m.detalhe = m.itens.length === 1 ? `“${m.itens[0].postTitulo}”` : plural(m.itens.length, 'post', 'posts');
  }
  return lista;
}

export type DiaSemana = {
  iso: string;
  rotulo: string;
  num: string;
  hoje: boolean;
  passado: boolean;
  tarefas: (ItemCard & {
    titulo: string;
    atrasada: boolean;
    comCliente: boolean;
    /** Tarefas iguais do dia juntas num card (ids de todas). */
    ids: string[];
    /** Títulos dos posts das tarefas juntas. */
    posts: string[];
  })[];
};

/** Semana de segunda a domingo. O que está atrasado entra no dia de hoje. */
export function semanaDoProjeto(tarefas: TarefaDoProjeto[], hoje: string): DiaSemana[] {
  const seg = somarDias(hoje, -((diaDaSemana(hoje) + 6) % 7));
  const dias: DiaSemana[] = Array.from({ length: 7 }, (_, i) => {
    const iso = somarDias(seg, i);
    return {
      iso,
      rotulo: SEMANA[diaDaSemana(iso)],
      num: iso.slice(8, 10),
      hoje: iso === hoje,
      passado: iso < hoje,
      tarefas: [],
    };
  });
  const fim = dias[6].iso;
  for (const t of tarefas) {
    if (!t.prazo || t.prazo > fim) continue;
    // Tarefa de calendário do mês é macro: não entra no "o que fazer em cada dia".
    if (/^calend[aá]rio\b/i.test(t.titulo.trim())) continue;
    const atrasada = t.prazo < hoje;
    const alvo = atrasada ? hoje : t.prazo;
    const dia = dias.find((d) => d.iso === alvo);
    if (!dia) continue;
    // Tarefas iguais no mesmo dia viram um card só ("Criação de Pauta · 5 posts").
    const igual = dia.tarefas.find((x) => chave(x.titulo) === chave(t.titulo));
    if (igual) {
      igual.ids.push(t.id);
      if (t.postTitulo) igual.posts.push(t.postTitulo);
      if (t.prazo < (igual.prazo ?? '9999')) igual.prazo = t.prazo;
      igual.atrasada = igual.atrasada || atrasada;
      igual.entregaId = igual.entregaId ?? t.entregaId ?? null;
      continue;
    }
    dia.tarefas.push({
      postId: t.postId ?? '',
      postTitulo: t.postTitulo ?? '',
      tarefaId: t.id,
      prazo: t.prazo,
      titulo: t.titulo.trim(),
      atrasada,
      comCliente: ehTarefaDoCliente(t.titulo),
      ids: [t.id],
      posts: t.postTitulo ? [t.postTitulo] : [],
      entregaId: t.entregaId ?? null,
    });
  }
  for (const d of dias) {
    d.tarefas.sort((a, b) => Number(b.atrasada) - Number(a.atrasada) || (a.prazo ?? '').localeCompare(b.prazo ?? ''));
  }
  return dias;
}
