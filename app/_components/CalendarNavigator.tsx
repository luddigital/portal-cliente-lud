'use client';

import { useEffect, useState } from 'react';
import { CalendarMes } from './CalendarMes';
import type { PostCalendario } from '@/lib/notion';

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function avancarMes(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

type MesCache = {
  year: number;
  month: number;
  posts: PostCalendario[];
};

/**
 * Calendário com navegação. Carrega o mês atual no SSR (passa `mesInicial`),
 * e os outros meses sob demanda quando o usuário navega — evita esperar
 * 30+ chamadas Notion logo na primeira render.
 */
export function CalendarNavigator({
  mesInicial,
  totalMesesAFrente = 2,
  projetoIdsOverride,
}: {
  mesInicial: MesCache;
  totalMesesAFrente?: number;
  /** Se vier, força o calendar a buscar posts desses projetos (não da session). */
  projetoIdsOverride?: string[];
}) {
  const [offset, setOffset] = useState(0); // 0 = atual, +1 = próximo, etc.
  const [cache, setCache] = useState<Record<string, MesCache>>({
    [`${mesInicial.year}-${mesInicial.month}`]: mesInicial,
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alvo = avancarMes(mesInicial.year, mesInicial.month, offset);
  const chave = `${alvo.year}-${alvo.month}`;
  const mesAtivo = cache[chave];
  const labelAtual = `${MESES_PT[alvo.month - 1]} ${alvo.year}`;

  useEffect(() => {
    if (cache[chave]) return;
    let cancelled = false;
    setLoading(true);
    setErro(null);
    const qs = projetoIdsOverride
      ? `?projetoIds=${encodeURIComponent(projetoIdsOverride.join(','))}`
      : '';
    fetch(`/api/posts/${alvo.year}/${alvo.month}${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (cancelled) return;
        setCache((c) => ({
          ...c,
          [chave]: { year: alvo.year, month: alvo.month, posts: data.posts ?? [] },
        }));
      })
      .catch((e) => {
        if (cancelled) return;
        setErro(typeof e === 'string' ? e : 'Não consegui carregar esse mês.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chave, alvo.year, alvo.month, cache]);

  const podeAnterior = offset > 0;
  const podeProximo = offset < totalMesesAFrente;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={!podeAnterior}
          aria-label="Mês anterior"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(21,21,33,0.08)] bg-white text-[14px] text-ink transition hover:border-navy/40 disabled:opacity-30"
        >
          ‹
        </button>
        <div className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {labelAtual}
          {loading && <span className="text-[11px] text-t3">carregando…</span>}
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(totalMesesAFrente, o + 1))}
          disabled={!podeProximo}
          aria-label="Próximo mês"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(21,21,33,0.08)] bg-white text-[14px] text-ink transition hover:border-navy/40 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {mesAtivo ? (
        <CalendarMes year={mesAtivo.year} month={mesAtivo.month} posts={mesAtivo.posts} />
      ) : (
        <div className="card p-10 text-center text-[12px] text-t3">
          {erro ?? 'Carregando calendário…'}
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: totalMesesAFrente + 1 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOffset(i)}
            aria-label={`Ir para o mês ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === offset ? 'w-5 bg-ink' : 'w-1.5 bg-[rgba(21,21,33,0.2)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
