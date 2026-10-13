/**
 * Status de prazo único de TODO o sistema — mesma lógica, copy e emojis da
 * fórmula "Prazo Geral" do Notion. Baseia-se na Data de Entrega (prazo) e, se a
 * tarefa está concluída, compara "Finalizada em" com a entrega.
 *
 * Use statusPrazo() em qualquer lugar que mostre prazo pra manter tudo igual.
 */

export type PrazoChave =
  | 'entregue-no-prazo'
  | 'entregue-com-atraso'
  | 'concluido'
  | 'sem-data'
  | 'amanha'
  | 'hoje'
  | 'chegando'
  | 'proxima-semana'
  | 'no-radar'
  | 'atrasado';

export type PrazoStatus = {
  chave: PrazoChave;
  emoji: string;
  /** Texto sem emoji, ex: "Atrasado". */
  texto: string;
  /** Emoji + texto, ex: "🚨 Atrasado". */
  label: string;
  cor: string;
  corSoft: string;
  concluido: boolean;
};

const TABELA: Record<PrazoChave, { emoji: string; texto: string; cor: string; corSoft: string }> = {
  'entregue-no-prazo': { emoji: '✅', texto: 'Entregue no Prazo', cor: 'var(--prazo-em-dia)', corSoft: 'var(--prazo-em-dia-soft)' },
  'entregue-com-atraso': { emoji: '☑️', texto: 'Entregue com Atraso', cor: 'var(--prazo-chegando)', corSoft: 'var(--prazo-chegando-soft)' },
  concluido: { emoji: '✅', texto: 'Concluído', cor: 'var(--prazo-em-dia)', corSoft: 'var(--prazo-em-dia-soft)' },
  'sem-data': { emoji: '🕓', texto: 'Sem Data Planejada', cor: 'var(--prazo-tranquilo)', corSoft: 'var(--prazo-tranquilo-soft)' },
  amanha: { emoji: '👀', texto: 'Amanhã', cor: 'var(--prazo-hoje)', corSoft: 'var(--prazo-hoje-soft)' },
  hoje: { emoji: '🔥', texto: 'Hoje', cor: 'var(--prazo-hoje)', corSoft: 'var(--prazo-hoje-soft)' },
  chegando: { emoji: '🚧', texto: 'Chegando', cor: 'var(--prazo-chegando)', corSoft: 'var(--prazo-chegando-soft)' },
  'proxima-semana': { emoji: '🤙', texto: 'Próxima Semana', cor: 'var(--cal-agendado)', corSoft: 'var(--cal-agendado-soft)' },
  'no-radar': { emoji: '🔮', texto: 'No Radar', cor: 'var(--prazo-tranquilo)', corSoft: 'var(--prazo-tranquilo-soft)' },
  atrasado: { emoji: '🚨', texto: 'Atrasado', cor: 'var(--prazo-atrasado)', corSoft: 'var(--prazo-atrasado-soft)' },
};

const CONCLUIDO_STATUS = new Set([
  'Concluído',
  'Concluida',
  'Concluída',
  'Reprovado',
  'Excluído',
  'Excluída',
]);

function soData(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Diferença em dias de calendário entre duas datas ISO (a - b). */
function diffDiasCal(aIso: string, bIso: string): number | null {
  const a = soData(aIso);
  const b = soData(bIso);
  if (!a || !b) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function mk(chave: PrazoChave, concluido: boolean): PrazoStatus {
  const t = TABELA[chave];
  return {
    chave,
    emoji: t.emoji,
    texto: t.texto,
    label: `${t.emoji} ${t.texto}`,
    cor: t.cor,
    corSoft: t.corSoft,
    concluido,
  };
}

export function statusPrazo({
  dataEntrega,
  status,
  finalizadaEm,
  concluido,
  agora,
}: {
  /** Data de entrega / prazo (ISO AAAA-MM-DD). */
  dataEntrega: string | null;
  /** Nome do status no Notion (pra detectar concluído/reprovado/excluído). */
  status?: string | null;
  /** Data de conclusão (ISO), pra decidir "no prazo" vs "com atraso". */
  finalizadaEm?: string | null;
  /** Override: força tratar como concluído (quando o caller já sabe). */
  concluido?: boolean;
  agora?: Date;
}): PrazoStatus {
  const hojeISO = ymdLocal(agora ?? new Date());
  const estaConcluido = concluido ?? (status ? CONCLUIDO_STATUS.has(status.trim()) : false);

  if (estaConcluido) {
    if (finalizadaEm && dataEntrega) {
      const d = diffDiasCal(finalizadaEm.slice(0, 10), dataEntrega.slice(0, 10));
      if (d !== null && d <= 0) return mk('entregue-no-prazo', true);
      return mk('entregue-com-atraso', true);
    }
    return mk('concluido', true);
  }

  if (!dataEntrega) return mk('sem-data', false);
  const dias = diffDiasCal(dataEntrega.slice(0, 10), hojeISO);
  if (dias === null) return mk('sem-data', false);

  if (dias === 1) return mk('amanha', false);
  if (dias === 0) return mk('hoje', false);
  if (dias > 0) {
    if (dias <= 7) return mk('chegando', false);
    if (dias <= 15) return mk('proxima-semana', false);
    return mk('no-radar', false);
  }
  return mk('atrasado', false);
}
