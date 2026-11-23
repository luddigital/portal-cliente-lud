'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** Prévias dos posts em aberto sendo carregadas (uma vez só, mesmo com vários botões na tela). */
let carga: { feitos: number; total: number } | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

const CHAVE_ULTIMA = 'lud-ultima-atualizacao';

async function carregarPrevias() {
  if (carga) return;
  carga = { feitos: 0, total: 0 };
  avisar();
  try {
    // Da 2ª vez em diante, só os posts que mudaram desde o último Atualizar.
    let desde: string | null = null;
    try {
      desde = window.localStorage.getItem(CHAVE_ULTIMA);
    } catch {}
    const agora = new Date().toISOString();
    const url = desde ? `/api/admin/posts-mudados?desde=${encodeURIComponent(desde)}` : '/api/admin/posts-em-aberto';
    const r = await fetch(url);
    if (!r.ok) throw new Error();
    const { ids } = (await r.json()) as { ids: string[] };
    try {
      window.localStorage.setItem(CHAVE_ULTIMA, agora);
    } catch {}
    carga.total = ids.length;
    avisar();
    let i = 0;
    // 3 de cada vez pra não estourar o limite do Notion.
    const fila = async () => {
      while (i < ids.length) {
        const id = ids[i++];
        await fetch(`/api/post/${id}/preview?aquecer=1`).catch(() => null);
        if (carga) carga.feitos++;
        avisar();
      }
    };
    await Promise.all([fila(), fila(), fila()]);
  } catch {
    // sem lista: as prévias carregam quando abrir
  } finally {
    carga = null;
    avisar();
  }
}

/**
 * Relê tudo do Notion sem sair da tela: limpa os caches do portal e recarrega
 * os dados da página aberta. Fica fixo no topo do menu (admin) e no post.
 */
export function BotaoAtualizar({
  variante = 'menu',
}: {
  /** menu: largura cheia no topo da sidebar · compacto: só ícone + "Atualizar". */
  variante?: 'menu' | 'compacto' | 'icone';
}) {
  const router = useRouter();
  const [chamando, setChamando] = useState(false);
  const [recarregando, iniciar] = useTransition();
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState(false);
  const [, redesenhar] = useState(0);
  useEffect(() => {
    const f = () => redesenhar((n) => n + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  const ocupado = chamando || recarregando || !!carga;

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
      // Depois da tela, deixa a prévia de cada post em aberto pronta.
      await carregarPrevias();
      setFeito(true);
    } catch {
      setErro(true);
    } finally {
      setChamando(false);
    }
  }

  const texto = carga?.total ? `Posts ${carga.feitos}/${carga.total}` : ocupado ? 'Atualizando…' : erro ? 'Tentar de novo' : feito ? 'Atualizado' : 'Atualizar';
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
      title={carga?.total ? `Carregando os posts em aberto: ${carga.feitos} de ${carga.total}` : 'Relê tudo do Notion e atualiza a tela'}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-wait ${
        variante === 'menu'
          ? 'w-full rounded-[10px] border border-[#E2E2E5] bg-white px-3 py-[7px] text-[12.5px] text-[#46464B] shadow-[0_1px_2px_rgba(17,17,19,0.04)] hover:border-[#B4B4B9] hover:text-[#111113]'
          : variante === 'icone'
            ? 'h-[34px] w-[34px] rounded-[10px] border border-[#E2E2E5] bg-white text-[#46464B] hover:border-[#B4B4B9] hover:text-[#111113]'
            : 'rounded-full bg-navy px-3 py-1.5 text-[11.5px] text-white hover:opacity-90'
      } ${feito && !ocupado ? (variante === 'compacto' ? '!bg-[var(--prazo-em-dia)]' : '!border-[#9BCB8A] !bg-[#EEF4EA] !text-[#2E5520]') : ''}`}
    >
      {icone}
      {variante !== 'icone' && texto}
    </button>
  );
}
