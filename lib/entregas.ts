// ============================================================================
// Entregas — mapeia cada post do calendário para uma ETAPA DE PRODUÇÃO (coluna
// do kanban) e calcula a saúde do prazo (atrasado / hoje / em dia).
//
// A fonte de verdade dos títulos de tarefa é a mesma lógica de `tipoTarefa`
// em app/admin/projetos/[id]/page.tsx (Materiais, Briefing & Copy, Arte,
// Aprovação | *, Programar, Conferir Postagem…). Aqui reduzimos isso às 7
// colunas do quadro de entregas, na ordem do processo de social media.
// ============================================================================

import type { PostCalendario } from './notion';

export type EtapaEntrega =
  | 'pauta'
  | 'briefing'
  | 'materiais'
  | 'arte'
  | 'aprovacao'
  | 'programacao'
  | 'publicado';

/** Colunas do kanban, na ordem do fluxo de produção. `dot` é a cor do marcador. */
export const COLUNAS_ENTREGA: {
  id: EtapaEntrega;
  label: string;
  dot: string;
}[] = [
  { id: 'pauta', label: 'Pauta', dot: 'var(--cal-rascunho)' },
  { id: 'briefing', label: 'Briefing & Copy', dot: 'var(--cal-agendado)' },
  { id: 'materiais', label: 'Materiais', dot: 'var(--cal-aguardando)' },
  { id: 'arte', label: 'Arte', dot: 'var(--cal-alteracao)' },
  { id: 'aprovacao', label: 'Aprovação', dot: 'var(--cal-aprovacao)' },
  { id: 'programacao', label: 'Programação', dot: 'var(--navy)' },
  { id: 'publicado', label: 'Publicado', dot: 'var(--cal-publicado)' },
];

/**
 * Decide em qual coluna de produção um post está. Usa, em ordem:
 *  1. etapa === 'publicado' → Publicado (fim do fluxo)
 *  2. o título da tarefa atual + o Status Geral do Notion (texto livre)
 *  3. fallback pela `etapa` derivada (aprovacao / aguardando / alteracao / …)
 */
export function postParaEtapaEntrega(p: PostCalendario): EtapaEntrega {
  if (p.etapa === 'publicado') return 'publicado';

  const hay = `${p.tarefaAtualTitulo ?? ''} ${p.statusGeral ?? ''}`.toLowerCase();

  // Aprovação: se é "Aprovação | Pauta" ou de calendário, ainda é fase de pauta;
  // qualquer outra aprovação (arte/post/copy/materiais) cai na coluna Aprovação.
  if (/aprova/.test(hay)) {
    if (/pauta|calend|cria[çc][ãa]o/.test(hay)) return 'pauta';
    return 'aprovacao';
  }
  if (/programar|conferir postagem|agendad/.test(hay)) return 'programacao';
  if (/materia|conte[uú]do|pr[eé]vi/.test(hay)) return 'materiais';
  if (/direcionamento|stories/.test(hay)) return 'materiais';
  if (/\barte\b|design/.test(hay)) return 'arte';
  if (/briefing|copy|roteiro|voice/.test(hay)) return 'briefing';
  if (/pauta|calend/.test(hay)) return 'pauta';

  // Fallback pela etapa coarse (quando não há tarefa/statusGeral legível).
  switch (p.etapa) {
    case 'aprovacao':
      return 'aprovacao';
    case 'aguardando':
      return 'materiais';
    case 'alteracao':
      return 'arte';
    default:
      return 'pauta';
  }
}

export type EstadoPrazo =
  | 'atrasado'
  | 'hoje'
  | 'chegando'
  | 'em-dia'
  | 'tranquilo'
  | 'publicado';

export type SaudePrazo = {
  estado: EstadoPrazo;
  /** dias até a data de postagem (negativo = já passou). */
  dias: number;
  /** rótulo curto pra pill (ex.: "atrasado 2d", "hoje", "em 3d"). */
  label: string;
};

/** Diferença em dias inteiros entre a data do post e hoje (ambos YYYY-MM-DD). */
function diffDias(dataIso: string, hojeIso: string): number {
  const a = new Date(`${dataIso.slice(0, 10)}T00:00:00`);
  const b = new Date(`${hojeIso.slice(0, 10)}T00:00:00`);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Saúde do prazo de um post. Regra: enquanto não está publicado, comparamos a
 * data de postagem com hoje. Já passou = atrasado; é hoje = hoje; perto = chegando.
 * (Não há prazo por etapa no Notion, então a data de postagem é o prazo firme.)
 */
export function saudePrazo(p: PostCalendario, hojeIso: string): SaudePrazo {
  if (p.etapa === 'publicado') {
    return { estado: 'publicado', dias: 0, label: 'publicado' };
  }
  if (!p.data) return { estado: 'tranquilo', dias: 999, label: 'sem data' };

  const dias = diffDias(p.data, hojeIso);
  if (dias < 0) return { estado: 'atrasado', dias, label: `atrasado ${Math.abs(dias)}d` };
  if (dias === 0) return { estado: 'hoje', dias, label: 'hoje' };
  if (dias <= 2) return { estado: 'chegando', dias, label: `em ${dias}d` };
  if (dias <= 7) return { estado: 'em-dia', dias, label: 'em dia' };
  return { estado: 'tranquilo', dias, label: 'tranquilo' };
}

/** Faixa colorida do topo do .entrega-card (o DS só tem esses 4 estados). */
export function faixaEntrega(
  p: PostCalendario,
  s: SaudePrazo,
): 'atrasada' | 'hoje' | 'em-dia' | 'aguardando' {
  if (s.estado === 'atrasado') return 'atrasada';
  // Bola com o cliente (aguardando envio / aprovação) → faixa neutra.
  if (p.etapa === 'aguardando' || p.etapa === 'aprovacao') return 'aguardando';
  if (s.estado === 'hoje') return 'hoje';
  return 'em-dia';
}

export type ResumoEntregas = {
  total: number;
  publicados: number;
  emProducao: number;
  aguardandoCliente: number;
  atrasados: number;
  aprovacaoHoje: number;
};

/** Números do topo (banner + hub-task-cards). */
export function resumoEntregas(
  posts: PostCalendario[],
  hojeIso: string,
): ResumoEntregas {
  let publicados = 0;
  let emProducao = 0;
  let aguardandoCliente = 0;
  let atrasados = 0;
  let aprovacaoHoje = 0;

  for (const p of posts) {
    if (p.etapa === 'publicado') {
      publicados++;
      continue;
    }
    const s = saudePrazo(p, hojeIso);
    if (s.estado === 'atrasado') atrasados++;
    if (p.etapa === 'aguardando' || p.etapa === 'aprovacao') {
      aguardandoCliente++;
      if (p.etapa === 'aprovacao' && s.estado === 'hoje') aprovacaoHoje++;
    } else {
      emProducao++;
    }
  }

  return {
    total: posts.length,
    publicados,
    emProducao,
    aguardandoCliente,
    atrasados,
    aprovacaoHoje,
  };
}
