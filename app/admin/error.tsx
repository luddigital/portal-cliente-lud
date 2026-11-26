'use client';

import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Se uma tela do admin quebrar, mostra um aviso com "Tentar de novo" em vez da página branca.
 * Depois de publicar uma versão nova, a aba antiga pode pedir um pedaço que não existe mais
 * (ChunkLoadError): aí recarrega sozinha.
 */
export default function ErroAdmin({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const versaoNova = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Loading CSS chunk/i.test(`${error?.name} ${error?.message}`);
  useEffect(() => {
    if (!versaoNova) return;
    try {
      const k = 'lud-recarregou-versao';
      const ultimo = Number(sessionStorage.getItem(k) ?? 0);
      if (Date.now() - ultimo < 30_000) return;
      sessionStorage.setItem(k, String(Date.now()));
    } catch {}
    window.location.reload();
  }, [versaoNova]);
  return (
    <div className="mx-auto flex max-w-[460px] flex-col items-center gap-3 px-6 py-24 text-center">
      <span className="text-[34px]">🔄</span>
      <b className="text-[18px] text-[#111113]">{versaoNova ? 'Tem uma versão nova do portal' : 'Essa página demorou pra carregar'}</b>
      <p className="text-[13.5px] leading-relaxed text-[#636369]">
        {versaoNova ? 'Recarregando…' : 'O Notion às vezes demora pra responder. Tenta de novo que normalmente já vem.'}
      </p>
      {!versaoNova && (
        <button type="button" onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          } className="mt-1 rounded-full bg-[#111113] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#2C2C30]">
          Tentar de novo
        </button>
      )}
    </div>
  );
}
