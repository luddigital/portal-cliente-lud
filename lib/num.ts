/** Parse de número no formato PT-BR ("185.000", "4,2%", "1.234,5") → number.
 *  Retorna null se não dá pra extrair um número. Puro, sem dependências —
 *  seguro pra usar no cliente e no servidor. */
export function parseNumBR(s: string | null | undefined): number | null {
  if (!s) return null;
  const limpo = String(s).replace(/[^\d.,-]/g, '');
  if (!limpo) return null;
  // PT-BR: '.' é separador de milhar, ',' é decimal.
  const norm = limpo.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : null;
}

/** Formata número compacto ("170,2k", "1,1M") pra rótulos de meta. */
export function fmtCompacto(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}k`;
  return n.toLocaleString('pt-BR');
}
