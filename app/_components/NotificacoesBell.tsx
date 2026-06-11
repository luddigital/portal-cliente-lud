'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CategoriaTarefa } from '@/lib/notion';

export type NotificacaoItem = {
  tarefaId: string;
  postId: string;
  postTitulo: string;
  categoria: CategoriaTarefa;
  prazo: string | null;
};

const CATEGORIA_INFO: Record<
  CategoriaTarefa,
  { label: string; cor: string; bg: string; emoji: string }
> = {
  pauta: {
    label: 'Aprovar tema',
    cor: 'var(--cal-aprovacao)',
    bg: 'var(--cal-aprovacao-soft)',
    emoji: '📋',
  },
  previas: {
    label: 'Enviar informações',
    cor: 'var(--cal-aguardando)',
    bg: 'var(--cal-aguardando-soft)',
    emoji: '✍️',
  },
  materiais: {
    label: 'Enviar materiais',
    cor: 'var(--cal-aguardando)',
    bg: 'var(--cal-aguardando-soft)',
    emoji: '📷',
  },
  post: {
    label: 'Aprovar post',
    cor: 'var(--cal-agendado)',
    bg: 'var(--cal-agendado-soft)',
    emoji: '✅',
  },
  stories: {
    label: 'Direcionar stories',
    cor: 'var(--cal-aprovacao)',
    bg: 'var(--cal-aprovacao-soft)',
    emoji: '📱',
  },
};

function fmtPrazo(iso: string | null): string {
  if (!iso) return 'sem prazo';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(iso.split('T')[0] + 'T00:00:00');
  const dias = Math.round((data.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return `atrasada ${Math.abs(dias)}d`;
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias <= 7) return `em ${dias} dias`;
  const [, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}`;
}

function hrefDaTarefa(n: NotificacaoItem): string {
  if (n.categoria === 'pauta' || n.categoria === 'post') {
    return `/post/${n.postId}?tarefa=${n.tarefaId}&from=${n.categoria}`;
  }
  return `/tarefa/${n.tarefaId}?from=${n.categoria}`;
}

export function NotificacoesBell({ items }: { items: NotificacaoItem[] }) {
  const [aberto, setAberto] = useState(false);

  // Trava o scroll do body quando o painel tá aberto
  useEffect(() => {
    if (!aberto) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [aberto]);

  // ESC fecha
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto]);

  const total = items.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Ver novidades"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(21,21,33,0.08)] bg-white transition hover:border-navy/40"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9z" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {total > 0 && (
          <span
            className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: 'var(--prazo-hoje)' }}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAberto(false);
          }}
        >
          <div
            className="absolute inset-0 bg-black/30"
            aria-hidden="true"
            onClick={() => setAberto(false)}
          />
          <div className="relative ml-auto h-full w-full max-w-[420px] overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(21,21,33,0.08)] bg-white px-5 py-4">
              <div>
                <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  Novidades
                </div>
                <div className="text-[11px] text-t3">
                  {total === 0
                    ? 'tudo em dia'
                    : `${total} ${total === 1 ? 'pendência' : 'pendências'}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="rounded-full p-1.5 text-t3 transition hover:bg-bgSoft hover:text-ink"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              {total === 0 ? (
                <div className="rounded-2xl bg-[var(--prazo-em-dia-soft)] p-6 text-center">
                  <div className="text-[24px]">✨</div>
                  <div className="mt-2 text-[14px] font-semibold text-[var(--prazo-em-dia)]">
                    Tudo em dia
                  </div>
                  <p className="mt-1 text-[12px] text-t2">
                    Quando precisarmos de algo, aparece aqui.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((n) => {
                    const info = CATEGORIA_INFO[n.categoria];
                    return (
                      <li key={`${n.tarefaId}`}>
                        <Link
                          href={hrefDaTarefa(n)}
                          onClick={() => setAberto(false)}
                          className="group flex items-start gap-3 rounded-xl border border-[rgba(21,21,33,0.06)] bg-white p-3 transition hover:border-navy/30 hover:shadow-sm"
                        >
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px]"
                            style={{ background: info.bg, color: info.cor }}
                          >
                            {info.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-[10px] font-semibold uppercase tracking-[0.06em]"
                              style={{ color: info.cor }}
                            >
                              {info.label}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-ink">
                              {n.postTitulo}
                            </div>
                            <div className="mt-1 text-[11px] text-t3">
                              {fmtPrazo(n.prazo)}
                            </div>
                          </div>
                          <span className="self-center text-t3 transition group-hover:translate-x-0.5">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
