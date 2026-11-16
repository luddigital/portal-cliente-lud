'use client';

import { useEffect, useMemo, useState } from 'react';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';
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
type Ordem = 'urgencia' | 'distante' | 'titulo' | 'formato';

const ORDENS: { id: Ordem; label: string }[] = [
  { id: 'urgencia', label: 'Mais urgentes primeiro' },
  { id: 'distante', label: 'Mais distantes primeiro' },
  { id: 'titulo', label: 'Título (A–Z)' },
  { id: 'formato', label: 'Formato' },
];

const ORDEM_FORMATO: Record<PostCalendario['tipo'], number> = { post: 0, reels: 1, story: 2 };
const CHAVE_PREFS = 'kanban-entregas-prefs';
const TODAS_COLUNAS = COLUNAS_ENTREGA.map((c) => c.id);

function emojiTipo(p: PostCalendario): string {
  if (p.tipo === 'reels') return '📱';
  if (p.tipo === 'story') return '⭕';
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
  const [ordem, setOrdem] = useState<Ordem>('urgencia');
  const [ocultarVazias, setOcultarVazias] = useState(false);
  const [visiveis, setVisiveis] = useState<EtapaEntrega[]>(TODAS_COLUNAS);
  const [menuColunas, setMenuColunas] = useState(false);
  const [prefsCarregadas, setPrefsCarregadas] = useState(false);
  const [previaId, setPreviaId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_PREFS) ?? 'null');
      if (salvo) {
        if (ORDENS.some((o) => o.id === salvo.ordem)) setOrdem(salvo.ordem);
        if (typeof salvo.ocultarVazias === 'boolean') setOcultarVazias(salvo.ocultarVazias);
        if (Array.isArray(salvo.visiveis)) {
          const v = TODAS_COLUNAS.filter((c) => salvo.visiveis.includes(c));
          if (v.length) setVisiveis(v);
        }
      }
    } catch {
      /* sem storage: usa o padrão */
    }
    setPrefsCarregadas(true);
  }, []);

  useEffect(() => {
    if (!prefsCarregadas) return;
    try {
      localStorage.setItem(CHAVE_PREFS, JSON.stringify({ ordem, ocultarVazias, visiveis }));
    } catch {
      /* sem storage */
    }
  }, [ordem, ocultarVazias, visiveis, prefsCarregadas]);

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
    const cmp = (a: PostComEtapa, b: PostComEtapa): number => {
      switch (ordem) {
        case 'distante':
          return b.saude.dias - a.saude.dias;
        case 'titulo':
          return a.post.titulo.localeCompare(b.post.titulo, 'pt-BR');
        case 'formato':
          return (
            ORDEM_FORMATO[a.post.tipo] - ORDEM_FORMATO[b.post.tipo] || a.saude.dias - b.saude.dias
          );
        default:
          return a.saude.dias - b.saude.dias;
      }
    };
    for (const lista of m.values()) lista.sort(cmp);
    return m;
  }, [filtrados, ordem]);

  const colunasNaTela = COLUNAS_ENTREGA.filter(
    (c) => visiveis.includes(c.id) && (!ocultarVazias || (porColuna.get(c.id)?.length ?? 0) > 0),
  );

  function alternarColuna(id: EtapaEntrega) {
    setVisiveis((v) =>
      v.includes(id) ? (v.length > 1 ? v.filter((x) => x !== id) : v) : TODAS_COLUNAS.filter((c) => c === id || v.includes(c)),
    );
  }

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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(21,21,33,0.08)] bg-white px-3 py-1.5 text-[12px] font-semibold text-t2 transition hover:text-ink">
            <input
              type="checkbox"
              checked={ocultarVazias}
              onChange={(e) => setOcultarVazias(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#37352F]"
            />
            Ocultar vazias
          </label>

          <label className="flex items-center gap-1.5 rounded-full border border-[rgba(21,21,33,0.08)] bg-white py-1 pl-3 pr-1 text-[12px] font-semibold text-t2">
            Ordenar
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              className="rounded-full bg-bgSoft px-2 py-0.5 text-[12px] font-semibold text-ink outline-none"
            >
              {ORDENS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuColunas((v) => !v)}
              className="rounded-full border border-[rgba(21,21,33,0.08)] bg-white px-3 py-1.5 text-[12px] font-semibold text-t2 transition hover:text-ink"
            >
              Colunas {visiveis.length < TODAS_COLUNAS.length ? `(${visiveis.length}/${TODAS_COLUNAS.length})` : ''} ▾
            </button>
            {menuColunas && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuColunas(false)} />
                <div className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-xl border border-[rgba(21,21,33,0.1)] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  {COLUNAS_ENTREGA.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] text-ink hover:bg-bgSoft"
                    >
                      <input
                        type="checkbox"
                        checked={visiveis.includes(c.id)}
                        onChange={() => alternarColuna(c.id)}
                        className="h-3.5 w-3.5 accent-[#37352F]"
                      />
                      <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
                      <span className="flex-1">{c.label}</span>
                      <span className="font-mono text-[10.5px] text-t3">{porColuna.get(c.id)?.length ?? 0}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setVisiveis(TODAS_COLUNAS)}
                    className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[11.5px] text-t3 underline hover:text-ink"
                  >
                    Mostrar todas
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {colunasNaTela.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.12)] px-4 py-6 text-center text-[12px] text-t3">
          Nenhum post nas colunas escolhidas com esse filtro.
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto min-h-fit pb-2">
        {colunasNaTela.map((col) => {
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
                      <button
                        type="button"
                        key={post.id}
                        onClick={() => setPreviaId(post.id)}
                        className="flex items-center justify-between gap-2 text-left text-[11.5px] text-t2 transition hover:text-ink"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-t1">
                          {post.titulo}
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] text-t3">
                          {fmtDia(post.data)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                lista.map(({ post, saude }) => {
                  const faixa = faixaEntrega(post, saude);
                  const pl = pill(post, saude);
                  const perigo = saude.estado === 'atrasado';
                  return (
                    <button
                      type="button"
                      key={post.id}
                      onClick={() => setPreviaId(post.id)}
                      className={`entrega-card ${faixa} block w-full text-left transition hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]`}
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
                    </button>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {previaId && <PreviaPostModal postId={previaId} fechar={() => setPreviaId(null)} />}
    </div>
  );
}
