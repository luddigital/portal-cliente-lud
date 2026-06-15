/**
 * Classifica o projeto por serviço pelo prefixo do nome.
 * Padrões da Lud:
 *   IG | @x          → Instagram
 *   TTK | x          → TikTok
 *   Stories | x      → Stories
 *   Tráfego Pago x   → Tráfego Pago
 *   Site x           → Site
 *   LP | x           → Landing Page
 *   E-book x         → E-book
 *   Mentoria x       → Mentoria
 *   Consultoria | x  → Consultoria
 *   Grupo / Grupos   → Grupos
 *   ID | x           → Identidade visual
 *   Processo Sel.    → Interno
 *   resto            → Outros
 */
export function classificarProjeto(nome: string): string {
  const n = nome.trim();
  if (/^ig\s*\|/i.test(n)) return 'Instagram';
  if (/^ttk\s*\|/i.test(n)) return 'TikTok';
  if (/^stories\s*\|/i.test(n)) return 'Stories';
  if (/^tr[áa]fego\s+pago/i.test(n)) return 'Tráfego Pago';
  if (/^site\b/i.test(n)) return 'Site';
  if (/^lp\s*\|/i.test(n)) return 'Landing Page';
  if (/^e-?book/i.test(n)) return 'E-book';
  if (/^mentoria\b/i.test(n)) return 'Mentoria';
  if (/^consultoria/i.test(n)) return 'Consultoria';
  if (/^grupos?\b/i.test(n)) return 'Grupos';
  if (/^id\s*\|/i.test(n)) return 'Identidade visual';
  if (
    /^processo\s+seletivo/i.test(n) ||
    /^reestrutura/i.test(n) ||
    /^tudo no lugar/i.test(n) ||
    /^portif[óo]lio/i.test(n)
  ) {
    return 'Interno';
  }
  return 'Outros';
}

/**
 * Dado um conjunto de projetos do cliente, escolhe qual deve abrir por
 * padrão na primeira vez (ou ao trocar sem cookie). Prioriza Instagram
 * porque é o serviço principal da Lud; cai pro primeiro projeto se não
 * houver Instagram.
 */
export function escolherProjetoPadrao<T extends { id: string; nome: string }>(
  projetos: readonly T[],
): T | null {
  if (projetos.length === 0) return null;
  const instagram = projetos.find((p) => classificarProjeto(p.nome) === 'Instagram');
  if (instagram) return instagram;
  return projetos[0];
}
