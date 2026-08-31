'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { PostCalendario, ProjetoListItem } from '@/lib/notion';

const DIAS_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function PostCardLink({ p }: { p: PostCalendario }) {
  const label = p.statusGeral ?? p.etapaLabel;
  return (
    <Link
      href={`/post/${p.id}`}
      className="block rounded-md border border-[rgba(21,21,33,0.1)] bg-white px-1.5 py-1 transition hover:border-mauve hover:shadow-sm sm:px-2 sm:py-1.5"
    >
      <div className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
        {p.projetoNome}
      </div>
      <div className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight text-ink">
        {p.titulo}
      </div>
      <span
        className="mt-1 inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[9.5px] font-semibold"
        style={{
          background: `var(--cal-${p.cor}-soft)`,
          color: `var(--cal-${p.cor})`,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

export function CalendarioAdminView({
  projetos,
  projetoIdSelecionado,
  inicioIso,
  fimIso,
  posts,
}: {
  projetos: ProjetoListItem[];
  projetoIdSelecionado: string;
  inicioIso: string;
  fimIso: string;
  posts: PostCalendario[];
}) {
  const verTodos = projetoIdSelecionado === 'todos';

  const postsFiltrados = useMemo(() => {
    if (verTodos) return posts;
    return posts.filter((p) => p.projetoId === projetoIdSelecionado);
  }, [posts, verTodos, projetoIdSelecionado]);

  const dias = useMemo(() => {
    const [yy, mm, dd] = inicioIso.split('-').map(Number);
    const inicio = new Date(yy, mm - 1, dd);
    const hojeIso = ymd(new Date());

    const porDia = new Map<string, PostCalendario[]>();
    for (const p of postsFiltrados) {
      const iso = p.data.slice(0, 10);
      if (!porDia.has(iso)) porDia.set(iso, []);
      porDia.get(iso)!.push(p);
    }

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      const iso = ymd(d);
      return {
        iso,
        nomeDia: DIAS_ABREV[d.getDay()],
        num: d.getDate(),
        hoje: iso === hojeIso,
        posts: porDia.get(iso) ?? [],
      };
    });
  }, [inicioIso, postsFiltrados]);

  const rotulo = useMemo(() => {
    const [yi, mi, di] = inicioIso.split('-').map(Number);
    const [, mf, df] = fimIso.split('-').map(Number);
    if (mi === mf) return `${di} – ${df} de ${MESES[mi - 1]} de ${yi}`;
    return `${di} de ${MESES[mi - 1]} – ${df} de ${MESES[mf - 1]}`;
  }, [inicioIso, fimIso]);

  function hrefSemana(deltaDias: number, projetoOverride?: string): string {
    const [yy, mm, dd] = inicioIso.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd + deltaDias);
    const params = new URLSearchParams();
    const proj = projetoOverride ?? projetoIdSelecionado;
    if (proj && proj !== 'todos') params.set('projetoId', proj);
    if (deltaDias !== 0) params.set('semana', ymd(d));
    return `/admin/calendario${params.toString() ? `?${params.toString()}` : ''}`;
  }

  function trocarProjeto(id: string) {
    const params = new URLSearchParams();
    if (id !== 'todos') params.set('projetoId', id);
    params.set('semana', inicioIso);
    window.location.href = `/admin/calendario?${params.toString()}`;
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Calendário da semana
            </h1>
            <p className="text-[11px] text-t3">
              {verTodos
                ? 'Todas as postagens da semana, de todos os clientes.'
                : `Postagens de ${projetos.find((p) => p.id === projetoIdSelecionado)?.nome ?? 'cliente'} nesta semana.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={projetoIdSelecionado}
              onChange={(e) => trocarProjeto(e.target.value)}
              className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3 py-1.5 text-[12px] text-ink"
            >
              <option value="todos">Todos os clientes</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>

            <Link
              href={`/programacao?projetoId=${projetoIdSelecionado}`}
              className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90"
            >
              Programar →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {rotulo}
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href={hrefSemana(0)}
              className="rounded-full bg-bgSoft px-2.5 py-1 text-[11px] font-medium text-t2 transition hover:text-ink"
            >
              Hoje
            </Link>
            <Link
              href={hrefSemana(-7)}
              aria-label="Semana anterior"
              className="rounded-full bg-bgSoft px-2.5 py-1 text-[13px] text-t2 transition hover:text-ink"
            >
              ‹
            </Link>
            <Link
              href={hrefSemana(7)}
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
              className={`rounded-xl border p-2 sm:min-h-[420px] ${
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
                  <PostCardLink key={p.id} p={p} />
                ))}
                {d.posts.length === 0 && (
                  <div className="py-2 text-center text-[10px] text-t3/60">—</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {postsFiltrados.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-[rgba(21,21,33,0.15)] bg-white p-10 text-center">
            <div className="text-[14px] font-semibold text-ink">
              Nenhum post nesta semana
            </div>
            <p className="mt-1 text-[12px] text-t3">
              {verTodos
                ? 'Nenhum cliente tem posts programados aqui.'
                : 'Esse cliente não tem posts nesta semana. Troque de cliente ou navegue pra outra semana.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
