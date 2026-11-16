/**
 * Status do post no card do calendário: o mesmo do Notion ("Status Geral"),
 * sem emoji, com a palavra do Notion ("Postado"). Mesma regra do calendário
 * da Dashboard, pra os dois falarem igual.
 */
import type { PostCalendario } from '@/lib/notion';
import type { St } from '../../_ui/lud';

const COR_ST: Record<PostCalendario['cor'], St> = {
  publicado: 'ok',
  agendado: 'info',
  aprovacao: 'cli',
  alteracao: 'atr',
  aguardando: 'hoje',
  rascunho: 'neu',
};

export function statusDoPost(p: PostCalendario): { rotulo: string; st: St } {
  const limpo = (x: string | null | undefined) => (x ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (p.etapa === 'publicado') return { rotulo: 'Postado', st: 'ok' };
  const geral = limpo(p.statusGeral);
  const texto = geral || (p.etapa === 'rascunho' ? limpo(p.status) || 'Sem status' : p.etapaLabel);
  const t = texto.toLowerCase();
  const st: St = /postad|publicad/.test(t)
    ? 'ok'
    : /altera/.test(t)
      ? 'atr'
      : /aprova/.test(t)
        ? 'cli'
        : /programar/.test(t)
          ? 'prog'
          : /programa|agenda|conferir/.test(t)
          ? 'info'
          : /material|envio|informa|direcionamento/.test(t)
            ? 'hoje'
            : geral
              ? 'cheg'
              : COR_ST[p.cor] ?? 'neu';
  return { rotulo: texto, st };
}
