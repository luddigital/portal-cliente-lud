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

type StatusPrazo = {
  label: string;
  bg: string;
  fg: string;
};

/** Classifica o prazo da tarefa numa pill colorida. */
function statusDoPrazo(iso: string | null): StatusPrazo | null {
  if (!iso) return { label: 'Sem prazo', bg: 'var(--bgSoft)', fg: 'var(--t3)' };
  const dias = diasAte(iso);
  if (dias < 0) {
    return {
      label: dias === -1 ? 'Atrasada · 1 dia' : `Atrasada · ${-dias} dias`,
      bg: 'var(--prazo-atrasado-soft)',
      fg: 'var(--prazo-atrasado)',
    };
  }
  if (dias === 0) return { label: 'Hoje', bg: 'var(--prazo-hoje-soft)', fg: 'var(--prazo-hoje)' };
  if (dias === 1) return { label: 'Amanhã', bg: 'var(--prazo-hoje-soft)', fg: 'var(--prazo-hoje)' };
  if (dias <= 3) return { label: `Chegando · em ${dias}d`, bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' };
  if (dias <= 7) return { label: `Em ${dias} dias`, bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' };
  return null; // mais à frente — sem pill pra não poluir
}

function PillPrazo({ iso }: { iso: string | null }) {
  const s = statusDoPrazo(iso);
  if (!s) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
      style={{ background: s.bg, color: s.fg }}
    >
      <span
        className="inline-block h-1 w-1 rounded-full"
        style={{ background: 'currentColor' }}
      />
      {s.label}
    </span>
  );
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
        {grupos.map((g) => {
          // Quando o grupo já é por dia, a urgência tá implícita no título.
          // Mantemos só a contagem total + pill de atrasadas (única coisa
          // que o título sozinho não comunica — é o agrupado de TODAS as
          // atrasadas, com prazos variados dentro).
          const atrasadasNoGrupo = g.tarefas.filter(
            (t) => t.prazo && diasAte(t.prazo) < 0,
          ).length;
          const ehGrupoAtrasadas = g.titulo === 'Atrasadas';
          return (
          <div key={g.titulo} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className="text-[13px] font-semibold tracking-[-0.01em]"
                style={{
                  color: ehGrupoAtrasadas ? 'var(--prazo-atrasado)' : 'var(--ink)',
                }}
              >
                {g.titulo}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {atrasadasNoGrupo > 0 && !ehGrupoAtrasadas && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: 'var(--prazo-atrasado-soft)',
                      color: 'var(--prazo-atrasado)',
                    }}
                  >
                    {atrasadasNoGrupo} atrasada{atrasadasNoGrupo > 1 ? 's' : ''}
                  </span>
                )}
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: ehGrupoAtrasadas
                      ? 'var(--prazo-atrasado-soft)'
                      : 'var(--bgSoft)',
                    color: ehGrupoAtrasadas
                      ? 'var(--prazo-atrasado)'
                      : 'var(--t2)',
                  }}
                >
                  {g.tarefas.length} {g.tarefas.length === 1 ? 'post' : 'posts'}
                </span>
              </div>
            </div>
            <ul className="mt-3 space-y-1">
              {g.tarefas.map((t) => (
                <li key={t.tarefaId} data-tarefa-id={t.tarefaId}>
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
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-ink">
                        {t.postTitulo || t.titulo}
                      </div>
                      {(t.clienteNome ?? t.projetoNome) && (
                        <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-t3">
                          {t.clienteNome ?? t.projetoNome}
                        </div>
                      )}
                    </div>
                    <PillPrazo iso={t.prazo} />
                    <BotaoConcluir tarefaId={t.tarefaId} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          );
        })}
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
