'use client';

import { useState } from 'react';
import type { PostCalendario } from '@/lib/notion';
import { corDoStatus } from '@/lib/statusCor';
import { PreviaPostModal } from '@/app/admin/aprovacoes/PreviaPostModal';

/**
 * Card do post no calendário da semana (home). Clicar abre o popup de prévia
 * primeiro; dali, "Abrir completo" leva pra página do post e o "Voltar" volta
 * pra home.
 */
export function PostCardSemana({ p }: { p: PostCalendario }) {
  const [aberto, setAberto] = useState(false);
  const label = p.statusGeral ?? p.etapaLabel;
  const cores = corDoStatus(p);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title={`${p.projetoNome} — ${p.titulo} · ${label}`}
        className="block w-full rounded-md border border-[rgba(21,21,33,0.1)] bg-white px-1.5 py-1 text-left transition hover:border-navy/40 hover:shadow-sm sm:px-2 sm:py-1.5"
      >
        <div className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
          {p.projetoNome}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight text-ink">
          {p.titulo}
        </div>
        <span
          className="mt-1 inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[9.5px] font-semibold"
          style={{ background: cores.bg, color: cores.fg }}
        >
          {label}
        </span>
      </button>
      {aberto && <PreviaPostModal postId={p.id} fechar={() => setAberto(false)} />}
    </>
  );
}
