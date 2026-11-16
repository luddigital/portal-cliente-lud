import type { ReactNode } from 'react';

/**
 * Substitui o <Suspense> das páginas do servidor.
 *
 * Com <Suspense> dentro da página, todo router.refresh() (concluir tarefa, aprovar, atualizar…)
 * mostrava o esqueleto cinza de novo e a tela "piscava em branco". Sem ele, a página espera os
 * dados no servidor e troca o conteúdo de uma vez, sem resetar a tela. No primeiro carregamento
 * quem mostra o esqueleto é o loading.tsx da rota.
 * Regra no DESIGN_SYSTEM.md: não usar <Suspense> em página do servidor.
 */
export function SemPiscar({ children }: { children: ReactNode; fallback?: ReactNode }) {
  return <>{children}</>;
}
