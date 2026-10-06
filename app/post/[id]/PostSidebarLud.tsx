'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TarefaDoPost } from '@/lib/notion';
import type { ProgramacaoConfig } from '@/lib/supabase';

// ============================================================================
// Status do post — só os chips de troca rápida (o atual fica preenchido)
// ============================================================================

const STATUS_OPCOES = [
  'Em produção',
  'Aprovação',
  'Alteração',
  'Agendado',
  'Postado',
] as const;

type StatusChip = typeof STATUS_OPCOES[number];

/** Normaliza o status do Notion pra 1 dos 5 buckets. */
function bucketDoStatus(status: string | null): StatusChip | null {
  const s = (status ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('postado') || s.includes('publicado')) return 'Postado';
  if (s.includes('agendado') || s.includes('programad')) return 'Agendado';
  if (s.includes('altera')) return 'Alteração';
  if (s.includes('aprova')) return 'Aprovação';
  return 'Em produção';
}

function coresDoStatus(chip: StatusChip): { bg: string; fg: string } {
  switch (chip) {
    case 'Postado':
      return { bg: 'var(--prazo-em-dia-soft)', fg: 'var(--prazo-em-dia)' };
    case 'Agendado':
      return { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' };
    case 'Alteração':
      return { bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)' };
    case 'Aprovação':
      return { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' };
    case 'Em produção':
      return { bg: 'var(--prazo-hoje-soft)', fg: 'var(--prazo-hoje)' };
  }
}

export function StatusDoPostChips({
  postId,
  status,
}: {
  postId: string;
  status: string | null;
}) {
  const router = useRouter();
  const atual = bucketDoStatus(status);
  const [loading, setLoading] = useState<StatusChip | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function trocar(novo: StatusChip) {
    if (novo === atual) return;
    setLoading(novo);
    setErro(null);
    try {
      const res = await fetch(`/api/post/${postId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: novo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      router.refresh();
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Status
        </span>
        {STATUS_OPCOES.map((opt) => {
          const selecionado = opt === atual;
          const cores = coresDoStatus(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => trocar(opt)}
              disabled={loading !== null || selecionado}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed ${
                selecionado
                  ? 'text-white'
                  : 'border-[rgba(21,21,33,0.13)] bg-white text-t2 hover:border-[rgba(21,21,33,0.25)] hover:text-ink disabled:opacity-40'
              }`}
              style={
                selecionado
                  ? { background: cores.fg, borderColor: cores.fg }
                  : undefined
              }
              title={selecionado ? 'Status atual (Notion)' : `Trocar pra ${opt}`}
            >
              {loading === opt ? '…' : opt}
            </button>
          );
        })}
      </div>
      {erro && (
        <p className="rounded-md bg-[var(--prazo-atrasado-soft)] px-2 py-1 text-[11px] text-[var(--prazo-atrasado)]">
          {erro}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Tarefas — abertas em destaque, concluídas recolhidas num grid compacto
// ============================================================================

const CATEGORIA_LABEL: Record<TarefaDoPost['categoria'], string> = {
  aprovacao: 'Cliente',
  alteracao: 'Alteração',
  briefing: 'Briefing',
  arte: 'Arte',
  copy: 'Copy',
  outro: 'Outro',
};

type StatusUI = 'done' | 'now' | 'wait' | 'alt' | 'todo';

function statusUIDaTarefa(t: TarefaDoPost): StatusUI {
  const s = (t.status ?? '').trim().toLowerCase();
  if (!t.aberta || t.finalizada) return 'done';
  if (s.includes('altera')) return 'alt';
  // Tarefas do cliente aguardando ação
  if (s.includes('aguard')) return 'wait';
  // "Em andamento" / hoje / prazo próximo = now
  const prazo = t.prazo;
  if (prazo) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dt = new Date(prazo.split('T')[0] + 'T00:00:00');
    const dias = Math.round((dt.getTime() - hoje.getTime()) / 86_400_000);
    if (dias <= 1) return 'now';
  }
  return 'todo';
}

function labelStatusUI(u: StatusUI): string {
  switch (u) {
    case 'done': return 'Concluído';
    case 'now': return 'Em andamento';
    case 'wait': return 'Aguardando';
    case 'alt': return 'Alteração';
    case 'todo': return 'A fazer';
  }
}

function classeStatusUI(u: StatusUI): string {
  switch (u) {
    case 'done':
      return 'bg-[var(--prazo-em-dia-soft)] text-[var(--prazo-em-dia)]';
    case 'now':
      return 'bg-[var(--cal-aprovacao)] text-white';
    case 'wait':
      return 'bg-bgSoft text-t3';
    case 'alt':
      return 'bg-[var(--prazo-atrasado-soft)] text-[var(--prazo-atrasado)]';
    case 'todo':
      return 'bg-white text-t3 border border-[rgba(21,21,33,0.13)]';
  }
}

function fmtDataCurta(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((dt.getTime() - hoje.getTime()) / 86_400_000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${d} ${MES[m - 1]}`;
}

export function TodasTarefasCard({ tarefas }: { tarefas: TarefaDoPost[] }) {
  const [verConcluidas, setVerConcluidas] = useState(false);
  const total = tarefas.length;

  const porPrazo = (a: TarefaDoPost, b: TarefaDoPost) => {
    if (!a.prazo && !b.prazo) return 0;
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo.localeCompare(b.prazo);
  };
  const abertas = tarefas
    .filter((t) => statusUIDaTarefa(t) !== 'done')
    .sort(porPrazo);
  const concluidas = tarefas
    .filter((t) => statusUIDaTarefa(t) === 'done')
    .sort(porPrazo);
  const pct = total > 0 ? Math.round((concluidas.length / total) * 100) : 0;

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-t3">
          Tarefas
        </div>
        {total > 0 && (
          <span className="font-mono text-[10.5px] text-t3">
            {concluidas.length}/{total} concluídas
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-[12px] text-t3">
          Nenhuma tarefa relacionada a este post.
        </p>
      ) : (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bgSoft">
            <div
              className="h-full rounded-full bg-[var(--prazo-em-dia)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          {abertas.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {abertas.map((t) => {
                const ui = statusUIDaTarefa(t);
                return (
                  <li
                    key={t.tarefaId}
                    className="flex items-center gap-2.5 rounded-xl bg-bgSoft/60 px-3 py-2"
                  >
                    <span className="w-[68px] shrink-0 text-[9.5px] font-bold uppercase tracking-[0.06em] text-t3">
                      {CATEGORIA_LABEL[t.categoria]}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[12.5px] text-ink ${
                        ui === 'now' ? 'font-semibold' : 'font-medium'
                      }`}
                      title={t.titulo}
                    >
                      {t.titulo}
                    </span>
                    {t.pessoaNome && (
                      <span className="hidden shrink-0 text-[11px] text-t3 sm:inline">
                        {t.pessoaNome.split(' ')[0]}
                      </span>
                    )}
                    <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] text-t3">
                      {fmtDataCurta(t.prazo)}
                    </span>
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.03em] ${classeStatusUI(
                        ui,
                      )}`}
                    >
                      {labelStatusUI(ui)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] font-semibold text-[var(--prazo-em-dia)]">
              Tudo concluído ✨
            </p>
          )}

          {concluidas.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setVerConcluidas((v) => !v)}
                className="text-[11.5px] font-semibold text-t3 transition hover:text-ink"
              >
                {verConcluidas ? '▾' : '▸'} {verConcluidas ? 'Esconder' : 'Ver'}{' '}
                {concluidas.length}{' '}
                {concluidas.length === 1 ? 'concluída' : 'concluídas'}
              </button>
              {verConcluidas && (
                <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {concluidas.map((t) => (
                    <li
                      key={t.tarefaId}
                      className="flex min-w-0 items-center gap-1.5 text-[12px] text-t2"
                    >
                      <span className="shrink-0 text-[var(--prazo-em-dia)]">✓</span>
                      <span className="min-w-0 flex-1 truncate" title={t.titulo}>
                        {t.titulo}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-t3">
                        {fmtDataCurta(t.prazo)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Programação — linha compacta no fim da página
// ============================================================================

function fmtDataProgramacao(iso: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}`;
}

export function ProgramacaoCard({
  postId,
  configProgramacao,
  dataPostagem,
}: {
  postId: string;
  configProgramacao: ProgramacaoConfig;
  dataPostagem: string | null;
}) {
  // Prioriza data salva no Supabase; fallback pra Data Postagem do Notion.
  const data = configProgramacao.data || dataPostagem || null;
  const horario = configProgramacao.horario || '10:00';

  return (
    <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-t3">
        Programação
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Data
        </span>
        <span className="font-mono text-[13px] text-t1">
          {fmtDataProgramacao(data)}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Horário
        </span>
        <span className="font-mono text-[13px] text-t1">{horario}</span>
      </div>
      <Link
        href={`/programacao/${postId}`}
        className="ml-auto rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-bgSoft"
      >
        Programar →
      </Link>
    </div>
  );
}
