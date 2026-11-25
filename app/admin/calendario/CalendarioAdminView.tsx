'use client';

import Link from 'next/link';
import { LinkPrevia } from '../_components/LinkPrevia';
import { useMemo, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PostCalendario, ProjetoListItem } from '@/lib/notion';
import { DIAS_ABREV, ymd } from '@/lib/semana';

/**
 * Design P&B — sem cores. Tons de cinza + texto pra representar status.
 *  - Publicado (feito, positivo)  →  fundo escuro, texto branco
 *  - Programado (na fila)         →  fundo cinza médio
 *  - Programar (pronto pra agir)  →  fundo cinza claro
 *  - Em andamento / outros        →  outline sem fundo (bem discreto)
 */
type Variante = 'solido' | 'medio' | 'claro' | 'outline';

function varianteDoStatus(p: PostCalendario): Variante {
  const s = (p.statusGeral ?? p.etapaLabel ?? '').toLowerCase();
  if (s.includes('postado') || s.includes('publicado')) return 'solido';
  if (s.includes('agendado') || s.includes('programad') || s.includes('conferir postagem')) return 'medio';
  if (s === 'programar' || s.includes('pronto')) return 'claro';
  return 'outline';
}

function classesChip(v: Variante): string {
  switch (v) {
    case 'solido':
      return 'bg-[#37352F] text-white border border-[#37352F]';
    case 'medio':
      return 'bg-[#E9E9E7] text-[#37352F] border border-[#E9E9E7]';
    case 'claro':
      return 'bg-[#F4F4F2] text-[#37352F] border border-[rgba(0,0,0,0.06)]';
    case 'outline':
      return 'bg-white text-[#787774] border border-[rgba(0,0,0,0.14)]';
  }
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Design inspirado no calendário do Notion:
 *   - Cards com fundo branco, borda muito suave (rgba 0/0/0/0.06)
 *   - Padding interno confortável, gap generoso entre células
 *   - Hover: fundo cinza suave (rgba 55/53/47/0.03) — mesmo cinza do Notion
 *   - Título em cima, projeto no meio, chip de status embaixo
 */
function PostCardLink({ p }: { p: PostCalendario }) {
  const label = p.statusGeral ?? p.etapaLabel;
  const variante = varianteDoStatus(p);
  return (
    // Post abre a prévia primeiro (regra do admin).
    <LinkPrevia
      postId={p.id}
      className="group block rounded-[6px] border border-[rgba(0,0,0,0.09)] bg-white px-2 py-1.5 transition-colors duration-150 hover:bg-[rgba(55,53,47,0.05)] hover:border-[rgba(0,0,0,0.14)]"
    >
      <div className="line-clamp-2 text-[12.5px] leading-[1.35] text-[#37352F]">
        {p.titulo}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-[#787774]">
        {p.projetoNome}
      </div>
      <span
        className={`mt-1 inline-block max-w-full truncate rounded px-1.5 py-[1px] text-[10px] font-medium ${classesChip(variante)}`}
      >
        {label}
      </span>
    </LinkPrevia>
  );
}

function BotaoSincronizar() {
  const router = useRouter();
  const [estado, setEstado] = useState<'idle' | 'sincronizando' | 'ok' | 'erro'>('idle');

  async function sincronizar() {
    setEstado('sincronizando');
    try {
      const res = await fetch('/api/admin/atualizar', { method: 'GET' });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setEstado('ok');
      // Recarrega a página com dados novos.
      startTransition(() => router.refresh());
      setTimeout(() => setEstado('idle'), 1600);
    } catch {
      setEstado('erro');
      setTimeout(() => setEstado('idle'), 2500);
    }
  }

  const label =
    estado === 'sincronizando' ? 'Sincronizando…'
      : estado === 'ok' ? '✓ Atualizado'
      : estado === 'erro' ? 'Erro'
      : 'Sincronizar Notion';

  return (
    <button
      type="button"
      onClick={sincronizar}
      disabled={estado === 'sincronizando'}
      className="rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:text-[#37352F] disabled:opacity-50"
      title="Força o portal a reler tudo do Notion agora"
    >
      <span className={`mr-1 inline-block ${estado === 'sincronizando' ? 'animate-spin' : ''}`} aria-hidden>
        ↻
      </span>
      {label}
    </button>
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
        // i é o índice iniciando na segunda; DIAS_ABREV também.
        nomeDia: DIAS_ABREV[i],
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
    <div className="min-h-screen bg-white pb-16">
      <header className="border-b border-[rgba(0,0,0,0.09)] bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-8 py-4">
          <div>
            <Link
              href="/admin"
              className="text-[12px] text-[#787774] transition-colors hover:text-[#37352F]"
            >
              ← Admin
            </Link>
            <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#37352F]">
              Calendário da semana
            </h1>
            <p className="text-[12px] text-[#787774]">
              {verTodos
                ? 'Todas as postagens da semana, de todos os clientes.'
                : `Postagens de ${projetos.find((p) => p.id === projetoIdSelecionado)?.nome ?? 'cliente'} nesta semana.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BotaoSincronizar />
            <select
              value={projetoIdSelecionado}
              onChange={(e) => trocarProjeto(e.target.value)}
              className="rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-2.5 py-1.5 text-[12.5px] text-[#37352F] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:border-[rgba(0,0,0,0.14)]"
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
              className="rounded-md bg-[#37352F] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2E2C28]"
            >
              Programar →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#37352F]">
            {rotulo}
          </div>
          <div className="flex items-center gap-0.5">
            <Link
              href={hrefSemana(0)}
              className="rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-2.5 py-1 text-[12px] font-medium text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:text-[#37352F]"
            >
              Hoje
            </Link>
            <Link
              href={hrefSemana(-7)}
              aria-label="Semana anterior"
              className="rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-2.5 py-1 text-[14px] text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:text-[#37352F]"
            >
              ‹
            </Link>
            <Link
              href={hrefSemana(7)}
              aria-label="Próxima semana"
              className="rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-2.5 py-1 text-[14px] text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:text-[#37352F]"
            >
              ›
            </Link>
          </div>
        </div>

        {/* Grid do calendário — Seg → Dom. Cada célula com stroke próprio. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {dias.map((d) => (
            <div
              key={d.iso}
              className={`rounded-lg border p-2 sm:min-h-[460px] ${
                d.hoje
                  ? 'border-[#37352F] bg-[rgba(55,53,47,0.02)]'
                  : 'border-[rgba(0,0,0,0.09)] bg-white'
              }`}
            >
              <div className="mb-2 flex items-baseline gap-1.5 px-1">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#787774]">
                  {d.nomeDia}
                </span>
                <span
                  className={`text-[14px] font-medium tracking-[-0.01em] ${
                    d.hoje ? 'font-semibold text-[#37352F]' : 'text-[#37352F]'
                  }`}
                >
                  {d.num}
                </span>
              </div>
              <div className="space-y-0.5">
                {d.posts.map((p) => (
                  <PostCardLink key={p.id} p={p} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {postsFiltrados.length === 0 && (
          <div className="mt-10 p-10 text-center">
            <div className="text-[13.5px] font-medium text-[#37352F]">
              Nenhum post nesta semana
            </div>
            <p className="mt-1 text-[12px] text-[#787774]">
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
