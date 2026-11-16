'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PostCalendario } from '@/lib/notion';
import { PreviaPostModal, prefetchPrevia } from '@/app/admin/aprovacoes/PreviaPostModal';

type CalDay = {
  iso: string;
  num: number;
  muted: boolean;
  today: boolean;
  posts: PostCalendario[];
};

function buildGrid(year: number, month: number, posts: PostCalendario[]): CalDay[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const jsDay = firstOfMonth.getDay();
  const offset = (jsDay + 6) % 7;
  const start = new Date(year, month - 1, 1 - offset);

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayIso = todayDate.toISOString().slice(0, 10);

  const days: CalDay[] = [];
  const postsByIso = new Map<string, PostCalendario[]>();
  for (const p of posts) {
    const iso = p.data.slice(0, 10);
    if (!postsByIso.has(iso)) postsByIso.set(iso, []);
    postsByIso.get(iso)!.push(p);
  }

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      iso,
      num: d.getDate(),
      muted: d.getMonth() !== month - 1,
      today: iso === todayIso,
      posts: postsByIso.get(iso) ?? [],
    });
    if (i >= 27 && (i + 1) % 7 === 0 && d.getMonth() !== month - 1 && days.length >= 35) break;
  }
  return days;
}

function PostIcon({ icon, fallback }: { icon: string | null; fallback: string }) {
  if (icon && icon.startsWith('http')) {
    return (
      <img
        src={icon}
        alt=""
        className="mt-px h-2.5 w-2.5 shrink-0 rounded-sm object-contain"
      />
    );
  }
  return (
    <span className="inline-flex h-3 w-2.5 shrink-0 items-center justify-center text-[9px] leading-none">
      {icon || fallback}
    </span>
  );
}

function fallbackEmoji(p: PostCalendario): string {
  if (p.tipo === 'reels') return '📱';
  if (p.tipo === 'story') return '⭕';
  return '📄';
}

export function CalendarMes({
  year,
  month,
  posts,
  comPrevia = false,
  destacarHoje = false,
}: {
  year: number;
  month: number;
  posts: PostCalendario[];
  /** Área interna: clicar no post abre o popup de prévia em vez da página. */
  comPrevia?: boolean;
  /** Página do projeto: hoje bem marcado (círculo no número + etiqueta) e dias passados apagados. */
  destacarHoje?: boolean;
}) {
  const days = useMemo(() => buildGrid(year, month, posts), [year, month, posts]);
  const [previaId, setPreviaId] = useState<string | null>(null);
  const hojeIso = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
    [],
  );

  return (
    <div className="hub-cal">
      <div className="hub-cal-weekdays">
        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sáb</div>
        <div>Dom</div>
      </div>
      <div className="hub-cal-grid">
        {days.map((d) => (
          <div
            key={d.iso}
            className={`hub-cal-day ${d.muted ? 'muted' : ''} ${d.today ? 'today' : ''} ${
              destacarHoje && d.today ? 'hoje-forte' : ''
            } ${destacarHoje && !d.today && d.iso < hojeIso ? 'passado' : ''}`}
          >
            {destacarHoje && d.today ? (
              <div className="flex items-center justify-between gap-1">
                <span className="hoje-num">{d.num}</span>
                <span className="hidden rounded-full bg-[#313D65] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.06em] text-white sm:inline">
                  HOJE
                </span>
              </div>
            ) : (
              <div className="hub-cal-day-num">{d.num}</div>
            )}
            {d.posts.slice(0, 4).map((p) => {
              const labelStatus = p.statusGeral ?? p.etapaLabel;
              const conteudo = (
                <>
                  <div className="flex items-start gap-1 sm:gap-1.5 text-ink">
                    <PostIcon icon={p.icon} fallback={fallbackEmoji(p)} />
                    <span className="line-clamp-2 font-medium">{p.titulo}</span>
                  </div>
                  <span
                    className="hidden sm:inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[9.5px] font-semibold"
                    style={{
                      background: `var(--cal-${p.cor}-soft)`,
                      color: `var(--cal-${p.cor})`,
                    }}
                  >
                    {labelStatus}
                  </span>
                </>
              );
              const cls =
                'block w-full text-left space-y-1 sm:space-y-1.5 rounded-md border border-[rgba(21,21,33,0.12)] bg-white px-1.5 py-1 sm:px-2 sm:py-1.5 text-[10px] sm:text-[11px] leading-tight transition hover:border-navy/40 hover:shadow-sm';
              const titulo = `${p.projetoNome} — ${p.titulo} · ${labelStatus}`;
              return comPrevia ? (
                <button key={p.id} type="button" onMouseEnter={() => prefetchPrevia(p.id)} onClick={() => setPreviaId(p.id)} className={cls} title={titulo}>
                  {conteudo}
                </button>
              ) : (
                <Link key={p.id} href={`/post/${p.id}`} className={cls} title={titulo}>
                  {conteudo}
                </Link>
              );
            })}
            {d.posts.length > 4 && (
              <div className="px-1 text-[9px] sm:text-[10px] text-t3">+{d.posts.length - 4}</div>
            )}
          </div>
        ))}
      </div>
      {previaId && <PreviaPostModal postId={previaId} fechar={() => setPreviaId(null)} />}
    </div>
  );
}
