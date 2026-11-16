import type { CardEsteiraNotion } from '@/lib/notion';
import type { EtapaEsteira } from './EsteiraNova';

/** Etapa do card no layout novo: pela tarefa (Alteração/Aprovação) ou, no B&C, se já tem copy e o status. */
export function etapaDoCard(c: CardEsteiraNotion): EtapaEsteira {
  if (/^altera/i.test(c.entregaNome) || c.coluna === 'reaprovacao') return 'alteracao';
  if (c.coluna === 'revisar') return 'aprovacao';
  if (/andamento|acompanhar/i.test(c.status ?? '')) return 'andamento';
  return 'nao';
}
