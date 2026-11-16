/** "10:00" → "10h"; "9h30" fica. Fora do NovoLud ('use client') pra página do servidor poder usar. */
export function horaCurta(h: string | null | undefined): string | null {
  if (!h) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(h.trim());
  if (m) return m[2] === '00' ? `${Number(m[1])}h` : `${Number(m[1])}h${m[2]}`;
  return h.trim();
}
