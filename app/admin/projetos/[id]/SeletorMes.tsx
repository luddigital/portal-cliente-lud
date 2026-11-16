'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Troca o mês do calendário sem rolar a página; esmaece enquanto carrega. */
export function SeletorMes({
  rotulo,
  hrefAnterior,
  hrefProximo,
}: {
  rotulo: string;
  hrefAnterior: string;
  hrefProximo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [carregando, startTransition] = useTransition();
  // scroll: false do App Router costuma funcionar, mas quando o Suspense pai
  // tem key dependente da URL (não é o nosso caso, mas é defensivo) ou algum
  // layout muda de altura entre meses, o scroll pode escapar. Salvamos a
  // posição antes do push e restauramos depois da transição completar.
  const scrollSalvo = useRef<number | null>(null);
  useEffect(() => {
    if (scrollSalvo.current !== null && !carregando) {
      const y = scrollSalvo.current;
      scrollSalvo.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior }));
      });
    }
  }, [carregando, searchParams]);

  const ir = (href: string) => {
    scrollSalvo.current = window.scrollY;
    startTransition(() => router.push(href, { scroll: false }));
  };
  const btn =
    'flex h-8 w-8 items-center justify-center rounded-[9px] border border-[rgba(21,21,33,0.12)] bg-white text-t2 transition hover:bg-bgSoft disabled:opacity-50';

  return (
    <div className="mb-3 flex items-center gap-2">
      <button type="button" onClick={() => ir(hrefAnterior)} disabled={carregando} className={btn} aria-label="Mês anterior">
        ‹
      </button>
      <span
        className={`min-w-[128px] text-center text-[14px] font-semibold capitalize text-ink transition-opacity ${
          carregando ? 'opacity-40' : ''
        }`}
        aria-live="polite"
      >
        {rotulo}
      </span>
      <button type="button" onClick={() => ir(hrefProximo)} disabled={carregando} className={btn} aria-label="Próximo mês">
        ›
      </button>
    </div>
  );
}
