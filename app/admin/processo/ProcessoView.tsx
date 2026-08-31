'use client';

import Link from 'next/link';
import { useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────

type StatusEntrega = 'em_producao' | 'aguardando_cliente' | 'atrasada' | 'concluida';
type StatusTarefa = 'aberta' | 'atrasada' | 'concluida';

type Tarefa = {
  id: string;
  titulo: string;
  responsavel: string;
  prazo: string;
  status: StatusTarefa;
};

type Entrega = {
  id: string;
  nome: string;
  cliente: string;
  data: string; // ISO
  status: StatusEntrega;
  tarefas: Tarefa[];
};

// ─────────────────────────────────────────────────────────────────
// DADOS FAKE
// ─────────────────────────────────────────────────────────────────

const ENTREGAS: Entrega[] = [
  {
    id: 'e1',
    nome: 'Aprovação | Post',
    cliente: 'Descubra Paris',
    data: '2026-08-19',
    status: 'aguardando_cliente',
    tarefas: [
      { id: 't1', titulo: 'Aprovação | Louvre à noite', responsavel: 'Cliente', prazo: '2026-08-19', status: 'aberta' },
      { id: 't2', titulo: 'Aprovação | Cafés do Marais', responsavel: 'Cliente', prazo: '2026-08-19', status: 'aberta' },
      { id: 't3', titulo: 'Aprovação | Sena ao pôr do sol', responsavel: 'Cliente', prazo: '2026-08-19', status: 'aberta' },
    ],
  },
  {
    id: 'e2',
    nome: 'Arte',
    cliente: 'Descubra Paris',
    data: '2026-08-17',
    status: 'atrasada',
    tarefas: [
      { id: 't4', titulo: 'Arte | Louvre à noite', responsavel: 'Alisson', prazo: '2026-08-17', status: 'atrasada' },
      { id: 't5', titulo: 'Arte | Cafés do Marais', responsavel: 'Alisson', prazo: '2026-08-17', status: 'atrasada' },
    ],
  },
  {
    id: 'e3',
    nome: 'Briefing & Copy',
    cliente: 'Descubra Paris',
    data: '2026-08-16',
    status: 'atrasada',
    tarefas: [
      { id: 't6', titulo: 'Copy | Se seu sonho é vir a Paris', responsavel: 'Letícia', prazo: '2026-08-16', status: 'atrasada' },
      { id: 't7', titulo: 'Copy | Paris não é o que imagina', responsavel: 'Letícia', prazo: '2026-08-16', status: 'atrasada' },
    ],
  },
  {
    id: 'e4',
    nome: 'Programação',
    cliente: 'Nyorquina',
    data: '2026-08-22',
    status: 'em_producao',
    tarefas: [
      { id: 't8', titulo: 'Programar | Bagels de domingo', responsavel: 'Luiza', prazo: '2026-08-22', status: 'aberta' },
      { id: 't9', titulo: 'Programar | Central Park', responsavel: 'Luiza', prazo: '2026-08-22', status: 'aberta' },
      { id: 't10', titulo: 'Programar | Melhores rooftops NY', responsavel: 'Luiza', prazo: '2026-08-23', status: 'aberta' },
    ],
  },
  {
    id: 'e5',
    nome: 'Análise de Dados',
    cliente: 'Turismo em Chicago',
    data: '2026-08-15',
    status: 'concluida',
    tarefas: [
      { id: 't11', titulo: 'Fechamento de métricas | Jul/26', responsavel: 'Luiza', prazo: '2026-08-15', status: 'concluida' },
    ],
  },
  {
    id: 'e6',
    nome: 'Arte',
    cliente: 'Israel by Thati',
    data: '2026-08-14',
    status: 'atrasada',
    tarefas: [
      { id: 't12', titulo: 'Arte | Tel Aviv Beach', responsavel: 'Alisson', prazo: '2026-08-14', status: 'atrasada' },
      { id: 't13', titulo: 'Arte | Jerusalém antiga', responsavel: 'Alisson', prazo: '2026-08-14', status: 'atrasada' },
      { id: 't14', titulo: 'Arte | Mar Morto', responsavel: 'Alisson', prazo: '2026-08-15', status: 'atrasada' },
    ],
  },
  {
    id: 'e7',
    nome: 'Aprovação | Calendário Set/26',
    cliente: 'Descubra Paris',
    data: '2026-08-18',
    status: 'aguardando_cliente',
    tarefas: [
      { id: 't15', titulo: 'Aprovação | Calendário Set/26', responsavel: 'Cliente', prazo: '2026-08-18', status: 'aberta' },
    ],
  },
  {
    id: 'e8',
    nome: 'Briefing & Copy',
    cliente: 'TKRA-Takara',
    data: '2026-08-15',
    status: 'atrasada',
    tarefas: [
      { id: 't16', titulo: 'Copy | Nova coleção', responsavel: 'Letícia', prazo: '2026-08-15', status: 'atrasada' },
      { id: 't17', titulo: 'Copy | Reels tutorial', responsavel: 'Letícia', prazo: '2026-08-17', status: 'atrasada' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────

const STATUS_UI: Record<
  StatusEntrega,
  { classe: 'atrasada' | 'hoje' | 'em-dia' | 'aguardando'; label: string; emoji: string }
> = {
  em_producao: { classe: 'hoje', label: 'Em produção', emoji: '🎨' },
  aguardando_cliente: { classe: 'aguardando', label: 'Aguardando cliente', emoji: '⏳' },
  atrasada: { classe: 'atrasada', label: 'Atrasada', emoji: '🚨' },
  concluida: { classe: 'em-dia', label: 'Concluída', emoji: '✅' },
};

const COLUNAS: StatusEntrega[] = ['atrasada', 'em_producao', 'aguardando_cliente', 'concluida'];

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmtDataLonga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS_SEMANA[dt.getDay()]}, ${d} de ${MESES[m - 1]}`;
}

function fmtDataCurta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function diasParaHoje(iso: string, hojeIso = '2026-08-19'): number {
  const [ay, am, ad] = iso.split('-').map(Number);
  const [hy, hm, hd] = hojeIso.split('-').map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const h = new Date(hy, hm - 1, hd).getTime();
  return Math.round((a - h) / (24 * 60 * 60 * 1000));
}

function pillPrazo(iso: string): { classe: string; texto: string } {
  const d = diasParaHoje(iso);
  if (d < 0) return { classe: 'atrasado', texto: `atrasado ${-d}d` };
  if (d === 0) return { classe: 'hoje', texto: 'hoje' };
  if (d === 1) return { classe: 'chegando', texto: 'amanhã' };
  if (d <= 7) return { classe: 'chegando', texto: `em ${d}d` };
  return { classe: 'tranquilo', texto: `em ${d}d` };
}

// ─────────────────────────────────────────────────────────────────

export function ProcessoView() {
  // Bloco 1 — agrupa entregas por data (mais próxima em cima)
  const porData = useMemo(() => {
    const map = new Map<string, Entrega[]>();
    for (const e of ENTREGAS) {
      if (e.status === 'concluida') continue; // concluídas só no kanban
      if (!map.has(e.data)) map.set(e.data, []);
      map.get(e.data)!.push(e);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  // Bloco 2 — kanban por status
  const porStatus = useMemo(() => {
    const map = new Map<StatusEntrega, Entrega[]>();
    for (const s of COLUNAS) map.set(s, []);
    for (const e of ENTREGAS) map.get(e.status)!.push(e);
    return map;
  }, []);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Processo Social Media
            </h1>
            <p className="text-[11px] text-t3">Entregas + tarefas em produção agora</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        {/* ═══════════════ BLOCO 1 — POR DATA ═══════════════ */}
        <section className="space-y-3">
          <div>
            <div className="hub-section-title">Próximas entregas</div>
            <div className="hub-section-sub">Ordenadas por data. Mais próximo do vencimento em cima.</div>
          </div>
          <div className="space-y-2.5">
            {porData.map(([data, entregas]) => (
              <LinhaData key={data} data={data} entregas={entregas} />
            ))}
          </div>
        </section>

        {/* ═══════════════ BLOCO 2 — KANBAN ═══════════════ */}
        <section className="space-y-3">
          <div>
            <div className="hub-section-title">Resumo por status</div>
            <div className="hub-section-sub">
              Mesmas entregas agrupadas por estágio. Abaixo de cada entrega, as tarefas dela.
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 min-w-0">
            {COLUNAS.map((s) => (
              <ColunaKanban
                key={s}
                status={s}
                entregas={porStatus.get(s) ?? []}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BLOCO 1 — linha por data
// ─────────────────────────────────────────────────────────────────

function LinhaData({ data, entregas }: { data: string; entregas: Entrega[] }) {
  const prazo = pillPrazo(data);
  return (
    <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[rgba(21,21,33,0.06)] bg-bgSoft/40 px-4 py-2.5">
        <div className="text-[13px] font-semibold text-ink capitalize">
          {fmtDataLonga(data)}
        </div>
        <span className={`prazo-pill ${prazo.classe}`}>
          <span className="prazo-dot" />
          {prazo.texto}
        </span>
        <div className="ml-auto text-[10px] uppercase tracking-[0.06em] text-t3">
          {entregas.length} entrega{entregas.length === 1 ? '' : 's'}
        </div>
      </div>
      <div className="divide-y divide-[rgba(21,21,33,0.05)]">
        {entregas.map((e) => (
          <EntregaLinha key={e.id} entrega={e} />
        ))}
      </div>
    </div>
  );
}

function EntregaLinha({ entrega: e }: { entrega: Entrega }) {
  const ui = STATUS_UI[e.status];
  const abertas = e.tarefas.filter((t) => t.status !== 'concluida').length;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
      <div className="text-[16px] leading-none">{ui.emoji}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink truncate">{e.nome}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.06em] text-t3">
          {e.cliente}
        </div>
      </div>
      <span className={`entrega-status-pill ${ui.classe}`}>{ui.label}</span>
      <div className="text-[10px] uppercase tracking-[0.06em] text-t3 min-w-[80px] text-right">
        {abertas} tarefa{abertas === 1 ? '' : 's'} aberta{abertas === 1 ? '' : 's'}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BLOCO 2 — Kanban (colunas por status)
// ─────────────────────────────────────────────────────────────────

function ColunaKanban({
  status,
  entregas,
}: {
  status: StatusEntrega;
  entregas: Entrega[];
}) {
  const ui = STATUS_UI[status];
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] leading-none">{ui.emoji}</span>
          <span className="text-[12px] font-semibold text-ink truncate">{ui.label}</span>
        </div>
        <span
          className="shrink-0 rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-bold text-t2"
        >
          {entregas.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {entregas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[rgba(21,21,33,0.1)] p-4 text-center text-[11px] text-t3">
            —
          </div>
        ) : (
          entregas.map((e) => <CardEntrega key={e.id} entrega={e} />)
        )}
      </div>
    </div>
  );
}

function CardEntrega({ entrega: e }: { entrega: Entrega }) {
  const ui = STATUS_UI[e.status];
  return (
    <div className={`entrega-card ${ui.classe} p-3`}>
      {/* header da entrega */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.06em] text-t3">
            {e.cliente}
          </div>
          <div className="mt-0.5 text-[12px] font-semibold text-ink leading-tight">
            {e.nome}
          </div>
        </div>
        <div className="text-[10px] font-mono text-t2 shrink-0">
          {fmtDataCurta(e.data)}
        </div>
      </div>

      {/* tarefas da entrega */}
      {e.tarefas.length > 0 && (
        <ul className="mt-2.5 pt-2.5 border-t border-[rgba(21,21,33,0.06)] space-y-1">
          {e.tarefas.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-[11px]">
              <span className="shrink-0 text-[10px] leading-none">
                {t.status === 'concluida' ? '✓' : t.status === 'atrasada' ? '🔴' : '○'}
              </span>
              <span
                className={`min-w-0 flex-1 truncate ${
                  t.status === 'concluida'
                    ? 'text-t3 line-through'
                    : 'text-t2'
                }`}
              >
                {t.titulo}
              </span>
              <span className="shrink-0 text-[9px] text-t3 font-mono">
                {t.responsavel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
