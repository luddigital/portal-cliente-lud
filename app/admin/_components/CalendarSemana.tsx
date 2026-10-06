import Link from 'next/link';
import type { PostCalendario } from '@/lib/notion';
import { corDoStatus } from '@/lib/statusCor';

export type DiaSemana = {
  iso: string;
  nomeDia: string;
  num: number;
  hoje: boolean;
  posts: PostCalendario[];
};

function PostCard({ p }: { p: PostCalendario }) {
  const label = p.statusGeral ?? p.etapaLabel;
  const cores = corDoStatus(p);
  return (
    <Link
      href={`/post/${p.id}`}
      title={`${p.projetoNome} — ${p.titulo} · ${label}`}
      className="block rounded-md border border-[rgba(21,21,33,0.1)] bg-white px-1.5 py-1 sm:px-2 sm:py-1.5 transition hover:border-navy/40 hover:shadow-sm"
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
    </Link>
  );
}

export function CalendarSemana({
  dias,
  rotulo,
  prevHref,
  nextHref,
  hojeHref,
}: {
  dias: DiaSemana[];
  rotulo: string;
  prevHref: string;
  nextHref: string;
  hojeHref: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
          {rotulo}
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={hojeHref}
            className="rounded-full bg-bgSoft px-2.5 py-1 text-[11px] font-medium text-t2 transition hover:text-ink"
          >
            Hoje
          </Link>
          <Link
            href={prevHref}
            aria-label="Semana anterior"
            className="rounded-full bg-bgSoft px-2.5 py-1 text-[13px] text-t2 transition hover:text-ink"
          >
            ‹
          </Link>
          <Link
            href={nextHref}
            aria-label="Próxima semana"
            className="rounded-full bg-bgSoft px-2.5 py-1 text-[13px] text-t2 transition hover:text-ink"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {dias.map((d) => (
          <div
            key={d.iso}
            className={`rounded-xl border p-2 sm:min-h-[140px] ${
              d.hoje
                ? 'border-navy/40 bg-[rgba(49,61,101,0.04)]'
                : 'border-[rgba(21,21,33,0.08)] bg-bgSoft'
            }`}
          >
            <div className="mb-1.5 flex items-baseline gap-1.5 px-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                {d.nomeDia}
              </span>
              <span
                className={`text-[14px] font-semibold tracking-[-0.02em] ${
                  d.hoje ? 'text-navy' : 'text-ink'
                }`}
              >
                {d.num}
              </span>
            </div>
            <div className="space-y-1.5">
              {d.posts.map((p) => (
                <PostCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
