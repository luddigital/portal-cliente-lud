'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Relê tudo do Notion sem sair da tela: limpa os caches do portal e recarrega
 * os dados da página aberta. Fica fixo no topo do menu (admin) e no post.
 */
export function BotaoAtualizar({
  variante = 'menu',
}: {
  /** menu: largura cheia no topo da sidebar · compacto: só ícone + "Atualizar". */
  variante?: 'menu' | 'compacto';
}) {
  const router = useRouter();
  const [chamando, setChamando] = useState(false);
  const [recarregando, iniciar] = useTransition();
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState(false);
  const ocupado = chamando || recarregando;

  useEffect(() => {
    if (!feito) return;
    const t = setTimeout(() => setFeito(false), 2500);
    return () => clearTimeout(t);
  }, [feito]);

  async function atualizar() {
    setChamando(true);
    setErro(false);
    try {
      const res = await fetch('/api/admin/atualizar', { method: 'POST' });
      if (!res.ok) throw new Error();
      iniciar(() => router.refresh());
      setFeito(true);
    } catch {
      setErro(true);
    } finally {
      setChamando(false);
    }
  }

  const texto = ocupado ? 'Atualizando…' : erro ? 'Tentar de novo' : feito ? 'Atualizado' : 'Atualizar';
  const icone = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ocupado ? 'animate-spin' : ''}
      aria-hidden
    >
      {feito && !ocupado ? (
        <path d="M5 12l5 5L20 7" />
      ) : (
        <>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </>
      )}
    </svg>
  );

  return (
    <button
      type="button"
      onClick={atualizar}
      disabled={ocupado}
      title="Relê tudo do Notion e atualiza a tela"
      className={`inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-wait ${
        variante === 'menu'
          ? 'w-full rounded-lg bg-navy px-3 py-2 text-[12.5px] text-white hover:opacity-90'
          : 'rounded-full bg-navy px-3 py-1.5 text-[11.5px] text-white hover:opacity-90'
      } ${feito && !ocupado ? '!bg-[var(--prazo-em-dia)]' : ''}`}
    >
      {icone}
      {texto}
    </button>
  );
}
