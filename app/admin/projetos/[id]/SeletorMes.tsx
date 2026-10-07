'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

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
  const [carregando, startTransition] = useTransition();
  const ir = (href: string) => startTransition(() => router.push(href, { scroll: false }));
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
