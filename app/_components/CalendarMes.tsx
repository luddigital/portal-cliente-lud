'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { PostCalendario } from '@/lib/notion';

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
  if (!icon) return <span className="shrink-0 leading-none">{fallback}</span>;
  if (icon.startsWith('http')) {
    return (
      <img
        src={icon}
        alt=""
        className="h-3.5 w-3.5 shrink-0 rounded-sm object-contain"
      />
    );
  }
  return <span className="shrink-0 leading-none">{icon}</span>;
}

function fallbackEmoji(p: PostCalendario): string {
  if (p.tipo === 'reels') return '🎬';
  if (p.tipo === 'story') return '📱';
  return '📄';
}

export function CalendarMes({
  year,
  month,
  posts,
}: {
  year: number;
  month: number;
  posts: PostCalendario[];
}) {
  const days = useMemo(() => buildGrid(year, month, posts), [year, month, posts]);

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
            className={`hub-cal-day ${d.muted ? 'muted' : ''} ${d.today ? 'today' : ''}`}
          >
            <div className="hub-cal-day-num">{d.num}</div>
            {d.posts.slice(0, 4).map((p) => {
              const isPostado = p.status === 'Postado';
              const labelStatus = p.statusGeral ?? p.tarefaAtualTitulo ?? p.etapaLabel;
              return (
                <Link
                  key={p.id}
                  href={`/post/${p.id}`}
                  className="block space-y-1 sm:space-y-1.5 rounded-md border border-[rgba(21,21,33,0.12)] bg-white px-1.5 py-1 sm:px-2 sm:py-1.5 text-[10px] sm:text-[11px] leading-tight transition hover:border-navy/40 hover:shadow-sm"
                  title={`${p.projetoNome} — ${p.titulo} · ${labelStatus}`}
                >
                  <div className="flex items-start gap-1 sm:gap-1.5 text-ink">
                    <PostIcon icon={p.icon} fallback={fallbackEmoji(p)} />
                    <span className="line-clamp-2 font-medium">{p.titulo}</span>
                  </div>
                  {isPostado ? (
                    <span className="hidden sm:inline-flex items-center gap-1 rounded bg-[var(--prazo-em-dia-soft)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[var(--prazo-em-dia)]">
                      ✓ Postado
                    </span>
                  ) : (
                    <span className="hidden sm:inline-block max-w-full truncate rounded bg-[rgba(21,21,33,0.06)] px-1.5 py-0.5 text-[9.5px] font-medium text-t2">
                      {labelStatus}
                    </span>
                  )}
                </Link>
              );
            })}
            {d.posts.length > 4 && (
              <div className="px-1 text-[9px] sm:text-[10px] text-t3">+{d.posts.length - 4}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
