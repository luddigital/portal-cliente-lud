'use client';

import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────
// DADOS DE EXEMPLO
// ─────────────────────────────────────────────────────────────────

type Urgencia = 'critico' | 'alto' | 'medio' | 'baixo';

type Acao = {
  titulo: string;
  detalhe?: string;
  responsavel: string;
  prazo: string;
  atrasoDias: number;
  urgencia: Urgencia;
  emoji: string;
};

type Cliente = {
  nome: string;
  gestor: string;
  proximasAcoes: Acao[];
};

const PARIS: Cliente = {
  nome: 'Descubra Paris',
  gestor: 'Luiza',
  proximasAcoes: [
    { titulo: 'Programar post da semana', responsavel: 'Luiza', prazo: '2026-08-19', atrasoDias: 0, urgencia: 'critico', emoji: '📤' },
    { titulo: '2 artes atrasadas', responsavel: 'Alisson', prazo: '2026-08-17', atrasoDias: 2, urgencia: 'critico', emoji: '🎨' },
    { titulo: '2 briefings atrasados', responsavel: 'Letícia', prazo: '2026-08-16', atrasoDias: 3, urgencia: 'critico', emoji: '✍️' },
    { titulo: 'Materiais pra produção atrasados', responsavel: 'Cliente', prazo: '2026-08-15', atrasoDias: 4, urgencia: 'alto', emoji: '📦' },
    { titulo: 'Aprovações de arte pendentes', responsavel: 'Cliente', prazo: '2026-08-18', atrasoDias: 1, urgencia: 'alto', emoji: '✅' },
    { titulo: 'Pauta de outubro', responsavel: 'Luiza', prazo: '2026-08-10', atrasoDias: 9, urgencia: 'medio', emoji: '📅' },
  ],
};

const NYORQUINA: Cliente = {
  nome: 'Nyorquina',
  gestor: 'Luiza',
  proximasAcoes: [
    { titulo: '4 aprovações aguardando cliente', responsavel: 'Cliente', prazo: '2026-08-19', atrasoDias: 0, urgencia: 'alto', emoji: '✅' },
    { titulo: 'Programar 5 posts da semana', responsavel: 'Luiza', prazo: '2026-08-22', atrasoDias: -3, urgencia: 'medio', emoji: '📤' },
    { titulo: 'Continuar produção Set/26', responsavel: 'Time', prazo: '2026-08-30', atrasoDias: -11, urgencia: 'medio', emoji: '🎨' },
  ],
};

const RE_SUCENA: Cliente = {
  nome: 'Re Sucena',
  gestor: 'Luiza',
  proximasAcoes: [],
};

// ─────────────────────────────────────────────────────────────────

const URGENCIA_PILL: Record<Urgencia, string> = {
  critico: 'atrasado',
  alto: 'hoje',
  medio: 'chegando',
  baixo: 'tranquilo',
};

function fmtData(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
}

function textoAtraso(a: number): string {
  if (a > 0) return `atrasado ${a}d`;
  if (a === 0) return 'hoje';
  if (a === -1) return 'amanhã';
  return `em ${-a}d`;
}

function healthDe(c: Cliente) {
  const criticos = c.proximasAcoes.filter((a) => a.urgencia === 'critico').length;
  const altos = c.proximasAcoes.filter((a) => a.urgencia === 'alto').length;
  const medios = c.proximasAcoes.filter((a) => a.urgencia === 'medio').length;
  if (criticos >= 2) return { classe: 'atrasada', label: 'Crítico', criticos, altos, medios };
  if (criticos === 1 || altos >= 3)
    return { classe: 'hoje', label: 'Atenção', criticos, altos, medios };
  return { classe: 'em-dia', label: 'Saudável', criticos, altos, medios };
}

// ─────────────────────────────────────────────────────────────────

export function GestaoProjetosView() {
  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Bloco do cliente — mix A+B
            </h1>
            <p className="text-[11px] text-t3">
              Contadores em destaque + timeline das 3 próximas ações
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-4">
        <BlocoCliente cliente={PARIS} />
        <BlocoCliente cliente={NYORQUINA} />
        <BlocoCliente cliente={RE_SUCENA} />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BLOCO — mix
// ─────────────────────────────────────────────────────────────────

function BlocoCliente({ cliente }: { cliente: Cliente }) {
  const health = healthDe(cliente);
  const top3 = cliente.proximasAcoes.slice(0, 3);
  const restante = cliente.proximasAcoes.length - top3.length;

  return (
    <button
      type="button"
      className={`entrega-card disponivel ${health.classe} w-full text-left`}
    >
      {/* Linha 1 — identidade + status */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="entrega-title truncate">{cliente.nome}</div>
          <span className={`entrega-status-pill ${health.classe}`}>{health.label}</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.06em] text-t3">
          Gestor: {cliente.gestor}
        </div>
      </div>

      {/* Linha 2 — contadores em destaque (A) */}
      <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-bgSoft/60 p-3">
        <ContadorNum n={health.criticos} label="críticas" tom="danger" />
        <ContadorNum n={health.altos} label="altas" tom="warning" />
        <ContadorNum n={health.medios} label="médias" tom="neutro" />
        <ContadorNum n={cliente.proximasAcoes.length} label="total" tom="ink" />
      </div>

      {/* Linha 3 — timeline das 3 próximas (B, mais enxuta) */}
      {cliente.proximasAcoes.length > 0 ? (
        <div className="mt-4">
          <div className="entrega-meta-label mb-2">próximas ações</div>
          <ol className="space-y-1.5">
            {top3.map((a, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 py-1.5 border-b border-[rgba(21,21,33,0.05)] last:border-0"
              >
                <div className="w-5 h-5 shrink-0 rounded-full bg-bgSoft flex items-center justify-center text-[10px] font-bold text-t2">
                  {i + 1}
                </div>
                <div className="text-[14px] leading-none shrink-0">{a.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-ink truncate">
                    {a.titulo}
                  </div>
                  <div className="text-[10px] text-t3 truncate">
                    {a.responsavel} · {fmtData(a.prazo)}
                  </div>
                </div>
                <span className={`prazo-pill ${URGENCIA_PILL[a.urgencia]} shrink-0`}>
                  <span className="prazo-dot" />
                  {textoAtraso(a.atrasoDias)}
                </span>
              </li>
            ))}
          </ol>
          {restante > 0 && (
            <div className="mt-2 text-[11px] text-t3">
              + {restante} outra{restante > 1 ? 's' : ''} pendência{restante > 1 ? 's' : ''}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-[var(--prazo-em-dia-soft)] px-4 py-3 text-center text-[12px] font-semibold text-[var(--prazo-em-dia)]">
          ✨ Nada pendente
        </div>
      )}
    </button>
  );
}

function ContadorNum({
  n,
  label,
  tom,
}: {
  n: number;
  label: string;
  tom: 'danger' | 'warning' | 'neutro' | 'ink';
}) {
  const cor =
    n === 0
      ? 'text-t3'
      : tom === 'danger'
        ? 'text-[var(--cal-alteracao)]'
        : tom === 'warning'
          ? 'text-[var(--cal-aprovacao)]'
          : tom === 'neutro'
            ? 'text-t2'
            : 'text-ink';
  return (
    <div className="text-center">
      <div className={`text-[24px] font-semibold leading-none tracking-[-0.02em] ${cor}`}>
        {n}
      </div>
      <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
        {label}
      </div>
    </div>
  );
}
