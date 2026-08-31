'use client';

// 4 variações do card da Esteira — mesma tarefa, 4 designs diferentes.
// Só pra Luiza escolher qual vai virar o padrão.

type CardMock = {
  cliente: { nome: string; cor: string };
  responsavel: { nome: string; iniciais: string; cor: string };
  titulo: string;
  area: string;
  areaEmoji: string;
  areaBg: string;
  areaFg: string;
  etapa: string;
  prazo: string;
  produzindoDesde: string;
};

const CARD: CardMock = {
  cliente: { nome: 'Descobrindo Suíça', cor: '#B85C38' },
  responsavel: { nome: 'Luiza', iniciais: 'LS', cor: '#6E2A2C' },
  titulo: 'Copy Reels — Trem panorâmico da Suíça',
  area: 'Copy',
  areaEmoji: '✍️',
  areaBg: '#B68A2E22',
  areaFg: '#7A5A18',
  etapa: 'Etapa 6 — Copy',
  prazo: '26/08 17:00',
  produzindoDesde: 'há 12 min',
};

export function CardsCompararView() {
  return (
    <div className="space-y-8">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
          esteira
        </div>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">
          Escolha o card
        </h1>
        <p className="mt-2 text-[14px] text-t2">
          Mesma tarefa, 4 jeitos diferentes de mostrar. Cada uma tenta uma
          "sensação" diferente. Diz qual você prefere (ou mistura pedaços) que
          eu aplico na página inteira.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Variacao letra="A" titulo="Minimalista" descricao="Muito respiro, título grande. Meta info discreta.">
          <OpcaoA />
        </Variacao>
        <Variacao letra="B" titulo="Borda de cor" descricao="Barra lateral colorida pelo cliente. Identidade forte.">
          <OpcaoB />
        </Variacao>
        <Variacao letra="C" titulo="Compacto" descricao="Denso pra caber mais coisa na tela. Bom pra dias cheios.">
          <OpcaoC />
        </Variacao>
        <Variacao letra="D" titulo="Divertido" descricao="Fundo suave com cor do cliente. Mais cara de Lud.">
          <OpcaoD />
        </Variacao>
      </div>

      <div className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-white p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
          contexto
        </div>
        <p className="mt-1 text-[13px] text-t2 leading-relaxed">
          Todos mostram a mesma tarefa: <b>Copy Reels — Trem panorâmico da
          Suíça</b>, cliente <b>Descobrindo Suíça</b>, responsável <b>Luiza</b>,
          área <b>Copy</b>, prazo <b>26/08 17:00</b>, estado <b>Produzindo</b>{' '}
          (o indicador pulsante mostra isso).
        </p>
      </div>
    </div>
  );
}

function Variacao({
  letra,
  titulo,
  descricao,
  children,
}: {
  letra: string;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white"
          aria-hidden
        >
          {letra}
        </span>
        <div>
          <div className="text-[14px] font-semibold text-ink">{titulo}</div>
          <div className="text-[11px] text-t3">{descricao}</div>
        </div>
      </div>
      <div className="rounded-2xl bg-bgSoft/40 p-4">{children}</div>
    </div>
  );
}

// ============================================================
// OPÇÃO A — Minimalista
// ============================================================
function OpcaoA() {
  return (
    <article className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-white p-5 space-y-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
        {CARD.cliente.nome}
      </div>
      <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {CARD.titulo}
      </h3>
      <div className="flex items-center justify-between text-[11px] text-t2">
        <span>
          {CARD.areaEmoji} {CARD.area}
        </span>
        <span className="font-mono">{CARD.prazo}</span>
      </div>
      <div className="flex items-center justify-between border-t border-[rgba(21,21,33,0.06)] pt-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B68A2E] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B68A2E]" />
          </span>
          <span className="text-[10px] text-t3">produzindo {CARD.produzindoDesde}</span>
        </div>
        <Avatar />
      </div>
    </article>
  );
}

// ============================================================
// OPÇÃO B — Borda lateral colorida pelo cliente
// ============================================================
function OpcaoB() {
  return (
    <article
      className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-white p-4 pl-5 space-y-2.5 relative overflow-hidden"
      style={{ borderLeft: `5px solid ${CARD.cliente.cor}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold"
          style={{ color: CARD.cliente.cor }}
        >
          {CARD.cliente.nome}
        </span>
        <Avatar />
      </div>
      <h3 className="text-[14px] font-semibold leading-snug text-ink">
        {CARD.titulo}
      </h3>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: CARD.areaBg, color: CARD.areaFg }}
        >
          {CARD.areaEmoji} {CARD.area}
        </span>
        <span className="text-[10px] font-semibold text-t3">
          📌 {CARD.prazo}
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-[0.06em] text-t3">
        {CARD.etapa}
      </div>
      <div className="flex items-center gap-2 rounded-md bg-bgSoft/60 px-2 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B68A2E] opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B68A2E]" />
        </span>
        <span className="text-[10px] text-t2">produzindo {CARD.produzindoDesde}</span>
      </div>
    </article>
  );
}

// ============================================================
// OPÇÃO C — Compacto/denso
// ============================================================
function OpcaoC() {
  return (
    <article className="rounded-lg border border-[rgba(21,21,33,0.08)] bg-white p-2.5 space-y-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: CARD.cliente.cor }}
          title={CARD.cliente.nome}
        />
        <h3 className="min-w-0 flex-1 truncate text-[12.5px] font-medium leading-tight text-ink">
          {CARD.titulo}
        </h3>
        <Avatar tamanho={18} />
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate font-semibold text-t3">
            {CARD.cliente.nome}
          </span>
          <span className="text-t3">·</span>
          <span style={{ color: CARD.areaFg }}>
            {CARD.areaEmoji} {CARD.area}
          </span>
        </div>
        <span className="font-mono text-t2">{CARD.prazo}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[rgba(21,21,33,0.06)]">
        <span className="text-t3">{CARD.etapa}</span>
        <div className="flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B68A2E] opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#B68A2E]" />
          </span>
          <span className="text-t3">{CARD.produzindoDesde}</span>
        </div>
      </div>
    </article>
  );
}

// ============================================================
// OPÇÃO D — Divertido/playful
// ============================================================
function OpcaoD() {
  return (
    <article
      className="rounded-2xl border p-4 space-y-3 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${CARD.cliente.cor}0d 0%, white 60%)`,
        borderColor: `${CARD.cliente.cor}30`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ background: CARD.cliente.cor, color: 'white' }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
          {CARD.cliente.nome}
        </span>
        <Avatar />
      </div>
      <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.02em] text-ink">
        {CARD.titulo}
      </h3>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{
            borderColor: `${CARD.areaFg}40`,
            color: CARD.areaFg,
            background: 'white',
          }}
        >
          <span>{CARD.areaEmoji}</span> {CARD.area}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-semibold text-t2">
          📌 {CARD.prazo}
        </span>
      </div>
      <div
        className="rounded-lg px-3 py-2 flex items-center gap-2"
        style={{ background: '#B68A2E15' }}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B68A2E] opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#B68A2E]" />
        </span>
        <span className="text-[11px] font-semibold text-[#7A5A18]">
          Produzindo {CARD.produzindoDesde}
        </span>
      </div>
    </article>
  );
}

function Avatar({ tamanho = 26 }: { tamanho?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: tamanho,
        height: tamanho,
        background: CARD.responsavel.cor,
        fontSize: Math.max(9, tamanho * 0.42),
      }}
      title={CARD.responsavel.nome}
    >
      {CARD.responsavel.iniciais}
    </span>
  );
}
