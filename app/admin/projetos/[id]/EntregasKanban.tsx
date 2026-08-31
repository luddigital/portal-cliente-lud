'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PostCalendario } from '@/lib/notion';
import {
  COLUNAS_ENTREGA,
  postParaEtapaEntrega,
  saudePrazo,
  faixaEntrega,
  type EtapaEntrega,
  type SaudePrazo,
} from '@/lib/entregas';

type Filtro = 'todas' | 'atrasadas' | 'aguardando' | 'programar';

function emojiTipo(p: PostCalendario): string {
  if (p.tipo === 'reels') return '🎬';
  if (p.tipo === 'story') return '📱';
  return '📄';
}

function fmtDia(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${String(d.getDate()).padStart(2, '0')}/${mes}`;
}

/** Rótulo + tom da pill de prazo, tratando "bola com o cliente" à parte. */
function pill(p: PostCalendario, s: SaudePrazo): { cls: string; label: string } {
  if (s.estado === 'atrasado') return { cls: 'atrasado', label: s.label };
  if (p.etapa === 'aguardando' || p.etapa === 'aprovacao') {
    return { cls: s.estado === 'hoje' ? 'hoje' : 'chegando', label: 'com cliente' };
  }
  if (s.estado === 'hoje') return { cls: 'hoje', label: 'hoje' };
  if (s.estado === 'chegando') return { cls: 'chegando', label: s.label };
  if (s.estado === 'em-dia') return { cls: 'em-dia', label: 'em dia' };
  return { cls: 'tranquilo', label: 'tranquilo' };
}

type PostComEtapa = {
  post: PostCalendario;
  etapa: EtapaEntrega;
  saude: SaudePrazo;
};

export function EntregasKanban({
  posts,
  hojeIso,
}: {
  posts: PostCalendario[];
  hojeIso: string;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const enriquecidos: PostComEtapa[] = useMemo(
    () =>
      posts.map((post) => ({
        post,
        etapa: postParaEtapaEntrega(post),
        saude: saudePrazo(post, hojeIso),
      })),
    [posts, hojeIso],
  );

  const atrasadas = enriquecidos.filter((e) => e.saude.estado === 'atrasado').length;

  const filtrados = useMemo(() => {
    switch (filtro) {
      case 'atrasadas':
        return enriquecidos.filter((e) => e.saude.estado === 'atrasado');
      case 'aguardando':
        return enriquecidos.filter(
          (e) => e.post.etapa === 'aguardando' || e.post.etapa === 'aprovacao',
        );
      case 'programar':
        return enriquecidos.filter((e) => e.etapa === 'programacao');
      default:
        return enriquecidos;
    }
  }, [enriquecidos, filtro]);

  const porColuna = useMemo(() => {
    const m = new Map<EtapaEntrega, PostComEtapa[]>();
    for (const col of COLUNAS_ENTREGA) m.set(col.id, []);
    for (const e of filtrados) m.get(e.etapa)!.push(e);
    // dentro da coluna: mais urgentes primeiro
    for (const lista of m.values()) lista.sort((a, b) => a.saude.dias - b.saude.dias);
    return m;
  }, [filtrados]);

  const SEG: { id: Filtro; label: string; badge?: number }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'atrasadas', label: '⚠ Atrasadas', badge: atrasadas },
    { id: 'aguardando', label: 'Aguardando cliente' },
    { id: 'programar', label: 'Prontas p/ programar' },
  ];

  return (
    <div className="space-y-4">
      {atrasadas > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[rgba(192,71,55,0.22)] bg-[var(--prazo-atrasado-soft)] px-4 py-3 text-[12.5px] font-semibold text-[var(--prazo-atrasado)]">
          ⚠️ {atrasadas} {atrasadas === 1 ? 'entrega atrasada' : 'entregas atrasadas'} —
          data de postagem já passou e o post ainda não saiu.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-[rgba(21,21,33,0.08)] bg-bgSoft p-[3px]">
          {SEG.map((s) => {
            const on = filtro === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setFiltro(s.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  on ? 'bg-ink text-white' : 'text-t2 hover:text-ink'
                }`}
              >
                {s.label}
                {s.badge ? (
                  <span
                    className={`rounded-full px-1.5 text-[9.5px] font-bold ${
                      on ? 'bg-white/25 text-white' : 'bg-[var(--prazo-atrasado)] text-white'
                    }`}
                  >
                    {s.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUNAS_ENTREGA.map((col) => {
          const lista = porColuna.get(col.id) ?? [];
          const done = col.id === 'publicado';
          return (
            <div
              key={col.id}
              className={`flex shrink-0 flex-col gap-2.5 ${done ? 'w-[210px]' : 'w-[248px]'}`}
            >
              <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.05em] text-t2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: col.dot }}
                  />
                  {col.label}
                </span>
                <span className="font-mono text-[11px] font-bold text-t3">
                  {lista.length}
                </span>
              </div>

              {lista.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.12)] px-2 py-5 text-center text-[11px] text-t3">
                  {filtro === 'todas' ? 'nada aqui' : '—'}
                </div>
              ) : done ? (
                <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft p-3.5">
                  <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold text-[var(--cal-publicado)]">
                    ✓ {lista.length} {lista.length === 1 ? 'publicado' : 'publicados'}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {lista.map(({ post }) => (
                      <Link
                        key={post.id}
                        href={`/post/${post.id}`}
                        className="flex items-center justify-between gap-2 text-[11.5px] text-t2 transition hover:text-ink"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-t1">
                          {post.titulo}
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] text-t3">
                          {fmtDia(post.data)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                lista.map(({ post, saude }) => {
                  const faixa = faixaEntrega(post, saude);
                  const pl = pill(post, saude);
                  const perigo = saude.estado === 'atrasado';
                  return (
                    <Link
                      key={post.id}
                      href={`/post/${post.id}`}
                      className={`entrega-card ${faixa} block transition hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]`}
                    >
                      <div className="entrega-head">
                        <span className="entrega-icon">{emojiTipo(post)}</span>
                        <span className="entrega-title">{post.titulo}</span>
                      </div>
                      <div className="entrega-meta">
                        <div className="entrega-meta-item">
                          <span className={`entrega-meta-icon ${perigo ? 'danger' : 'info'}`}>🗓</span>
                          <div>
                            <div className="entrega-meta-label">Postagem</div>
                            <div className={`entrega-meta-value ${perigo ? 'danger' : ''}`}>
                              {fmtDia(post.data)}
                            </div>
                          </div>
                        </div>
                        <span className={`prazo-pill ${pl.cls} justify-self-end`}>
                          <span className="prazo-dot" />
                          {pl.label}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
