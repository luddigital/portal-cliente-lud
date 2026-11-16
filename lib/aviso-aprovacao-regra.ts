/** Regra pura dos avisos automáticos de aprovação (sem banco), pra testar e reusar. */
export const HORAS_MINIMAS = 5;
export const MAX_AUTOS = 2;
export type TipoAviso = 'post' | 'reaprovacao' | 'auto_hoje' | 'auto_ontem';
export type MotivoParado = 'antigo' | 'limite' | 'sem_grupo';

/** Dia (YYYY-MM-DD) de um instante no fuso de São Paulo. */
export function diaSp(iso: string | number | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}
function somaDia(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
/** Último dia útil antes de `dia` (segunda → sexta). */
function diaUtilAnterior(dia: string): string {
  let d = somaDia(dia, -1);
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = somaDia(d, -1);
  return d;
}

/** Decide o que fazer com um post, pelo histórico do grupo. */
export function decidirAviso(
  historico: { ultimo: string; autos: number } | undefined,
  agora: Date,
  reaprovacao: boolean,
): { acao: 'enviar'; tipo: TipoAviso } | { acao: 'esperar'; liberaEm: string } | { acao: 'parar'; motivo: MotivoParado } {
  if (!historico) return { acao: 'enviar', tipo: reaprovacao ? 'reaprovacao' : 'post' };
  const horas = (agora.getTime() - Date.parse(historico.ultimo)) / 3_600_000;
  if (horas < HORAS_MINIMAS) {
    return { acao: 'esperar', liberaEm: new Date(Date.parse(historico.ultimo) + HORAS_MINIMAS * 3_600_000).toISOString() };
  }
  if (historico.autos >= MAX_AUTOS) return { acao: 'parar', motivo: 'limite' };
  const hoje = diaSp(agora);
  const diaEnvio = diaSp(historico.ultimo);
  if (diaEnvio === hoje) return { acao: 'enviar', tipo: 'auto_hoje' };
  if (diaEnvio === somaDia(hoje, -1) || diaEnvio >= diaUtilAnterior(hoje)) return { acao: 'enviar', tipo: 'auto_ontem' };
  return { acao: 'parar', motivo: 'antigo' };
}

