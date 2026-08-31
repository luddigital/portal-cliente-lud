'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { PostCalendario, ProjetoListItem } from '@/lib/notion';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

type Bucket = 'pronto' | 'programado' | 'publicado' | 'ajuste' | 'aprovacao' | 'producao';

const BUCKET_INFO: Record<Bucket, { label: string; bg: string; fg: string }> = {
  publicado:  { label: 'Publicado',  bg: 'var(--prazo-em-dia-soft)',   fg: 'var(--prazo-em-dia)'   },
  programado: { label: 'Programado', bg: 'var(--cal-agendado-soft)',   fg: 'var(--cal-agendado)'   },
  pronto:     { label: 'Programar',  bg: 'var(--prazo-chegando-soft)', fg: 'var(--prazo-chegando)' },
  aprovacao:  { label: 'Aprovação',  bg: 'var(--cal-aprovacao-soft)',  fg: 'var(--cal-aprovacao)'  },
  ajuste:     { label: 'Alteração',  bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)' },
  producao:   { label: 'Em produção',bg: 'var(--prazo-hoje-soft)',     fg: 'var(--prazo-hoje)'     },
};

const FORMATO_LABELS: Record<PostCalendario['tipo'], string> = {
  post: 'Carrossel',
  reels: 'Reels',
  story: 'Stories',
};

function semEmoji(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{So}\p{Sk}️‍]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function balde(p: PostCalendario): Bucket {
  const sg = (p.statusGeral ?? '').trim().toLowerCase();
  const t = (p.tarefaAtualTitulo ?? '').toLowerCase();

  if (sg.includes('postado')) return 'publicado';
  if (sg.includes('conferir postagem')) return 'publicado';
  if (sg === 'programar' || t.includes('programar')) return 'pronto';
  if (sg.includes('altera')) return 'ajuste';
  if (sg.includes('aprova')) return 'aprovacao';

  if (p.cor === 'publicado') return 'publicado';
  if (p.cor === 'agendado') return 'programado';
  if (p.cor === 'alteracao') return 'ajuste';
  return 'producao';
}

function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim) return 'Sem título';
  if (/^https?:\/\/\S+$/.test(trim) && !trim.includes(' ')) return 'Sem título';
  return trim;
}

/** Cor estável por projeto — 10 cores rotativas com hash simples. */
const CORES_CLIENTE = [
  '#7A5AA6', '#4A6280', '#8A6E3E', '#B04A6A', '#3F7A6E',
  '#A6604A', '#5A5A5A', '#6E4A8A', '#4A8A6E', '#8A4A5A',
];
function corCliente(projetoId: string): string {
  let h = 0;
  for (let i = 0; i < projetoId.length; i++) h = (h * 31 + projetoId.charCodeAt(i)) >>> 0;
  return CORES_CLIENTE[h % CORES_CLIENTE.length];
}

/** Retorna as 6 semanas (42 células) que cobrem o mês inteiro no calendário. */
function celulasDoMes(year: number, month: number): { iso: string; dia: number; noMes: boolean }[] {
  const primeiroDoMes = new Date(year, month - 1, 1);
  const inicio = new Date(primeiroDoMes);
  inicio.setDate(primeiroDoMes.getDate() - primeiroDoMes.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(inicio);
    dt.setDate(inicio.getDate() + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return { iso, dia: dt.getDate(), noMes: dt.getMonth() === month - 1 };
  });
}

export function CalendarioAdminView({
  projetos,
  projetoIdSelecionado,
  year,
  month,
  posts,
}: {
  projetos: ProjetoListItem[];
  projetoIdSelecionado: string;
  year: number;
  month: number;
  posts: PostCalendario[];
}) {
  const [filtros, setFiltros] = useState<Set<Bucket>>(new Set());
  const [filtroFormato, setFiltroFormato] = useState<Set<'post' | 'reels' | 'story'>>(new Set());

  const verTodos = projetoIdSelecionado === 'todos';

  const contagens = useMemo(() => {
    const c: Record<Bucket, number> = { publicado: 0, programado: 0, pronto: 0, aprovacao: 0, ajuste: 0, producao: 0 };
    for (const p of posts) c[balde(p)] += 1;
    return c;
  }, [posts]);

  const postsFiltrados = useMemo(() => {
    if (filtros.size === 0 && filtroFormato.size === 0) return posts;
    return posts.filter((p) => {
      if (filtros.size > 0 && !filtros.has(balde(p))) return false;
      if (filtroFormato.size > 0 && !filtroFormato.has(p.tipo)) return false;
      return true;
    });
  }, [posts, filtros, filtroFormato]);

  const postsPorData = useMemo(() => {
    const m = new Map<string, PostCalendario[]>();
    for (const p of postsFiltrados) {
      if (!m.has(p.data)) m.set(p.data, []);
      m.get(p.data)!.push(p);
    }
    return m;
  }, [postsFiltrados]);

  const celulas = useMemo(() => celulasDoMes(year, month), [year, month]);

  const hojeIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  function irParaMes(delta: number) {
    let ny = year;
    let nm = month + delta;
    if (nm < 1) { nm = 12; ny -= 1; }
    if (nm > 12) { nm = 1; ny += 1; }
    const params = new URLSearchParams({
      projetoId: projetoIdSelecionado,
      ym: `${ny}-${String(nm).padStart(2, '0')}`,
    });
    window.location.href = `/admin/calendario?${params.toString()}`;
  }

  function trocarProjeto(id: string) {
    const params = new URLSearchParams({
      projetoId: id,
      ym: `${year}-${String(month).padStart(2, '0')}`,
    });
    window.location.href = `/admin/calendario?${params.toString()}`;
  }

  function irParaHoje() {
    const d = new Date();
    const params = new URLSearchParams({
      projetoId: projetoIdSelecionado,
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
    window.location.href = `/admin/calendario?${params.toString()}`;
  }

  function toggleFiltro(b: Bucket) {
    setFiltros((prev) => {
      const n = new Set(prev);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });
  }

  function toggleFormato(f: 'post' | 'reels' | 'story') {
    setFiltroFormato((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-20 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Calendário
            </h1>
            <p className="text-[11px] text-t3">
              Visão panorâmica do mês. Clique em qualquer post pra abrir.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={projetoIdSelecionado}
              onChange={(e) => trocarProjeto(e.target.value)}
              className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3 py-1.5 text-[12px] text-ink"
            >
              <option value="todos">Todos os clientes</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-full bg-bgSoft p-1">
              <button
                type="button"
                onClick={() => irParaMes(-1)}
                className="rounded-full px-3 py-1 text-[12px] text-ink transition hover:bg-white"
              >
                ←
              </button>
              <span className="min-w-[160px] px-2 text-center text-[12px] font-semibold text-ink">
                {MESES[month - 1]} {year}
              </span>
              <button
                type="button"
                onClick={() => irParaMes(1)}
                className="rounded-full px-3 py-1 text-[12px] text-ink transition hover:bg-white"
              >
                →
              </button>
            </div>

            <button
              type="button"
              onClick={irParaHoje}
              className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3 py-1.5 text-[11px] font-medium text-t2 transition hover:text-ink"
            >
              Hoje
            </button>

            <Link
              href={`/programacao?projetoId=${projetoIdSelecionado}`}
              className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90"
            >
              Programar posts →
            </Link>
          </div>
        </div>

        {/* Filtros de status + formato */}
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 border-t border-[rgba(21,21,33,0.05)] px-6 py-2.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            Status
          </span>
          {(Object.entries(BUCKET_INFO) as [Bucket, typeof BUCKET_INFO[Bucket]][]).map(
            ([b, info]) => {
              const ativo = filtros.has(b);
              const n = contagens[b];
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleFiltro(b)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition ${
                    ativo
                      ? 'border-transparent'
                      : 'border-[rgba(21,21,33,0.08)] hover:border-[rgba(21,21,33,0.2)]'
                  }`}
                  style={{
                    background: ativo ? info.bg : 'white',
                    color: ativo ? info.fg : 'var(--t2)',
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: info.fg }}
                  />
                  {info.label}
                  <span className="ml-0.5 font-mono opacity-70">{n}</span>
                </button>
              );
            },
          )}

          <span className="ml-4 mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            Formato
          </span>
          {(['post', 'reels', 'story'] as const).map((f) => {
            const ativo = filtroFormato.has(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormato(f)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.06em] transition ${
                  ativo
                    ? 'border-ink bg-ink text-white'
                    : 'border-[rgba(21,21,33,0.08)] bg-white text-t2 hover:border-[rgba(21,21,33,0.2)] hover:text-ink'
                }`}
              >
                {FORMATO_LABELS[f]}
              </button>
            );
          })}

          {(filtros.size > 0 || filtroFormato.size > 0) && (
            <button
              type="button"
              onClick={() => { setFiltros(new Set()); setFiltroFormato(new Set()); }}
              className="ml-2 text-[10px] font-medium text-mauve underline transition hover:text-ink"
            >
              Limpar filtros
            </button>
          )}

          <span className="ml-auto text-[11px] text-t3">
            <b className="text-ink">{postsFiltrados.length}</b> de {posts.length} posts
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Grid mensal */}
        <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-2">
          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-t3"
              >
                {d}
              </div>
            ))}
            {celulas.map((c) => {
              const doDia = postsPorData.get(c.iso) ?? [];
              const ehHoje = c.iso === hojeIso;
              return (
                <div
                  key={c.iso}
                  className={`min-h-[140px] rounded-lg border p-1.5 transition ${
                    ehHoje
                      ? 'border-transparent bg-white ring-2 ring-inset ring-[var(--cal-agendado)]'
                      : c.noMes
                        ? 'border-[rgba(21,21,33,0.06)] bg-white'
                        : 'border-[rgba(21,21,33,0.04)] bg-bgSoft/40'
                  }`}
                >
                  <div
                    className={`mb-1 text-[11px] font-semibold ${
                      ehHoje
                        ? 'text-[var(--cal-agendado)]'
                        : c.noMes
                          ? 'text-t2'
                          : 'text-t3/60'
                    }`}
                  >
                    {c.dia}
                    {ehHoje && (
                      <span className="ml-1 text-[9px] font-bold uppercase">hoje</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {doDia.map((p) => {
                      const b = balde(p);
                      const info = BUCKET_INFO[b];
                      const titulo = tituloSeguro(p.titulo);
                      const nomeCliente = p.projetoNome ? semEmoji(p.projetoNome) : '';
                      return (
                        <Link
                          key={p.id}
                          href={`/post/${p.id}`}
                          className="block rounded-md px-1.5 py-1 transition hover:opacity-80"
                          style={{
                            background: info.bg,
                            color: info.fg,
                            borderLeft: verTodos && p.projetoId
                              ? `3px solid ${corCliente(p.projetoId)}`
                              : undefined,
                          }}
                          title={`${titulo}${nomeCliente ? ` · ${nomeCliente}` : ''} · ${info.label}`}
                        >
                          <span className="block truncate text-[10px] font-semibold leading-tight">
                            {titulo}
                          </span>
                          {verTodos && nomeCliente && (
                            <span className="mt-0.5 block truncate text-[9px] font-medium opacity-70">
                              {nomeCliente}
                            </span>
                          )}
                          <span
                            className="mt-1 inline-block max-w-full truncate rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-[0.06em] text-white"
                            style={{ background: info.fg }}
                          >
                            {FORMATO_LABELS[p.tipo] ?? 'Post'}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legenda de cores por cliente (só quando "Todos") */}
        {verTodos && projetos.length > 1 && (
          <div className="mt-4 rounded-xl border border-[rgba(21,21,33,0.06)] bg-white p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Cliente (barra lateral do post)
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
              {projetos.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-1 rounded-sm"
                    style={{ background: corCliente(p.id) }}
                  />
                  <span className="text-t2">{p.nome}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {posts.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-[rgba(21,21,33,0.15)] bg-white p-10 text-center">
            <div className="text-[14px] font-semibold text-ink">
              Nenhum post neste mês
            </div>
            <p className="mt-1 text-[12px] text-t3">
              {verTodos
                ? 'Nenhum cliente tem posts programados aqui.'
                : 'Esse cliente não tem posts nesse mês. Troque de cliente ou mês.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
