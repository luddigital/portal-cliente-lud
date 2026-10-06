/**
 * Helpers de semana pro portal.
 * **A semana no portal SEMPRE começa na SEGUNDA-FEIRA.**
 * Se precisar mostrar dias, use `DIAS_ABREV` (Seg → Dom).
 */

/** Retorna a segunda-feira da semana da data recebida (00:00 local). */
export function inicioDaSemana(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const diff = (x.getDay() + 6) % 7; // 0 = segunda, 1 = terça, ..., 6 = domingo
  x.setDate(x.getDate() - diff);
  return x;
}

/** Formata date como YYYY-MM-DD no fuso local. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Nomes dos dias da semana em maiúsculas curtas, começando na segunda. */
export const DIAS_ABREV = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const;

/** Índice do dia na semana (0=segunda ... 6=domingo). */
export function indiceDiaSemana(d: Date): number {
  return (d.getDay() + 6) % 7;
}
