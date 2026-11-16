import Link from 'next/link';

export { rotas, nomeCurtoDoProjeto } from '@/lib/rotas';

/**
 * Caminho da página (hierarquia do portal):
 * Projetos › @projeto › Entregas › Aprovação | Post › tarefa.
 * O último item é a página atual (sem link).
 */
export type ItemTrilha = { rotulo: string; href?: string };

export function Trilha({ itens, className = '' }: { itens: ItemTrilha[]; className?: string }) {
  return (
    <nav aria-label="Caminho" className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-t2 ${className}`}>
      {itens.map((it, i) => {
        const ultimo = i === itens.length - 1;
        return (
          <span key={`${it.rotulo}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {it.href && !ultimo ? (
              <Link href={it.href} className="truncate transition hover:text-ink hover:underline">
                {it.rotulo}
              </Link>
            ) : (
              <span className={`truncate ${ultimo ? 'font-semibold text-ink' : ''}`} aria-current={ultimo ? 'page' : undefined}>
                {it.rotulo}
              </span>
            )}
            {!ultimo && <span aria-hidden>›</span>}
          </span>
        );
      })}
    </nav>
  );
}
