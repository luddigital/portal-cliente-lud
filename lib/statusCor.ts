import type { PostCalendario } from './notion';

export type CorStatus = { bg: string; fg: string };

/**
 * Cor do chip de status pro card de post no calendário.
 *
 * Usamos primeiro o `statusGeral` do Notion (mais específico — separa
 * "Programar" e "Conferir Postagem" que caíam na mesma cor via `p.cor`).
 * Se não bater com nenhum caso conhecido, cai no fallback de `p.cor`
 * (mapeamento por etapa: publicado/agendado/aprovacao/alteracao/etc).
 */
export function corDoStatus(p: PostCalendario): CorStatus {
  const sg = (p.statusGeral ?? '').trim().toLowerCase();

  if (sg.includes('conferir postagem')) {
    // Data futura: programado, ainda não foi ao ar.
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    if (p.data && p.data.slice(0, 10) > hoje) return { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' };
    return { bg: 'var(--cal-conferir-soft)', fg: 'var(--cal-conferir)' };
  }
  if (sg.includes('postado')) {
    return { bg: 'var(--cal-publicado-soft)', fg: 'var(--cal-publicado)' };
  }
  if (sg.includes('programar')) {
    return { bg: 'var(--cal-programar-soft)', fg: 'var(--cal-programar)' };
  }

  return {
    bg: `var(--cal-${p.cor}-soft)`,
    fg: `var(--cal-${p.cor})`,
  };
}
