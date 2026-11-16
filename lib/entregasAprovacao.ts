/**
 * Reaprovação (Ordem (1) = 03) mora na página própria da aprovação (Aprovação | Post,
 * Aprovação | Arte…), e não mais na entrega genérica "Aprovações". No Notion a tarefa
 * continua ligada a "Aprovações"; o portal remapeia pelo título.
 */
export const ENTREGA_APROVACOES = '2e9d04d23b4a80a68ea9d1602cf286f9';

const POR_ETAPA: [RegExp, string][] = [
  [/\|\s*post\s*$/i, '2b5d04d23b4a804d9176c7a743f336d1'], // Aprovação | Post
  [/\|\s*arte\s*$/i, '2b5d04d23b4a80959238c502567bdce2'], // Aprovação | Arte
  [/\|\s*pauta\s*$/i, '2b5d04d23b4a8017b2d1e150501265ea'], // Aprovação | Pauta
  [/\|\s*materia/i, '2b5d04d23b4a80a6b5b9e47e1ea2ac49'], // Aprovação | Materiais para Produção
];

const semTraco = (s: string) => s.replace(/-/g, '');

/** Entrega própria da aprovação pelo título da tarefa ("Aprovação | Post" → entrega Aprovação | Post). */
export function entregaDaAprovacao(titulo: string | null | undefined): string | null {
  const t = (titulo ?? '').trim();
  if (!/^aprova[çc][ãa]o\s*\|/i.test(t)) return null;
  return POR_ETAPA.find(([rx]) => rx.test(t))?.[1] ?? null;
}

/** Essa entrega recebe as reaprovações que estão ligadas a "Aprovações" no Notion? */
export function recebeReaprovacoes(entregaId: string): boolean {
  return POR_ETAPA.some(([, id]) => id === semTraco(entregaId));
}

export function ehEntregaAprovacoes(entregaId: string): boolean {
  return semTraco(entregaId) === ENTREGA_APROVACOES;
}
