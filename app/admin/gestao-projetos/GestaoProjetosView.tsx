'use client';

import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────
// DADOS DE EXEMPLO — só um cliente pra iterar o bloco
// ─────────────────────────────────────────────────────────────────

type Urgencia = 'critico' | 'alto' | 'medio' | 'baixo';

type Acao = {
  titulo: string;
  detalhe: string;
  responsavel: string;
  prazo: string;
  atrasoDias: number;
  urgencia: Urgencia;
  emoji: string;
};

const CLIENTE = {
  nome: 'Descubra Paris',
  gestor: 'Luiza',
  proximasAcoes: [
    {
      titulo: 'Programar post da semana',
      detalhe: 'Arte principal pronta, falta programar no Meta',
      responsavel: 'Luiza',
      prazo: '2026-08-19',
      atrasoDias: 0,
      urgencia: 'critico',
      emoji: '📤',
    },
    {
      titulo: '2 artes atrasadas',
      detalhe: 'Louvre à noite · Cafés do Marais',
      responsavel: 'Alisson',
      prazo: '2026-08-17',
      atrasoDias: 2,
      urgencia: 'critico',
      emoji: '🎨',
    },
    {
      titulo: '2 briefings atrasados',
      detalhe: '"Se seu sonho é vir a Paris" · "Paris não é o que imagina"',
      responsavel: 'Letícia',
      prazo: '2026-08-16',
      atrasoDias: 3,
      urgencia: 'critico',
      emoji: '✍️',
    },
    {
      titulo: 'Materiais pra produção atrasados',
      detalhe: 'Cliente precisa mandar fotos + informações',
      responsavel: 'Cliente',
      prazo: '2026-08-15',
      atrasoDias: 4,
      urgencia: 'alto',
      emoji: '📦',
    },
    {
      titulo: 'Aprovações de arte pendentes',
      detalhe: '3 artes aguardando OK do cliente',
      responsavel: 'Cliente',
      prazo: '2026-08-18',
      atrasoDias: 1,
      urgencia: 'alto',
      emoji: '✅',
    },
    {
      titulo: 'Pauta de outubro',
      detalhe: 'Criação + aprovação de pauta em atraso',
      responsavel: 'Luiza',
      prazo: '2026-08-10',
      atrasoDias: 9,
      urgencia: 'medio',
      emoji: '📅',
    },
  ] as Acao[],
};

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

// ─────────────────────────────────────────────────────────────────

export function GestaoProjetosView() {
  const c = CLIENTE;
  const criticos = c.proximasAcoes.filter((a) => a.urgencia === 'critico').length;
  const altos = c.proximasAcoes.filter((a) => a.urgencia === 'alto').length;
  const proxima = c.proximasAcoes[0];

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Bloco do cliente — variações
            </h1>
            <p className="text-[11px] text-t3">
              Escolhe qual estilo aprovar (ou mistura pedaços das duas)
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-12">
        {/* ═════════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-[11px] font-bold">
              A
            </span>
            <h2 className="hub-section-title">Compacto — 1 linha, escaneável</h2>
          </div>
          <p className="text-[12px] text-t3">
            Uma linha por cliente. Vê o status inteiro sem rolar. Bom pra quem quer
            comparar vários clientes de uma vez.
          </p>
          <BlocoA cliente={c} criticos={criticos} altos={altos} proxima={proxima} />
          <BlocoA
            cliente={{ ...c, nome: 'Nyorquina' }}
            criticos={0}
            altos={1}
            proxima={{ ...proxima, titulo: '4 aprovações aguardando cliente', urgencia: 'alto', atrasoDias: 0, emoji: '✅' }}
          />
          <BlocoA
            cliente={{ ...c, nome: 'Re Sucena' }}
            criticos={0}
            altos={0}
            proxima={undefined}
          />
        </section>

        {/* ═════════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-[11px] font-bold">
              B
            </span>
            <h2 className="hub-section-title">Card com timeline — mostra 3 próximas</h2>
          </div>
          <p className="text-[12px] text-t3">
            Cliente ocupa mais espaço mas você já vê as 3 próximas ações direto.
            Bom pra clientes com muita coisa acontecendo.
          </p>
          <BlocoB cliente={c} criticos={criticos} altos={altos} />
        </section>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// VARIAÇÃO A — compacta, 1 linha
// ─────────────────────────────────────────────────────────────────

function BlocoA({
  cliente,
  criticos,
  altos,
  proxima,
}: {
  cliente: { nome: string; gestor: string };
  criticos: number;
  altos: number;
  proxima?: Acao;
}) {
  const health =
    criticos >= 2
      ? { classe: 'atrasada', label: 'Crítico', pill: 'atrasado' as const }
      : criticos === 1 || altos >= 3
        ? { classe: 'hoje', label: 'Atenção', pill: 'hoje' as const }
        : { classe: 'em-dia', label: 'Saudável', pill: 'em-dia' as const };

  return (
    <button
      type="button"
      className={`entrega-card disponivel ${health.classe} w-full text-left`}
    >
      <div className="flex items-center gap-4 flex-wrap">
        {/* Bloco 1: identidade */}
        <div className="min-w-[180px] flex-1">
          <div className="flex items-center gap-2">
            <div className="entrega-title">{cliente.nome}</div>
            <span className={`entrega-status-pill ${health.classe}`}>{health.label}</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-t3">
            gestor: {cliente.gestor}
          </div>
        </div>

        {/* Bloco 2: contadores */}
        <div className="flex items-center gap-4">
          <ContadorMini n={criticos} label="críticas" tom="danger" />
          <ContadorMini n={altos} label="altas" tom="warning" />
        </div>

        {/* Bloco 3: próxima ação */}
        <div className="min-w-0 flex-[2] flex items-center gap-3 border-l border-[rgba(21,21,33,0.06)] pl-4">
          {proxima ? (
            <>
              <div className="text-[18px] leading-none shrink-0">{proxima.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="entrega-meta-label">próxima ação</div>
                <div className="entrega-meta-value truncate">{proxima.titulo}</div>
              </div>
              <span className={`prazo-pill ${URGENCIA_PILL[proxima.urgencia]} shrink-0`}>
                <span className="prazo-dot" />
                {textoAtraso(proxima.atrasoDias)}
              </span>
            </>
          ) : (
            <div className="text-[12px] text-t3">Nada pendente ✨</div>
          )}
        </div>

        <div className="text-t3 shrink-0">›</div>
      </div>
    </button>
  );
}

function ContadorMini({
  n,
  label,
  tom,
}: {
  n: number;
  label: string;
  tom: 'danger' | 'warning';
}) {
  return (
    <div className="text-center min-w-[42px]">
      <div
        className={`text-[22px] font-semibold leading-none tracking-[-0.02em] ${
          n === 0 ? 'text-t3' : tom === 'danger' ? 'text-[var(--cal-alteracao)]' : 'text-[var(--cal-aprovacao)]'
        }`}
      >
        {n}
      </div>
      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// VARIAÇÃO B — card com timeline das 3 próximas
// ─────────────────────────────────────────────────────────────────

function BlocoB({
  cliente,
  criticos,
  altos,
}: {
  cliente: typeof CLIENTE;
  criticos: number;
  altos: number;
}) {
  const health =
    criticos >= 2
      ? { classe: 'atrasada', label: 'Crítico' }
      : criticos === 1 || altos >= 3
        ? { classe: 'hoje', label: 'Atenção' }
        : { classe: 'em-dia', label: 'Saudável' };

  const top3 = cliente.proximasAcoes.slice(0, 3);
  const restante = cliente.proximasAcoes.length - top3.length;

  return (
    <button
      type="button"
      className={`entrega-card disponivel ${health.classe} w-full text-left`}
    >
      {/* Cabeçalho */}
      <div className="entrega-head">
        <div className="entrega-title">{cliente.nome}</div>
        <span className={`entrega-status-pill ${health.classe}`}>{health.label}</span>
      </div>

      {/* Meta: gestor + contadores */}
      <div className="entrega-meta mb-4">
        <div className="entrega-meta-item">
          <div className="entrega-meta-icon">👤</div>
          <div>
            <div className="entrega-meta-label">gestor</div>
            <div className="entrega-meta-value">{cliente.gestor}</div>
          </div>
        </div>
        <div className="entrega-meta-item">
          <div className={`entrega-meta-icon ${criticos > 0 ? 'danger' : ''}`}>!</div>
          <div>
            <div className="entrega-meta-label">pendências</div>
            <div className="entrega-meta-value">
              {criticos} crítica{criticos !== 1 ? 's' : ''} · {altos} alta{altos !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline das próximas ações */}
      <div className="border-t border-[rgba(21,21,33,0.06)] pt-4">
        <div className="entrega-meta-label mb-3">próximas ações</div>
        <ol className="space-y-2.5">
          {top3.map((a, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 shrink-0 rounded-full bg-bgSoft flex items-center justify-center text-[10px] font-bold text-t2">
                {i + 1}
              </div>
              <div className="text-[14px] leading-none">{a.emoji}</div>
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
          <div className="mt-3 text-[11px] text-t3">
            + {restante} outra{restante > 1 ? 's' : ''} pendência{restante > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </button>
  );
}
