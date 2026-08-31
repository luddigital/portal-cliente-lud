'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PostCalendario } from '@/lib/notion';
import { PostInfoModal } from './PostInfoModal';
import { NovoPostModal, type NovoPost } from './NovoPostModal';

const DIAS = ['seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.', 'dom.'];

type Tipo = 'post' | 'reels' | 'story';

// Mesmas cores de status da home (/gestao) — mapeadas pelo campo `cor` do post.
const COR_STATUS: Record<PostCalendario['cor'], { bg: string; fg: string }> = {
  rascunho: { bg: 'var(--cal-rascunho-soft)', fg: 'var(--cal-rascunho)' },
  aprovacao: { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' },
  alteracao: { bg: 'var(--cal-alteracao-soft)', fg: 'var(--cal-alteracao)' },
  aguardando: { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' },
  agendado: { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' },
  publicado: { bg: 'var(--prazo-em-dia-soft)', fg: 'var(--prazo-em-dia)' },
};

type CalPost = {
  id: string;
  titulo: string;
  projetoNome: string;
  data: string;
  tipo: Tipo;
  icon: string | null;
  tag: string;
  status: string | null;
  cor: PostCalendario['cor'];
  local: boolean;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function ehPostado(status: string | null): boolean {
  return (
    (status ?? '')
      .normalize('NFD')
      .replace(/[^a-zA-Z]/g, '')
      .toLowerCase() === 'postado'
  );
}

function PostIcon({ icon, tipo }: { icon: string | null; tipo: Tipo }) {
  if (icon && icon.startsWith('http')) {
    return (
      <img
        src={icon}
        alt=""
        className="h-3.5 w-3.5 shrink-0 rounded-sm object-contain"
      />
    );
  }
  const fallback = tipo === 'reels' ? '🎬' : tipo === 'story' ? '📱' : '🖼️';
  return (
    <span className="shrink-0 text-[12px] leading-none">{icon || fallback}</span>
  );
}

function PostCard({ p, onClick }: { p: CalPost; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${p.projetoNome} — ${p.titulo}`}
      className={`w-full rounded-lg border bg-white p-2 text-left transition hover:border-navy/30 hover:shadow-sm ${
        p.local
          ? 'border-dashed border-[rgba(21,21,33,0.25)]'
          : 'border-[rgba(21,21,33,0.1)]'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <span className="mt-px">
          <PostIcon icon={p.icon} tipo={p.tipo} />
        </span>
        <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-ink">
          {p.titulo}
        </span>
      </div>
      <div className="mt-1 truncate text-[10px] text-t3">{p.projetoNome}</div>
      <span
        className="mt-1.5 inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.03em]"
        style={{ background: COR_STATUS[p.cor].bg, color: COR_STATUS[p.cor].fg }}
      >
        {p.tag}
      </span>
    </button>
  );
}

export function PostagensView({
  inicioISO,
  posts,
  rotuloSemana,
  prevSemana,
  nextSemana,
}: {
  inicioISO: string;
  posts: PostCalendario[];
  rotuloSemana: string;
  prevSemana: string;
  nextSemana: string;
}) {
  const [aba, setAba] = useState<'postagens' | 'stories'>('postagens');
  const [filtro, setFiltro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<{ id: string; projetoNome: string } | null>(
    null,
  );
  const [novo, setNovo] = useState<{ data: string } | null>(null);
  const [locais, setLocais] = useState<CalPost[]>([]);

  // 7 dias da semana a partir da segunda.
  const dias = useMemo(() => {
    const inicio = new Date(inicioISO + 'T00:00:00');
    const hojeISO = ymd(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      const iso = ymd(d);
      return { iso, nome: DIAS[i], num: d.getDate(), hoje: iso === hojeISO };
    });
  }, [inicioISO]);

  const todos: CalPost[] = useMemo(() => {
    const doNotion: CalPost[] = posts.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      projetoNome: p.projetoNome,
      data: p.data.slice(0, 10),
      tipo: p.tipo,
      icon: p.icon,
      tag: ehPostado(p.status)
        ? 'Postado'
        : p.tarefaAtualTitulo ?? p.etapaLabel,
      status: p.status,
      cor: p.cor,
      local: false,
    }));
    return [...doNotion, ...locais];
  }, [posts, locais]);

  const clientes = useMemo(
    () =>
      [...new Set(todos.map((p) => p.projetoNome))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [todos],
  );

  const daAba = todos.filter((p) =>
    aba === 'stories' ? p.tipo === 'story' : p.tipo !== 'story',
  );
  const visiveis = filtro
    ? daAba.filter((p) => p.projetoNome === filtro)
    : daAba;

  const porDia = useMemo(() => {
    const m = new Map<string, CalPost[]>();
    for (const p of visiveis) {
      if (!m.has(p.data)) m.set(p.data, []);
      m.get(p.data)!.push(p);
    }
    return m;
  }, [visiveis]);

  function criarLocal(np: NovoPost) {
    setLocais((l) => [
      ...l,
      {
        id: `local-${Date.now()}`,
        titulo: np.titulo,
        projetoNome: np.cliente,
        data: np.data,
        tipo: np.formato,
        icon: null,
        tag: 'Rascunho local',
        status: null,
        cor: 'rascunho',
        local: true,
      },
    ]);
    setAba(np.formato === 'story' ? 'stories' : 'postagens');
    setNovo(null);
  }

  return (
    <div>
      {/* topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
          Postagens
        </h1>
        <button
          type="button"
          onClick={() => setNovo({ data: '' })}
          className="btn-primary text-[13px]"
        >
          + Novo post
        </button>
      </div>

      {/* abas */}
      <div className="mt-4 flex gap-1.5">
        <TabBtn ativo={aba === 'postagens'} onClick={() => setAba('postagens')}>
          Postagens
        </TabBtn>
        <TabBtn ativo={aba === 'stories'} onClick={() => setAba('stories')}>
          Direcionamento de Stories
        </TabBtn>
      </div>

      {/* navegação de semana + filtros */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/postagens?semana=${prevSemana}`}
            aria-label="Semana anterior"
            className="rounded-full bg-bgSoft px-2.5 py-1 text-[14px] text-t2 transition hover:text-ink"
          >
            ‹
          </Link>
          <span className="min-w-[190px] text-center text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {rotuloSemana}
          </span>
          <Link
            href={`/admin/postagens?semana=${nextSemana}`}
            aria-label="Próxima semana"
            className="rounded-full bg-bgSoft px-2.5 py-1 text-[14px] text-t2 transition hover:text-ink"
          >
            ›
          </Link>
          <Link
            href="/admin/postagens"
            className="rounded-full bg-bgSoft px-2.5 py-1 text-[11px] font-medium text-t2 transition hover:text-ink"
          >
            Hoje
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FiltroChip ativo={filtro === null} onClick={() => setFiltro(null)}>
            Todos
          </FiltroChip>
          {clientes.map((c) => (
            <FiltroChip key={c} ativo={filtro === c} onClick={() => setFiltro(c)}>
              {c}
            </FiltroChip>
          ))}
        </div>
      </div>

      {/* semana em colunas */}
      <div className="mt-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        <div className="grid min-w-[920px] grid-cols-7 gap-2">
          {dias.map((d) => {
            const lista = porDia.get(d.iso) ?? [];
            return (
              <div
                key={d.iso}
                className={`rounded-xl border p-2 ${
                  d.hoje
                    ? 'border-navy/40 bg-[rgba(49,61,101,0.04)]'
                    : 'border-[rgba(21,21,33,0.08)] bg-bgSoft'
                }`}
              >
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-t3">
                      {d.nome}
                    </span>
                    <span
                      className={`text-[14px] font-semibold tracking-[-0.02em] ${
                        d.hoje ? 'text-navy' : 'text-ink'
                      }`}
                    >
                      {d.num}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNovo({ data: d.iso })}
                    aria-label="Novo post nesse dia"
                    className="rounded-md px-1.5 text-[15px] leading-none text-t3 transition hover:bg-white hover:text-ink"
                  >
                    +
                  </button>
                </div>
                <div className="space-y-1.5">
                  {lista.map((p) => (
                    <PostCard
                      key={p.id}
                      p={p}
                      onClick={() => {
                        if (!p.local) {
                          setAberto({ id: p.id, projetoNome: p.projetoNome });
                        }
                      }}
                    />
                  ))}
                  {lista.length === 0 && (
                    <div className="py-2 text-center text-[10px] text-t3">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {aberto && (
        <PostInfoModal
          postId={aberto.id}
          projetoNome={aberto.projetoNome}
          onClose={() => setAberto(null)}
        />
      )}
      {novo && (
        <NovoPostModal
          clientes={clientes}
          dataInicial={novo.data || undefined}
          onCriar={criarLocal}
          onClose={() => setNovo(null)}
        />
      )}
    </div>
  );
}

function TabBtn({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3.5 py-2 text-[13px] font-medium transition ${
        ativo ? 'bg-ink text-white' : 'bg-bgSoft text-t2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
        ativo ? 'bg-ink text-white' : 'bg-bgSoft text-t2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
