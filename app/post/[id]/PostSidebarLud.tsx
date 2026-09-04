'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TarefaDoPost } from '@/lib/notion';
import type { ProgramacaoConfig } from '@/lib/supabase';

/**
 * Sidebar da visão interna Lud. — layout do mockup (3 cards):
 *   1. Status do post   — pill do Status Geral + chips de troca rápida
 *   2. Todas as tarefas — lista com categoria + data + pill status colorida
 *   3. Programação      — mini cards Data/Horário + botão pra /programacao/[id]
 */
export function PostSidebarLud({
  postId,
  status,
  tarefas,
  configProgramacao,
  dataPostagem,
}: {
  postId: string;
  status: string | null;
  tarefas: TarefaDoPost[];
  configProgramacao: ProgramacaoConfig;
  dataPostagem: string | null;
}) {
  return (
    <div className="space-y-4">
      <StatusDoPostCard postId={postId} status={status} />
      <TodasTarefasCard tarefas={tarefas} />
      <ProgramacaoCard
        postId={postId}
        configProgramacao={configProgramacao}
        dataPostagem={dataPostagem}
      />
    </div>
  );
}

// ============================================================================
// Card 1 — Status do post
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

export function StatusDoPostCard({
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

  const cores = atual ? coresDoStatus(atual) : null;

  return (
    <div className="card p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-t3">
        Status do post
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {atual && cores && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.05em]"
            style={{ background: cores.bg, color: cores.fg }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: cores.fg }}
            />
            {atual}
          </span>
        )}
        <span className="font-mono text-[10.5px] text-t3">
          Status Geral (Notion)
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUS_OPCOES.map((opt) => {
          const selecionado = opt === atual;
          const desabilitado = loading !== null;
          const isLoading = loading === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => trocar(opt)}
              disabled={desabilitado || selecionado}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed ${
                selecionado
                  ? 'border-[var(--cal-aprovacao)] bg-[var(--cal-aprovacao)] text-white'
                  : 'border-[rgba(21,21,33,0.13)] bg-white text-t2 hover:text-ink hover:border-[rgba(21,21,33,0.25)] disabled:opacity-40'
              }`}
              title={selecionado ? 'Status atual' : `Trocar pra ${opt}`}
            >
              {isLoading ? '…' : opt}
            </button>
          );
        })}
      </div>
      {erro && (
        <p className="mt-2 rounded-md bg-[var(--prazo-atrasado-soft)] px-2 py-1 text-[11px] text-[var(--prazo-atrasado)]">
          {erro}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Card 2 — Todas as tarefas
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
  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => !t.aberta || t.finalizada).length;

  // Ordena: mais antigas primeiro; sem prazo pro fim
  const ordenadas = [...tarefas].sort((a, b) => {
    if (!a.prazo && !b.prazo) return 0;
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo.localeCompare(b.prazo);
  });

  if (total === 0) {
    return (
      <div className="card p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-t3">
          Todas as tarefas
        </div>
        <p className="mt-3 text-[12px] text-t3">
          Nenhuma tarefa relacionada a este post.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-t3">
          Todas as tarefas
        </div>
        <span className="font-mono text-[10.5px] text-t3">
          {concluidas}/{total} concluídas
        </span>
      </div>
      <ul className="mt-1 divide-y divide-[rgba(21,21,33,0.06)]">
        {ordenadas.map((t) => {
          const ui = statusUIDaTarefa(t);
          return (
            <li
              key={t.tarefaId}
              className="flex items-center gap-2.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-t3">
                  {CATEGORIA_LABEL[t.categoria]}
                </div>
                <div
                  className={`truncate text-[12.5px] text-t1 ${
                    ui === 'now' ? 'font-semibold' : 'font-medium'
                  }`}
                  title={t.titulo}
                >
                  {t.titulo}
                </div>
              </div>
              <span className="whitespace-nowrap font-mono text-[10.5px] text-t3">
                {fmtDataCurta(t.prazo)}
              </span>
              <span
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.03em] ${classeStatusUI(
                  ui,
                )}`}
              >
                {labelStatusUI(ui)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// Card 3 — Programação
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
    <div className="card p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-t3">
        Programação
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-bgSoft/60 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-t3">
            Data
          </div>
          <div className="mt-0.5 font-mono text-[13px] text-t1">
            {fmtDataProgramacao(data)}
          </div>
        </div>
        <div className="rounded-xl bg-bgSoft/60 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-t3">
            Horário
          </div>
          <div className="mt-0.5 font-mono text-[13px] text-t1">{horario}</div>
        </div>
      </div>
      <Link
        href={`/programacao/${postId}`}
        className="mt-3 block rounded-xl border border-[rgba(21,21,33,0.13)] bg-bgSoft/60 px-4 py-2.5 text-center text-[12.5px] font-semibold text-ink transition hover:bg-bgSoft"
      >
        Abrir /programacao →
      </Link>
    </div>
  );
}
