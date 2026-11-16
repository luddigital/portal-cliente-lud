/** Tipos e utilitários da conferência que podem ir pro navegador (sem Supabase). */

export type Conferencia = {
  postId: string;
  data: string;
  resultado: 'no_ar' | 'nao_publicado' | 'divergencia';
  linkInstagram: string | null;
  whatsappStatus: 'enviado' | 'falhou' | 'nao_enviado' | null;
  detalhe: string | null;
  conferidoEm: string;
};

/** "10h", "10:00", "Postar às 9h30" → minutos do dia (600). */
export function minutosDoHorario(h: string | null | undefined): number | null {
  const m = (h ?? '').match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] ?? 0);
}
