'use client';

import { useState } from 'react';
import type { TarefaDaEntrega } from '@/lib/notion';
import { BotaoConcluir } from './BotaoConcluir';
import { PostModal } from './PostModal';

const MESES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
}

/** Bloco de data à esquerda da tarefa (mês + dia). */
function DataBox({ iso }: { iso: string | null }) {
  if (!iso) {
    return (
      <div className="w-[46px] shrink-0 text-center">
        <div className="text-[16px] font-semibold leading-none text-t3">—</div>
      </div>
    );
  }
  const dias = diasAte(iso);
  const [, m, d] = iso.split('T')[0].split('-');
  const cor =
    dias < 0
      ? 'var(--prazo-atrasado)'
      : dias === 0
        ? 'var(--prazo-hoje)'
        : undefined;
  return (
    <div className="w-[46px] shrink-0 text-center">
      <div
        className="text-[9px] font-semibold uppercase tracking-[0.1em] text-t3"
        style={cor ? { color: cor } : undefined}
      >
        {MESES_ABREV[parseInt(m, 10) - 1] ?? ''}
      </div>
      <div
        className="mt-px text-[20px] font-semibold leading-none tracking-[-0.03em] text-ink"
        style={cor ? { color: cor } : undefined}
      >
        {d}
      </div>
    </div>
  );
}

type Grupo = { titulo: string; tarefas: TarefaDaEntrega[] };

export function EntregaTarefas({ grupos }: { grupos: Grupo[] }) {
  const [aberto, setAberto] = useState<TarefaDaEntrega | null>(null);

  return (
    <>
      <div className="space-y-3">
        {grupos.map((g) => (
          <div key={g.titulo} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                {g.titulo}
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: 'var(--prazo-hoje-soft)',
                  color: 'var(--prazo-hoje)',
                }}
              >
                {g.tarefas.length}
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {g.tarefas.map((t) => (
                <li key={t.tarefaId}>
                  <div
                    role={t.postId ? 'button' : undefined}
                    onClick={() => {
                      if (t.postId) setAberto(t);
                    }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-bgSoft ${
                      t.postId ? 'cursor-pointer' : ''
                    }`}
                  >
                    <DataBox iso={t.prazo} />
                    <div className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {t.postTitulo || t.titulo}
                    </div>
                    <BotaoConcluir tarefaId={t.tarefaId} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {aberto && aberto.postId && (
        <PostModal
          postId={aberto.postId}
          tarefaId={aberto.tarefaId}
          tarefaTitulo={aberto.titulo}
          onClose={() => setAberto(null)}
        />
      )}
    </>
  );
}
