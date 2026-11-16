'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PostCalendario } from '@/lib/notion';
import { CalendarMes } from '@/app/_components/CalendarMes';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function diaSemana(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Calendário da página do projeto: grade ou lista, no mesmo bloco. Trocar de
 * mês busca só os posts do mês novo (sem recarregar a página nem perder a
 * posição). Hoje fica bem marcado.
 */
export function CalendarioProjeto({
  projetoId,
  ano,
  mes,
  postsIniciais,
  hojeIso,
}: {
  projetoId: string;
  ano: number;
  mes: number;
  postsIniciais: PostCalendario[];
  hojeIso: string;
}) {
  const [atual, setAtual] = useState({ ano, mes });
  const [posts, setPosts] = useState(postsIniciais);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [modo, setModo] = useState<'grade' | 'lista'>('grade');
  const [previa, setPrevia] = useState<string | null>(null);

  async function irPara(delta: number) {
    const idx = atual.ano * 12 + (atual.mes - 1) + delta;
    const novo = { ano: Math.floor(idx / 12), mes: (idx % 12) + 1 };
    setAtual(novo);
    setCarregando(true);
    setErro(false);
    try {
      const r = await fetch(
        `/api/admin/projetos/${projetoId}/posts?mes=${novo.ano}-${String(novo.mes).padStart(2, '0')}`,
      );
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { posts: PostCalendario[] };
      setPosts(j.posts);
    } catch {
      setErro(true);
      setPosts([]);
    } finally {
      setCarregando(false);
    }
  }

  const lista = useMemo(
    () => [...posts].sort((a, b) => a.data.localeCompare(b.data)),
    [posts],
  );
  const faltaProgramar = posts.filter((p) => /programar/i.test(p.tarefaAtualTitulo ?? '')).length;
  const publicados = posts.filter((p) => p.cor === 'publicado').length;

  const btnSeta =
    'flex h-9 w-9 items-center justify-center rounded-[10px] border border-[rgba(21,21,33,0.1)] bg-white text-[16px] text-ink transition hover:bg-bgSoft';

  return (
    <section className="rounded-[22px] bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-t2">Calendário</span>
          <button type="button" aria-label="Mês anterior" onClick={() => irPara(-1)} className={btnSeta}>
            ‹
          </button>
          <h2 className="min-w-[150px] text-center text-[19px] font-semibold capitalize tracking-[-0.01em] text-ink">
            {MESES[atual.mes - 1]} {atual.ano}
          </h2>
          <button type="button" aria-label="Próximo mês" onClick={() => irPara(1)} className={btnSeta}>
            ›
          </button>
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-[#313D65] px-3 py-1.5 text-[12.5px] font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Hoje é {SEMANA_LONGA[diaSemana(hojeIso)]}, {hojeIso.slice(8, 10)}/{hojeIso.slice(5, 7)}
          </span>
          {carregando && <span className="text-[12px] text-t3">carregando…</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[10px] bg-[#F2F2F4] p-[3px]">
            {(['grade', 'lista'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`rounded-lg px-3.5 py-2 text-[13px] transition ${
                  modo === m ? 'bg-white font-semibold text-ink shadow-sm' : 'text-t2 hover:text-ink'
                }`}
              >
                {m === 'grade' ? '▦ Grade' : '☰ Lista'}
              </button>
            ))}
          </div>
          <Link
            href={`/admin/projetos/${projetoId}/calendario-workspace`}
            className="rounded-[10px] bg-ink px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
          >
            + Criar calendário
          </Link>
        </div>
      </div>

      {erro && (
        <p className="mb-3 rounded-md bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] text-[var(--prazo-atrasado)]">
          Não consegui carregar esse mês. Tente de novo.
        </p>
      )}

      <div className={carregando ? 'opacity-50 transition' : 'transition'}>
        {modo === 'grade' ? (
          <CalendarMes year={atual.ano} month={atual.mes} posts={posts} comPrevia destacarHoje />
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-t2">
              <span className="font-semibold text-ink">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'} no mês
              </span>
              <span>· {publicados} no ar</span>
              {faltaProgramar > 0 && <span>· {faltaProgramar} falta programar</span>}
            </div>
            {lista.length === 0 && (
              <p className="rounded-xl border border-dashed border-[rgba(21,21,33,0.12)] px-4 py-6 text-center text-[13px] text-t2">
                Nenhum post nesse mês.
              </p>
            )}
            {lista.map((p) => {
              const iso = p.data.slice(0, 10);
              const hoje = iso === hojeIso;
              const passado = iso < hojeIso;
              const status = p.statusGeral ?? p.etapaLabel;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPrevia(p.id)}
                  className={`grid w-full grid-cols-[64px_44px_minmax(0,1fr)] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-navy/30 sm:grid-cols-[64px_44px_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1.3fr)] ${
                    hoje
                      ? 'border-[#313D65] bg-[#EEF1F8]'
                      : passado
                        ? 'border-[rgba(21,21,33,0.05)] bg-[#FAFAFB]'
                        : 'border-[rgba(21,21,33,0.08)] bg-white'
                  }`}
                >
                  <span className={`text-[15px] font-bold ${passado ? 'text-t3' : 'text-ink'}`}>
                    {iso.slice(8, 10)}/{iso.slice(5, 7)}
                  </span>
                  <span className="text-[12px] font-semibold text-t2">{hoje ? 'HOJE' : SEMANA[diaSemana(iso)]}</span>
                  <span className="truncate text-[14px] font-semibold text-ink">{p.titulo}</span>
                  <span className="hidden text-[12px] text-t2 sm:block">{p.formatoNome ?? (p.tipo === 'reels' ? 'Reels' : 'Post')}</span>
                  <span className="hidden sm:block">
                    <span
                      className="inline-block max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: `var(--cal-${p.cor}-soft)`, color: `var(--cal-${p.cor})` }}
                    >
                      {status}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {previa && <PreviaPostModal postId={previa} fechar={() => setPrevia(null)} />}
    </section>
  );
}
