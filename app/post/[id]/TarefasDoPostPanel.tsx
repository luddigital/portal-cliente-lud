'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TarefaDoPost } from '@/lib/notion';

type Prioridade = 'atrasado' | 'hoje' | 'semana' | 'radar' | null;

function calcularPrioridade(prazo: string | null): Prioridade {
  if (!prazo) return null;
  const p = new Date(prazo);
  const agora = new Date();
  const hojeInicio = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
  );
  const hojeFim = new Date(hojeInicio);
  hojeFim.setDate(hojeFim.getDate() + 1);
  if (p < hojeInicio) return 'atrasado';
  if (p < hojeFim) return 'hoje';
  const semana = new Date(hojeInicio);
  semana.setDate(semana.getDate() + 7);
  if (p <= semana) return 'semana';
  return 'radar';
}

const PRIORIDADE_UI: Record<
  Exclude<Prioridade, null>,
  { emoji: string; label: string; color: string }
> = {
  atrasado: { emoji: '🚨', label: 'Atrasado', color: 'var(--prazo-hoje)' },
  hoje: { emoji: '📌', label: 'Hoje', color: 'var(--prazo-hoje)' },
  semana: { emoji: '👍', label: 'Próxima Semana', color: 'var(--cal-aprovacao)' },
  radar: { emoji: '🔮', label: 'No Radar', color: 'var(--cal-agendado)' },
};

const CATEGORIA_LABEL: Record<TarefaDoPost['categoria'], string> = {
  aprovacao: 'Aprovação',
  alteracao: 'Alteração',
  briefing: 'Briefing',
  arte: 'Arte',
  copy: 'Copy',
  outro: 'Outro',
};

function fmtDataCurta(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function TarefasDoPostPanel({
  tarefas: tarefasIniciais,
}: {
  tarefas: TarefaDoPost[];
}) {
  const router = useRouter();
  const [tarefas] = useState(tarefasIniciais);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abertas = tarefas.filter((t) => t.aberta);
  const fechadas = tarefas.filter((t) => !t.aberta);

  async function aprovar(t: TarefaDoPost) {
    setLoadingId(t.tarefaId);
    setError(null);
    try {
      const res = await fetch(`/api/tarefas/${t.tarefaId}/aprovar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingId(null);
    }
  }

  async function alterar(t: TarefaDoPost) {
    if (comentario.trim().length < 3) {
      setError('Escreva o pedido de alteração (mín. 3 caracteres).');
      return;
    }
    setLoadingId(t.tarefaId);
    setError(null);
    try {
      const res = await fetch(`/api/tarefas/${t.tarefaId}/alterar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setComentario('');
      setAbertoId(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingId(null);
    }
  }

  if (tarefas.length === 0) {
    return (
      <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-6 text-center">
        <div className="text-[13px] text-t3">
          Nenhuma tarefa relacionada a este post.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(21,21,33,0.06)] px-5 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            admin
          </div>
          <div className="mt-0.5 text-[15px] font-semibold text-ink">Tarefas do post</div>
        </div>
        <div className="text-[11px] text-t3">
          {abertas.length} aberta{abertas.length === 1 ? '' : 's'} ·{' '}
          {fechadas.length} concluída{fechadas.length === 1 ? '' : 's'}
        </div>
      </div>

      {error && (
        <div className="border-b border-[rgba(21,21,33,0.06)] bg-hubRed/5 px-5 py-2 text-[12px] font-medium text-hubRed">
          {error}
        </div>
      )}

      <ul className="divide-y divide-[rgba(21,21,33,0.06)]">
        {[...abertas, ...fechadas].map((t) => {
          const prio = t.aberta ? calcularPrioridade(t.prazo) : null;
          const prioUi = prio ? PRIORIDADE_UI[prio] : null;
          const podeAgir =
            t.aberta &&
            (t.categoria === 'aprovacao' || t.titulo.toLowerCase().includes('aprovação'));
          const isAberto = abertoId === t.tarefaId;
          return (
            <li key={t.tarefaId} className={`px-5 py-3 ${t.aberta ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {t.prazo && (
                    <div className="shrink-0 text-[11px] font-mono text-t2 min-w-[54px]">
                      {fmtDataCurta(t.prazo)}
                    </div>
                  )}
                  {prioUi ? (
                    <div
                      className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        background: `${prioUi.color}22`,
                        color: prioUi.color,
                      }}
                      title={prioUi.label}
                    >
                      <span>{prioUi.emoji}</span>
                      <span>{prioUi.label}</span>
                    </div>
                  ) : t.aberta ? null : (
                    <span className="shrink-0 rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-t3">
                      ✅ {t.status ?? 'Concluída'}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink">{t.titulo}</div>
                    <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.06em] text-t3">
                      {CATEGORIA_LABEL[t.categoria]}
                      {t.status && ` · ${t.status}`}
                    </div>
                  </div>
                  {t.pessoaAvatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.pessoaAvatar}
                      alt={t.pessoaNome ?? ''}
                      title={t.pessoaNome ?? ''}
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                  )}
                </div>
                {podeAgir && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAbertoId(isAberto ? null : t.tarefaId)
                      }
                      disabled={loadingId === t.tarefaId}
                      className="btn-ghost text-[11px]"
                    >
                      ❌ Alterar
                    </button>
                    <button
                      type="button"
                      onClick={() => aprovar(t)}
                      disabled={loadingId === t.tarefaId}
                      className="btn-primary text-[11px]"
                    >
                      {loadingId === t.tarefaId ? '...' : '✅ Aprovar'}
                    </button>
                  </div>
                )}
              </div>
              {isAberto && (
                <div className="mt-3 rounded-xl border border-[rgba(21,21,33,0.1)] bg-bgSoft/40 p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-t2">
                    O que precisa alterar?
                  </div>
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={3}
                    placeholder="Descreva o pedido — vai virar comentário no post e criar as tarefas Alteração + Aprovação."
                    className="input min-h-[70px] resize-y text-[12px]"
                    disabled={loadingId === t.tarefaId}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAbertoId(null);
                        setComentario('');
                        setError(null);
                      }}
                      disabled={loadingId === t.tarefaId}
                      className="btn-ghost text-[11px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => alterar(t)}
                      disabled={
                        loadingId === t.tarefaId || comentario.trim().length < 3
                      }
                      className="btn-primary text-[11px]"
                    >
                      {loadingId === t.tarefaId
                        ? 'Enviando...'
                        : 'Solicitar alteração'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
