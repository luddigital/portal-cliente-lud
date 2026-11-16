'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================
// Mock data — só pra montar o layout. Depois plugamos Notion.
// ============================================================

type Area = 'Copy' | 'Arte' | 'Programação';
export type Coluna =
  | 'fila'
  | 'produzindo'
  | 'revisar'
  | 'reaprovacao'
  | 'pronto';

type Pessoa = { id: string; nome: string; iniciais: string; cor: string };

const PESSOAS: Pessoa[] = [
  { id: 'lud', nome: 'Luiza', iniciais: 'LS', cor: '#6E2A2C' },
  { id: 'ale', nome: 'Alisson', iniciais: 'AL', cor: '#3D5A80' },
  { id: 'thi', nome: 'Thifany', iniciais: 'TH', cor: '#B68A2E' },
];

type Cliente = { id: string; nome: string; cor: string };

const CLIENTES: Cliente[] = [
  { id: 'nyor', nome: 'Nyorquina', cor: '#E85A4F' },
  { id: 'par', nome: 'Descubra Paris', cor: '#2E86AB' },
  { id: 'sui', nome: 'Descobrindo Suíça', cor: '#B85C38' },
  { id: 'chi', nome: 'Turismo em Chicago', cor: '#4D9078' },
  { id: 'tkr', nome: 'TKRA-Takara', cor: '#8E44AD' },
  { id: 'lig', nome: 'Ligia Bueno', cor: '#D4A017' },
  { id: 'roa', nome: 'Roteiros na África', cor: '#C0392B' },
  { id: 'ste', nome: 'Ste Travels', cor: '#16A085' },
];

type Card = {
  id: string; // tarefaId
  postId?: string; // pra buscar copy produzida no Notion
  titulo: string;
  cliente: Cliente;
  area?: Area;
  responsavel: Pessoa;
  prazoIso: string; // ISO date, na tz local
  coluna: Coluna;
  etapa: string; // nome da entrega (Briefing & Copy, Arte, Aprovação | Post…)
  produzindoDesde?: string; // ISO — só se estiver em Produzindo
};

// Alias público — o server component monta cards a partir de dados do Notion
export type CardMock = Card;

// Ajuda a montar datas relativas legíveis
function iso(daysFromNow: number, hour = 10, min = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

// Título de cada card = título do POST no calendário de social media.
// A "etapa" usa o NOME EXATO da entrega no Notion (Briefing & Copy, Arte,
// Aprovação | Briefing & Copy, Aprovação | Arte, Programar, etc).
const MOCK: Card[] = [
  // FILA — prontos pra a rotina do fim do dia pegar
  {
    id: 'c1',
    titulo: 'Meus restaurantes preferidos em Orlando',
    cliente: CLIENTES[6],
    area: 'Copy',
    responsavel: PESSOAS[2],
    prazoIso: iso(1, 10, 30),
    coluna: 'fila',
    etapa: 'Briefing & Copy',
  },
  {
    id: 'c2',
    titulo: 'Bastidores do jogo do Chicago Bulls',
    cliente: CLIENTES[3],
    area: 'Copy',
    responsavel: PESSOAS[2],
    prazoIso: iso(1, 17, 0),
    coluna: 'fila',
    etapa: 'Briefing & Copy',
  },
  {
    id: 'c3',
    titulo: 'Lugares escondidos em Zurich',
    cliente: CLIENTES[2],
    area: 'Arte',
    responsavel: PESSOAS[1],
    prazoIso: iso(2, 10, 30),
    coluna: 'fila',
    etapa: 'Arte',
  },
  {
    id: 'c4',
    titulo: 'Chegada em Marrocos',
    cliente: CLIENTES[6],
    area: 'Programação',
    responsavel: PESSOAS[0],
    prazoIso: iso(1, 17, 0),
    coluna: 'fila',
    etapa: 'Programar',
  },
  {
    id: 'c5',
    titulo: '3 restaurantes fora do óbvio em Paris',
    cliente: CLIENTES[1],
    area: 'Copy',
    responsavel: PESSOAS[2],
    prazoIso: iso(2, 10, 30),
    coluna: 'fila',
    etapa: 'Briefing & Copy',
  },

  // PRODUZINDO — a rotina começou, IA/agente tá tocando
  {
    id: 'p1',
    titulo: 'Trem panorâmico da Suíça',
    cliente: CLIENTES[2],
    area: 'Copy',
    responsavel: PESSOAS[0],
    prazoIso: iso(0, 17, 0),
    coluna: 'produzindo',
    etapa: 'Briefing & Copy',
    produzindoDesde: iso(0, new Date().getHours(), new Date().getMinutes() - 12),
  },
  {
    id: 'p2',
    titulo: 'Lançamento da nova coleção TKRA',
    cliente: CLIENTES[4],
    area: 'Arte',
    responsavel: PESSOAS[1],
    prazoIso: iso(0, 17, 0),
    coluna: 'produzindo',
    etapa: 'Arte',
    produzindoDesde: iso(0, new Date().getHours(), new Date().getMinutes() - 5),
  },

  // REVISAR — sua fila da manhã
  {
    id: 'r1',
    titulo: 'Café da manhã em Paris',
    cliente: CLIENTES[1],
    area: 'Copy',
    responsavel: PESSOAS[2],
    prazoIso: iso(0, 10, 30),
    coluna: 'revisar',
    etapa: 'Aprovação | Briefing & Copy',
  },
  {
    id: 'r2',
    titulo: 'Ligia contando o bastidor da consultoria',
    cliente: CLIENTES[5],
    area: 'Copy',
    responsavel: PESSOAS[2],
    prazoIso: iso(0, 10, 30),
    coluna: 'revisar',
    etapa: 'Aprovação | Briefing & Copy',
  },
  {
    id: 'r3',
    titulo: '5 vinícolas escondidas em Chicago',
    cliente: CLIENTES[3],
    area: 'Arte',
    responsavel: PESSOAS[1],
    prazoIso: iso(-1, 17, 0),
    coluna: 'revisar',
    etapa: 'Aprovação | Arte',
  },
  {
    id: 'r4',
    titulo: 'Fim de semana em Nova York',
    cliente: CLIENTES[0],
    area: 'Programação',
    responsavel: PESSOAS[0],
    prazoIso: iso(0, 10, 30),
    coluna: 'revisar',
    etapa: 'Aprovação | Post',
  },

  // PRONTO — aprovado hoje, sai da esteira
  {
    id: 'ok1',
    titulo: 'Manhattan de bicicleta',
    cliente: CLIENTES[0],
    area: 'Copy',
    responsavel: PESSOAS[2],
    prazoIso: iso(0, 9, 0),
    coluna: 'pronto',
    etapa: 'Aprovação | Post',
  },
  {
    id: 'ok2',
    titulo: 'Top 5 experiências em Chicago',
    cliente: CLIENTES[3],
    area: 'Arte',
    responsavel: PESSOAS[1],
    prazoIso: iso(0, 9, 0),
    coluna: 'pronto',
    etapa: 'Aprovação | Arte',
  },
];

// ============================================================
// UI helpers
// ============================================================

type Prioridade = 'atrasado' | 'hoje' | 'semana' | 'radar';

function prioridadeDoPrazo(iso: string): Prioridade {
  const p = new Date(iso);
  const agora = new Date();
  const hojeIni = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
  );
  const hojeFim = new Date(hojeIni);
  hojeFim.setDate(hojeFim.getDate() + 1);
  if (p < hojeIni) return 'atrasado';
  if (p < hojeFim) return 'hoje';
  const semana = new Date(hojeIni);
  semana.setDate(semana.getDate() + 7);
  return p <= semana ? 'semana' : 'radar';
}

const PRIORIDADE_UI: Record<
  Prioridade,
  { emoji: string; label: string; cor: string }
> = {
  atrasado: { emoji: '🚨', label: 'Atrasado', cor: 'var(--prazo-hoje)' },
  hoje: { emoji: '📌', label: 'Hoje', cor: 'var(--prazo-hoje)' },
  semana: { emoji: '👍', label: 'Próx. semana', cor: 'var(--cal-aprovacao)' },
  radar: { emoji: '🔮', label: 'No radar', cor: 'var(--cal-agendado)' },
};

function fmtPrazo(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

const MESES_CURTOS = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

function fmtDataCurta(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mes = MESES_CURTOS[d.getMonth()];
  return `${dd} ${mes}`;
}

function fmtRelativoAgora(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.floor(diffMs / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h`;
}

const AREA_STYLE: Record<Area, { bg: string; fg: string; emoji: string }> = {
  Copy: { bg: '#B68A2E22', fg: '#7A5A18', emoji: '✍️' },
  Arte: { bg: '#7A4E9B22', fg: '#4D2E66', emoji: '🎨' },
  Programação: { bg: '#3D5A8022', fg: '#243B54', emoji: '📅' },
};

const COLUNA_INFO: Record<
  Coluna,
  { titulo: string; hint: string; cor: string; corSoft: string }
> = {
  fila: {
    titulo: 'Fila',
    hint: 'Prontos para serem produzidos',
    cor: '#7A6B58',
    corSoft: '#F3EEE6',
  },
  produzindo: {
    titulo: 'Produzindo',
    hint: 'Claude trabalhando',
    cor: '#B68A2E',
    corSoft: '#FBF3DE',
  },
  revisar: {
    titulo: 'Revisar',
    hint: 'Prontos para revisão',
    cor: '#6E2A2C',
    corSoft: '#F8E4E1',
  },
  reaprovacao: {
    titulo: 'Reaprovação',
    hint: 'Alterados',
    cor: '#8E44AD',
    corSoft: '#F1E6F7',
  },
  pronto: {
    titulo: 'Aprovadas',
    hint: 'Concluídas — aparecem numa aba separada',
    cor: '#4B7F52',
    corSoft: '#E4F2E6',
  },
};

// Colunas exibidas no kanban (Pronto é mostrado numa aba separada abaixo)
const COLUNAS_KANBAN: Coluna[] = ['fila', 'produzindo', 'revisar', 'reaprovacao'];

const AREAS: Area[] = ['Copy', 'Arte', 'Programação'];

// ============================================================
// Componentes
// ============================================================

export function EsteiraView({
  cardsIniciais,
}: {
  cardsIniciais?: Card[];
} = {}) {
  const [cards, setCards] = useState<Card[]>(() => cardsIniciais ?? MOCK);
  // Se o server passar novos cards (refresh), sincroniza
  useEffect(() => {
    setCards(cardsIniciais ?? MOCK);
  }, [cardsIniciais]);
  const moverCardParaReaprovacao = (cardId: string) =>
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, coluna: 'reaprovacao' as Coluna } : c,
      ),
    );

  // Drag-and-drop: arrastar card entre colunas
  function moverCardParaColuna(cardId: string, coluna: Coluna) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              coluna,
              produzindoDesde:
                coluna === 'produzindo' ? new Date().toISOString() : undefined,
            }
          : c,
      ),
    );
  }

  // Set dos títulos dos cards em produção (pra banner visível no topo)
  const [produzindoAgora, setProduzindoAgora] = useState<Set<string>>(new Set());

  async function produzirCardObj(card: Card) {
    if (!card.postId) {
      alert(
        `❌ Esse card não tem post vinculado no Notion — não dá pra produzir. Card: "${card.titulo}"`,
      );
      moverCardParaColuna(card.id, 'fila');
      return;
    }
    setProduzindoAgora((prev) => new Set(prev).add(card.titulo));
    try {
      const res = await fetch(`/api/esteira/produzir/${card.postId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      moverCardParaColuna(card.id, 'revisar');
    } catch (e: any) {
      console.error('[esteira] produção falhou:', e);
      moverCardParaColuna(card.id, 'fila');
      alert(
        `❌ Falhou produzir "${card.titulo}": ${e?.message ?? 'erro'}. Card voltou pra Fila.`,
      );
    } finally {
      setProduzindoAgora((prev) => {
        const novo = new Set(prev);
        novo.delete(card.titulo);
        return novo;
      });
    }
  }

  // Wrapper que aceita id (pra compatibilidade com drag+drop) — busca card e chama
  function produzirCardEmovamentoDeCard(cardId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) {
      alert(`❌ Card não achado (id=${cardId}). Recarregue a página.`);
      return;
    }
    produzirCardObj(card);
  }
  const [busca, setBusca] = useState('');
  const [clientesOn, setClientesOn] = useState<Set<string>>(new Set());
  const [etapasOn, setEtapasOn] = useState<Set<string>>(new Set());
  const [pessoasOn, setPessoasOn] = useState<Set<string>>(new Set());
  const [colunaAtiva, setColunaAtiva] = useState<Coluna>('revisar'); // mobile
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  // Clientes efetivamente presentes nos cards (filtro dinâmico)
  const clientesPresentes = useMemo(() => {
    const map = new Map<string, Cliente>();
    for (const c of cards) if (!map.has(c.cliente.id)) map.set(c.cliente.id, c.cliente);
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [cards]);

  // Etapas (títulos de entrega) presentes — filtro dinâmico
  const etapasPresentes = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) set.add(c.etapa);
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [cards]);

  // Pessoas presentes — filtro dinâmico
  const pessoasPresentes = useMemo(() => {
    const map = new Map<string, Pessoa>();
    for (const c of cards)
      if (!map.has(c.responsavel.id)) map.set(c.responsavel.id, c.responsavel);
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [cards]);

  const filtradas = useMemo(() => {
    return cards.filter((c) => {
      if (clientesOn.size > 0 && !clientesOn.has(c.cliente.id)) return false;
      if (etapasOn.size > 0 && !etapasOn.has(c.etapa)) return false;
      if (pessoasOn.size > 0 && !pessoasOn.has(c.responsavel.id)) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        if (
          !c.titulo.toLowerCase().includes(q) &&
          !c.cliente.nome.toLowerCase().includes(q) &&
          !c.etapa.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [busca, clientesOn, etapasOn, pessoasOn]);

  const porColuna: Record<Coluna, Card[]> = {
    fila: filtradas.filter((c) => c.coluna === 'fila'),
    produzindo: filtradas.filter((c) => c.coluna === 'produzindo'),
    revisar: filtradas.filter((c) => c.coluna === 'revisar'),
    reaprovacao: filtradas.filter((c) => c.coluna === 'reaprovacao'),
    pronto: filtradas.filter((c) => c.coluna === 'pronto'),
  };

  const totalFiltrado = filtradas.length;

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const novo = new Set(set);
    if (novo.has(value)) novo.delete(value);
    else novo.add(value);
    setter(novo);
  }

  function limparFiltros() {
    setBusca('');
    setClientesOn(new Set());
    setEtapasOn(new Set());
    setPessoasOn(new Set());
  }

  const temFiltro =
    busca.trim().length > 0 ||
    clientesOn.size > 0 ||
    etapasOn.size > 0 ||
    pessoasOn.size > 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
          esteira
        </div>
        <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.03em] text-ink">
          Esteira de Social Media
        </h1>
        <p className="mt-2 text-[14px] text-t2">
          Todo post do calendário de social media que tá em produção passa por
          aqui. À noite a rotina automática pega o que tá em <b>Fila</b> e
          move pra <b>Produzindo</b>. De manhã você abre <b>Revisar</b> e
          aprova.
        </p>
      </div>

      {/* Barra de filtros */}
      <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, cliente ou etapa…"
            className="input flex-1 text-[13px]"
          />
          {temFiltro && (
            <button
              onClick={limparFiltros}
              className="btn-ghost shrink-0 text-[12px]"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <FiltroLinha label="Cliente">
          {clientesPresentes.map((c) => {
            const on = clientesOn.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(clientesOn, c.id, setClientesOn)}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
                style={{
                  borderColor: on ? c.cor : 'rgba(21,21,33,0.12)',
                  background: on ? `${c.cor}18` : 'white',
                  color: on ? c.cor : 'var(--t2)',
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: c.cor }}
                />
                {c.nome}
              </button>
            );
          })}
        </FiltroLinha>

        <FiltroLinha label="Etapa">
          {etapasPresentes.map((e) => {
            const on = etapasOn.has(e);
            return (
              <button
                key={e}
                onClick={() => toggle(etapasOn, e, setEtapasOn)}
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
                style={{
                  borderColor: on ? 'var(--ink)' : 'rgba(21,21,33,0.12)',
                  background: on ? 'var(--ink)' : 'white',
                  color: on ? 'white' : 'var(--t2)',
                }}
              >
                {e}
              </button>
            );
          })}
        </FiltroLinha>

        <FiltroLinha label="Pessoa">
          {pessoasPresentes.map((p) => {
            const on = pessoasOn.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(pessoasOn, p.id, setPessoasOn)}
                title={p.nome}
                className="flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-semibold transition"
                style={{
                  borderColor: on ? p.cor : 'rgba(21,21,33,0.12)',
                  background: on ? `${p.cor}18` : 'white',
                  color: on ? p.cor : 'var(--t2)',
                }}
              >
                <Avatar pessoa={p} tamanho={20} />
                {p.nome}
              </button>
            );
          })}
        </FiltroLinha>

        <div className="text-[11px] text-t3">
          {totalFiltrado} tarefa{totalFiltrado === 1 ? '' : 's'} na esteira
          {temFiltro && ' (com filtros aplicados)'}.
        </div>
      </div>

      {/* Mobile: tabs. Desktop: sumir. */}
      <div className="lg:hidden">
        <div className="flex overflow-x-auto min-h-fit rounded-xl border border-[rgba(21,21,33,0.08)] bg-white p-1 gap-1">
          {COLUNAS_KANBAN.map(
            (col) => {
              const info = COLUNA_INFO[col];
              const ativo = colunaAtiva === col;
              const n = porColuna[col].length;
              return (
                <button
                  key={col}
                  onClick={() => setColunaAtiva(col)}
                  className="flex-1 shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold transition"
                  style={{
                    background: ativo ? info.cor : 'transparent',
                    color: ativo ? 'white' : 'var(--t2)',
                  }}
                >
                  {info.titulo}{' '}
                  <span className="opacity-70">({n})</span>
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Banner de produção em curso — visível e proeminente */}
      {produzindoAgora.size > 0 && (
        <div
          className="rounded-xl border p-4 flex items-center gap-3"
          style={{
            background: '#FBF3DE',
            borderColor: '#D4A017',
            color: '#8A6A15',
          }}
        >
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 rounded-full bg-[#D4A017] animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2 w-2 rounded-full bg-[#D4A017] animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2 w-2 rounded-full bg-[#D4A017] animate-bounce" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">
              🤖 Claude produzindo {produzindoAgora.size}{' '}
              {produzindoAgora.size === 1 ? 'post' : 'posts'} agora
            </div>
            <div className="text-[11px] mt-0.5 truncate">
              {[...produzindoAgora].slice(0, 3).join(' · ')}
              {produzindoAgora.size > 3
                ? ` · +${produzindoAgora.size - 3}`
                : ''}
            </div>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="grid gap-4 lg:grid-cols-4">
        {COLUNAS_KANBAN.map(
          (col) => (
            <Coluna
              key={col}
              coluna={col}
              cards={porColuna[col]}
              esconderMobile={col !== colunaAtiva}
              selecionadoId={selecionadoId}
              onSelect={setSelecionadoId}
              onDropCard={(cardId) => {
                if (col === 'produzindo') {
                  moverCardParaColuna(cardId, 'produzindo');
                  produzirCardEmovamentoDeCard(cardId);
                }
              }}
              onProduzirCard={(cardId) => {
                const card = cards.find((c) => c.id === cardId);
                if (!card) {
                  alert(`❌ Card não achado (id=${cardId})`);
                  return;
                }
                moverCardParaColuna(card.id, 'produzindo');
                produzirCardObj(card);
              }}
            />
          ),
        )}
      </div>

      {/* Área de revisão — sempre presente embaixo do kanban */}
      <PainelRevisao
        card={
          selecionadoId
            ? cards.find((c) => c.id === selecionadoId) ?? null
            : cards.find((c) => c.coluna === 'revisar') ?? cards[0] ?? null
        }
        onMoverParaReaprovacao={moverCardParaReaprovacao}
      />

      {/* Aprovadas — lista compacta separada do kanban */}
      <SecaoAprovadas
        cards={filtradas.filter((c) => c.coluna === 'pronto')}
        onSelect={setSelecionadoId}
      />
    </div>
  );
}

function FiltroLinha({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-16 shrink-0 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Etiqueta em formato pill — paleta warm da Lud., sans-serif.
 * Sem cara de "campo de banco de dados" (Notion).
 */
function Etiqueta({
  children,
  variant = 'neutro',
  title,
}: {
  children: React.ReactNode;
  variant?: 'neutro' | 'atrasado' | 'hoje' | 'semana' | 'radar';
  title?: string;
}) {
  const paleta: Record<
    NonNullable<Parameters<typeof Etiqueta>[0]['variant']>,
    { bg: string; fg: string; dot?: string }
  > = {
    neutro: { bg: '#F3EEE6', fg: '#5C4A2E' }, // areia / mauve terroso
    atrasado: { bg: '#FDECEA', fg: '#B02E2A', dot: '#D64545' },
    hoje: { bg: '#FBF1D9', fg: '#8A6A15', dot: '#D4A017' },
    semana: { bg: '#E6F0EA', fg: '#3F6B4A', dot: '#5B9370' },
    radar: { bg: '#E7ECF3', fg: '#3D5A80', dot: '#6683A6' },
  };
  const s = paleta[variant];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: s.dot }}
        />
      )}
      {children}
    </span>
  );
}

function Avatar({ pessoa, tamanho = 24 }: { pessoa: Pessoa; tamanho?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: tamanho,
        height: tamanho,
        background: pessoa.cor,
        fontSize: Math.max(9, tamanho * 0.42),
      }}
      title={pessoa.nome}
    >
      {pessoa.iniciais}
    </span>
  );
}

function Coluna({
  coluna,
  cards,
  esconderMobile,
  selecionadoId,
  onSelect,
  onDropCard,
  onProduzirCard,
}: {
  coluna: Coluna;
  cards: Card[];
  esconderMobile: boolean;
  selecionadoId: string | null;
  onSelect: (id: string | null) => void;
  onDropCard?: (cardId: string) => void;
  onProduzirCard?: (cardId: string) => void;
}) {
  const info = COLUNA_INFO[coluna];
  const [dragOver, setDragOver] = useState(false);
  const aceitaDrop = coluna === 'produzindo'; // por enquanto só produzindo
  return (
    <section
      onDragOver={(e) => {
        if (!aceitaDrop) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!aceitaDrop) return;
        e.preventDefault();
        setDragOver(false);
        const cardId = e.dataTransfer.getData('text/plain');
        if (cardId && onDropCard) onDropCard(cardId);
      }}
      className={`${esconderMobile ? 'hidden lg:block' : ''} rounded-2xl border overflow-hidden flex flex-col transition ${
        dragOver
          ? 'border-[#B68A2E] ring-4 ring-[#B68A2E]/20 bg-[#FBF3DE]'
          : 'border-[rgba(21,21,33,0.08)] bg-white'
      }`}
    >
      <div
        className="px-4 py-3 border-b border-[rgba(21,21,33,0.06)] flex items-center justify-between"
        style={{ background: info.corSoft }}
      >
        <div className="min-w-0">
          <div
            className="text-[13px] font-semibold tracking-[-0.01em]"
            style={{ color: info.cor }}
          >
            {info.titulo}
          </div>
          <div className="text-[10px] uppercase tracking-[0.06em] text-t3">
            {info.hint}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ background: info.cor, color: 'white' }}
        >
          {cards.length}
        </span>
      </div>
      <div className="p-3 space-y-2 min-h-[200px] max-h-[calc(100vh-360px)] overflow-y-auto">
        {cards.length === 0 ? (
          <div
            className={`rounded-xl border border-dashed p-4 text-center text-[11px] transition ${
              dragOver
                ? 'border-[#B68A2E] text-[#B68A2E] font-semibold'
                : 'border-[rgba(21,21,33,0.15)] text-t3'
            }`}
          >
            {dragOver
              ? 'Solte aqui pra produzir 🚀'
              : aceitaDrop
                ? 'Arraste um card da Fila pra cá pra produzir'
                : 'Nenhuma tarefa aqui.'}
          </div>
        ) : (
          cards.map((c) => (
            <CardEsteira
              key={c.id}
              card={c}
              selecionado={selecionadoId === c.id}
              onSelect={onSelect}
              onProduzir={onProduzirCard}
            />
          ))
        )}
      </div>
    </section>
  );
}

// ============================================================
// CardEsteira — layout Opção A (minimalista), com adaptações:
// etapa = nome do Notion (Briefing & Copy) e prazo = rótulo
// (Atrasado / Hoje / Próx. semana). Sem chip visual, sem faixa
// lateral. Texto puro + emoji + cor.
// ============================================================
function CardEsteira({
  card: c,
  selecionado,
  onSelect,
  onProduzir,
}: {
  card: Card;
  selecionado: boolean;
  onSelect: (id: string | null) => void;
  onProduzir?: (id: string) => void;
}) {
  const prio = c.coluna === 'pronto' ? null : prioridadeDoPrazo(c.prazoIso);
  const prioUi = prio ? PRIORIDADE_UI[prio] : null;

  return (
    <article
      draggable={c.coluna === 'fila'}
      onDragStart={(e) => {
        if (c.coluna !== 'fila') return;
        e.dataTransfer.setData('text/plain', c.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`rounded-xl border bg-white p-4 space-y-3 transition ${
        selecionado
          ? 'border-ink shadow-md cursor-pointer'
          : `border-[rgba(21,21,33,0.08)] hover:border-[rgba(21,21,33,0.22)] hover:shadow-sm ${
              c.coluna === 'fila'
                ? 'cursor-grab active:cursor-grabbing'
                : 'cursor-pointer'
            }`
      }`}
      style={selecionado ? { background: '#FBF7EF' } : undefined}
      onClick={() => onSelect(selecionado ? null : c.id)}
    >
      {/* Cliente — discreto no topo, com bolinha da cor */}
      <div
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] min-w-0"
        style={{ color: c.cliente.cor }}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: c.cliente.cor }}
        />
        <span className="truncate">{c.cliente.nome}</span>
      </div>

      {/* Título do post — protagonista */}
      <h3 className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {c.titulo}
      </h3>

      {/* Meta: data de entrega + prazo, na mesma linha */}
      {prioUi && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-t2 font-medium">
            📅 {fmtDataCurta(c.prazoIso)}
          </span>
          <span
            className="font-medium"
            style={{ color: prioUi.cor }}
            title={fmtPrazo(c.prazoIso)}
          >
            {prioUi.emoji} {prioUi.label}
          </span>
        </div>
      )}

      {/* Rodapé: só o estado, sem avatar (etapa já está nos filtros) */}
      {c.coluna === 'produzindo' && c.produzindoDesde ? (
        <div className="space-y-2 border-t border-[rgba(21,21,33,0.06)] pt-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B68A2E] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B68A2E]" />
            </span>
            <span className="text-[10px] font-semibold text-[#8A6A15] truncate">
              Claude tá produzindo…
            </span>
            <span className="ml-auto text-[10px] text-t3 shrink-0">
              {fmtRelativoAgora(c.produzindoDesde)}
            </span>
          </div>
          {/* Barra de progresso animada — enche em 60s até 95%, depois só quando terminar */}
          <div className="h-1.5 w-full rounded-full bg-[#F3EEE6] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, #B68A2E 0%, #D4A017 50%, #B68A2E 100%)',
                width: '0%',
                animation: 'esteira-progresso 60s ease-out forwards',
                backgroundSize: '200% 100%',
              }}
            />
          </div>
        </div>
      ) : c.coluna === 'revisar' ? (
        <div className="border-t border-[rgba(21,21,33,0.06)] pt-3">
          <span className="text-[10px] font-semibold text-[#B02E2A]">
            aguardando revisão
          </span>
        </div>
      ) : c.coluna === 'pronto' ? (
        <div className="border-t border-[rgba(21,21,33,0.06)] pt-3">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[#4B7F52]">
            <span>✓</span> aprovado hoje
          </span>
        </div>
      ) : c.coluna === 'fila' ? (
        <div className="border-t border-[rgba(21,21,33,0.06)] pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('[esteira] clicou produzir', {
                id: c.id,
                postId: c.postId,
                titulo: c.titulo,
                temOnProduzir: !!onProduzir,
              });
              if (!onProduzir) {
                alert(
                  '⚠️ Botão sem handler (onProduzir não foi passado). Recarrega a página.',
                );
                return;
              }
              onProduzir(c.id);
            }}
            className="w-full rounded-full px-3 py-2 text-[11.5px] font-semibold transition cursor-pointer"
            style={{ background: '#FBF3DE', color: '#8A6A15' }}
          >
            ▶ Produzir com Claude
          </button>
        </div>
      ) : null}
    </article>
  );
}

// ============================================================
// PainelRevisao — área de revisão embaixo do kanban.
// Só layout por enquanto: seleção de texto, edição, chat com Claude
// pra reescrever. Nenhuma chamada real ao modelo por agora.
// ============================================================

// Conteúdo de exemplo por CAMPO. Real: virá do post no Notion (props Voice
// over, Copy do carrossel, Legenda). Cada post pode ter 1, 2 ou 3 campos.
type CampoRevisao = 'voice' | 'carrossel' | 'legenda';

const CAMPO_INFO: Record<CampoRevisao, { emoji: string; label: string }> = {
  voice: { emoji: '🎙', label: 'Voice over' },
  carrossel: { emoji: '🎠', label: 'Copy do carrossel' },
  legenda: { emoji: '💬', label: 'Legenda' },
};

const CONTEUDO_EXEMPLO: Record<CampoRevisao, string> = {
  voice: `[ABERTURA — 0:00-0:02]
Sabe qual é o melhor lugar do trem panorâmico da Suíça?
Não é onde você tá pensando.

[DESENVOLVIMENTO — 0:03-0:18]
Todo mundo corre pro vagão panorâmico grande, senta na janela do lado direito e acha que já era.
Mas o segredo tá na janela pequena atrás, no fim do vagão — de onde dá pra ver os viadutos se curvando enquanto o trem sobe.

[VIRADA — 0:19-0:24]
E tem mais: em Alp Grüm o trem para dois minutos. Aproveita pra descer e fotografar o glaciar. A maioria fica sentada e perde.

[CTA — 0:25-0:30]
Salva esse post pra usar quando for planejar sua viagem pra Suíça.`,

  carrossel: `CARD 1 — CAPA
Você tá indo no lugar errado
do vagão panorâmico da Suíça

CARD 2
O erro de todo mundo:
sentar do lado direito

CARD 3
O segredo:
a janela pequena atrás,
no fim do vagão

CARD 4
De lá você vê os viadutos
se curvando enquanto
o trem sobe

CARD 5
Bônus 1: em Alp Grüm o trem
para 2 min — desce pra
fotografar o glaciar

CARD 6
Bônus 2: reserve o lugar 63 do
vagão panorâmico — é o único
que gira 180°

CARD 7 — CTA
Salva pra planejar sua
viagem pra Suíça 🇨🇭`,

  legenda: `Você já ficou em pé no vagão panorâmico do Trem da Suíça só pra tirar aquela foto que todo mundo tira? Errado.

O melhor lugar do Bernina Express não é a janela grande do lado direito. É a janela pequena, atrás, no final do vagão — de onde dá pra ver os viadutos curvando pra trás enquanto o trem sobe.

3 coisas que ninguém te conta antes de embarcar:

• O trem para 2 minutos em Alp Grüm — desce pra tirar foto do glaciar
• Reserva o lugar 63 do vagão panorâmico (é o único que gira 180°)
• Leva casaco: o vagão descoberto entre St. Moritz e Tirano fica 4°C

Vai de Chur até Tirano se quiser fazer o clássico. Mas se puder, faz o inverso — sai no lado italiano e chega na Suíça com o pôr do sol.

Salva pra quando for planejar 🇨🇭

#suicaporlud #bernina #trempanoramico`,
};

function PainelRevisao({
  card,
  onMoverParaReaprovacao,
}: {
  card: Card | null;
  onMoverParaReaprovacao?: (cardId: string) => void;
}) {
  const router = useRouter();
  const [campoAtivo, setCampoAtivo] = useState<CampoRevisao>('legenda');
  // Snapshot da última versão salva por campo, pra detectar "não salvo"
  const [conteudosSalvos, setConteudosSalvos] = useState<
    Record<CampoRevisao, string>
  >(() => ({ ...CONTEUDO_EXEMPLO }));
  // Conteúdo dos 3 campos. Se o post tem postId, buscamos do Notion.
  // Enquanto carrega, mostra o exemplo. Se falhar, mantém o exemplo.
  const [conteudos, setConteudos] = useState<Record<CampoRevisao, string>>(
    () => ({ ...CONTEUDO_EXEMPLO }),
  );
  const [carregandoCopy, setCarregandoCopy] = useState(false);
  const [fonteCopy, setFonteCopy] = useState<'notion' | 'exemplo'>('exemplo');
  const [selecionado, setSelecionado] = useState<string>('');
  const [instrucaoClaude, setInstrucaoClaude] = useState('');
  const [acaoLoading, setAcaoLoading] = useState<'aprovar' | 'alterar' | 'claude' | null>(
    null,
  );
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [acaoSucesso, setAcaoSucesso] = useState<string | null>(null);
  // Feedbacks por card (do CarrosselCardPorCard). Chave: numero do card
  const [feedbacksCards, setFeedbacksCards] = useState<Record<string, string>>(
    {},
  );

  async function aprovarTarefa() {
    if (!card) return;
    setAcaoLoading('aprovar');
    setAcaoErro(null);
    setAcaoSucesso(null);
    try {
      const res = await fetch(`/api/tarefas/${card.id}/aprovar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setAcaoSucesso('✅ Aprovado! Card indo pra coluna Pronto.');
      router.refresh();
    } catch (e: any) {
      setAcaoErro(e.message);
    } finally {
      setAcaoLoading(null);
    }
  }

  function montarComentarioAlteracao(): string {
    const partes: string[] = [];
    // Feedbacks por card (carrossel)
    const nums = Object.keys(feedbacksCards).sort(
      (a, b) => parseInt(a) - parseInt(b),
    );
    for (const n of nums) {
      const t = feedbacksCards[n].trim();
      if (t) partes.push(`CARD ${n}: ${t}`);
    }
    // Comentário geral (do textarea do Claude)
    const geral = instrucaoClaude.trim();
    if (geral) partes.push(`GERAL: ${geral}`);
    return partes.join('\n\n');
  }

  async function pedirAlteracaoTarefa() {
    if (!card?.postId) {
      setAcaoErro('Card sem post vinculado — não dá pra reescrever.');
      return;
    }
    if (
      Object.keys(feedbacksCards).length === 0 &&
      instrucaoClaude.trim().length < 3
    ) {
      setAcaoErro(
        'Adicione pelo menos um feedback: use 💬 Comentar em algum card, ou escreva no campo do Claude à direita.',
      );
      return;
    }
    setAcaoLoading('alterar');
    setAcaoErro(null);
    setAcaoSucesso(null);
    try {
      const res = await fetch(`/api/esteira/reescrever/${card.postId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          feedbacksCards,
          instrucaoGeral: instrucaoClaude.trim(),
          // Manda a copy EDITADA pelo cliente (com edições inline). O backend
          // usa essa em vez de reler o Notion, preservando as mudanças manuais.
          copyEditada: {
            voice: conteudos.voice,
            carrossel: conteudos.carrossel,
            legenda: conteudos.legenda,
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      // Atualiza a copy no painel com a versão reescrita
      if (j.copyNova) {
        const nova = {
          voice: j.copyNova.voice ?? conteudos.voice,
          carrossel: j.copyNova.carrossel ?? conteudos.carrossel,
          legenda: j.copyNova.legenda ?? conteudos.legenda,
        };
        setConteudos(nova);
        setConteudosSalvos(nova);
      }
      setFeedbacksCards({});
      setInstrucaoClaude('');
      setAcaoSucesso(
        `✨ Claude reescreveu a copy (v${j.versao ?? 2}). Rolando pra Reaprovação — revise a nova versão acima.`,
      );
      // Move o card local pra coluna Reaprovação
      onMoverParaReaprovacao?.(card.id);
    } catch (e: any) {
      setAcaoErro(e.message ?? 'Erro inesperado');
    } finally {
      setAcaoLoading(null);
    }
  }

  function pegarSelecao() {
    if (typeof window === 'undefined') return;
    const s = window.getSelection?.()?.toString() ?? '';
    setSelecionado(s.trim());
  }

  // Sempre que o card selecionado muda, tenta buscar a copy real do Notion
  useEffect(() => {
    if (!card?.postId) {
      const base = { ...CONTEUDO_EXEMPLO };
      setConteudos(base);
      setConteudosSalvos(base);
      setFonteCopy('exemplo');
      return;
    }
    let cancelou = false;
    setCarregandoCopy(true);
    fetch(`/api/esteira/copy/${card.postId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelou) return;
        const c = j?.copy ?? {};
        const temAlgo = !!(c.voice || c.carrossel || c.legenda);
        if (temAlgo) {
          const novo = {
            voice: c.voice ?? '(voice over não produzido ainda pra esse post)',
            carrossel:
              c.carrossel ?? '(carrossel não produzido ainda pra esse post)',
            legenda:
              c.legenda ?? '(legenda não produzida ainda pra esse post)',
          };
          setConteudos(novo);
          setConteudosSalvos(novo);
          setFonteCopy('notion');
        } else {
          const base = { ...CONTEUDO_EXEMPLO };
          setConteudos(base);
          setConteudosSalvos(base);
          setFonteCopy('exemplo');
        }
      })
      .catch(() => {
        if (cancelou) return;
        const base = { ...CONTEUDO_EXEMPLO };
        setConteudos(base);
        setConteudosSalvos(base);
        setFonteCopy('exemplo');
      })
      .finally(() => {
        if (!cancelou) setCarregandoCopy(false);
      });
    return () => {
      cancelou = true;
    };
  }, [card?.postId]);

  const modificado = conteudos[campoAtivo] !== conteudosSalvos[campoAtivo];
  function salvarCampo() {
    setConteudosSalvos((prev) => ({
      ...prev,
      [campoAtivo]: conteudos[campoAtivo],
    }));
    // TODO: quando a rotina noturna existir, persistir no Notion via endpoint
  }

  if (!card) return null;

  // No futuro: quais campos esse post EFETIVAMENTE tem (Reels não tem carrossel,
  // Carrossel não tem voice over, etc). Por ora, os 3 sempre aparecem pra demo.
  const camposDisponiveis: CampoRevisao[] = ['voice', 'carrossel', 'legenda'];

  const SUGESTOES = [
    'Deixa mais curto',
    'Muda o tom pra mais divertido',
    'Adiciona uma pergunta no começo',
    'Reescreve como carrossel',
    'Foca no benefício pro leitor',
  ];

  return (
    <section
      id="revisao"
      className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-[rgba(21,21,33,0.08)] bg-bgSoft/40 px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
              revisão
            </div>
            {carregandoCopy ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-t3">
                • carregando…
              </span>
            ) : fonteCopy === 'notion' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F0EA] px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#2F5A3A]">
                ● copy real do Notion
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF1D9] px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8A6A15]">
                ● exemplo (sem copy no post)
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 min-w-0">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: card.cliente.cor }}
            />
            <span
              className="text-[10.5px] font-bold uppercase tracking-[0.06em] shrink-0"
              style={{ color: card.cliente.cor }}
            >
              {card.cliente.nome}
            </span>
            <span className="text-t3 shrink-0">·</span>
            <span className="truncate text-[13px] font-semibold text-ink">
              {card.titulo}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={pedirAlteracaoTarefa}
            disabled={acaoLoading !== null}
            className="rounded-full px-4 py-2 text-[12px] font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            style={{
              background: acaoLoading === 'alterar' ? '#6E1614' : '#FDECEA',
              color: acaoLoading === 'alterar' ? 'white' : '#B02E2A',
            }}
          >
            {acaoLoading === 'alterar' ? (
              <>
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" />
                </span>
                Enviando alteração…
              </>
            ) : (
              'Pedir alteração'
            )}
          </button>
          <button
            onClick={aprovarTarefa}
            disabled={acaoLoading !== null}
            className="rounded-full px-4 py-2 text-[12px] font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            style={{
              background: acaoLoading === 'aprovar' ? '#2F5A3A' : '#E6F0EA',
              color: acaoLoading === 'aprovar' ? 'white' : '#2F5A3A',
            }}
          >
            {acaoLoading === 'aprovar' ? (
              <>
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" />
                </span>
                Aprovando…
              </>
            ) : (
              'Aprovar'
            )}
          </button>
        </div>
      </div>

      {acaoErro && (
        <div className="border-b border-[rgba(21,21,33,0.08)] bg-hubRed/10 px-5 py-3 text-[13px] font-semibold text-hubRed">
          ❌ {acaoErro}
        </div>
      )}
      {acaoSucesso && (
        <div
          className="border-b border-[rgba(21,21,33,0.08)] px-5 py-3 text-[13px] font-semibold"
          style={{ background: '#E6F0EA', color: '#2F5A3A' }}
        >
          {acaoSucesso}
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        {/* Coluna 1 — Copy */}
        <div className="p-5 space-y-3 border-b lg:border-b-0 lg:border-r border-[rgba(21,21,33,0.06)] relative">
          {acaoLoading === 'claude' && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-[2px]"
              style={{ background: 'rgba(110,42,44,0.06)' }}
            >
              <div
                className="flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-lg border border-[#6E2A2C]/20"
                style={{ color: '#6E2A2C' }}
              >
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#6E2A2C] animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-[#6E2A2C] animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-[#6E2A2C] animate-bounce" />
                </span>
                <span className="text-[13px] font-semibold">
                  Claude tá reescrevendo a {CAMPO_INFO[campoAtivo].label.toLowerCase()}…
                </span>
              </div>
            </div>
          )}
          {/* Abas de CAMPO: voice / carrossel / legenda */}
          <div className="flex items-center gap-1 border-b border-[rgba(21,21,33,0.08)]">
            {camposDisponiveis.map((cp) => {
              const ativa = campoAtivo === cp;
              const info = CAMPO_INFO[cp];
              return (
                <button
                  key={cp}
                  onClick={() => {
                    setCampoAtivo(cp);
                    setSelecionado('');
                  }}
                  className="relative px-3 py-2 text-[12px] font-semibold transition"
                  style={{
                    color: ativa ? 'var(--ink)' : 'var(--t3)',
                  }}
                >
                  <span className="mr-1.5">{info.emoji}</span>
                  {info.label}
                  {ativa && (
                    <span
                      className="absolute inset-x-3 -bottom-px h-[2px] rounded-full"
                      style={{ background: card.cliente.cor }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Barra de status do campo: seleção + salvar quando modificado */}
          <div className="flex items-center justify-between gap-2 min-h-[26px]">
            <span className="text-[11px] text-t3">
              {selecionado ? (
                <>Selecionado: {selecionado.length} caracteres</>
              ) : modificado ? (
                <>Alterações não salvas</>
              ) : (
                <>&nbsp;</>
              )}
            </span>
            {modificado && (
              <button
                onClick={salvarCampo}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                style={{ background: '#E6F0EA', color: '#2F5A3A' }}
              >
                💾 Salvar {CAMPO_INFO[campoAtivo].label.toLowerCase()}
              </button>
            )}
          </div>

          {/* Área do conteúdo do campo ativo — sempre editável */}
          {campoAtivo === 'carrossel' ? (
            <CarrosselCardPorCard
              texto={conteudos.carrossel}
              onSelecao={pegarSelecao}
              onEdit={(novo) =>
                setConteudos((prev) => ({ ...prev, carrossel: novo }))
              }
              feedbacks={feedbacksCards}
              onFeedbacksChange={setFeedbacksCards}
            />
          ) : (
            <textarea
              value={conteudos[campoAtivo]}
              onChange={(e) =>
                setConteudos((prev) => ({
                  ...prev,
                  [campoAtivo]: e.target.value,
                }))
              }
              onMouseUp={pegarSelecao}
              onTouchEnd={pegarSelecao}
              className="w-full rounded-xl border border-[rgba(21,21,33,0.15)] bg-white p-5 text-[14px] leading-relaxed text-ink font-[system-ui] resize-y min-h-[520px] max-h-[75vh] focus:outline-none focus:border-ink"
            />
          )}

          {/* Ação flutuante quando algo tá selecionado */}
          {selecionado && (
            <div className="rounded-lg border border-[rgba(21,21,33,0.15)] bg-white p-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.06em] text-t3 px-2">
                No trecho selecionado:
              </span>
              <button className="rounded-md px-2 py-1 text-[11px] font-semibold text-t2 hover:bg-bgSoft transition">
                🤖 Reescrever
              </button>
              <button className="rounded-md px-2 py-1 text-[11px] font-semibold text-t2 hover:bg-bgSoft transition">
                ✂️ Encurtar
              </button>
              <button className="rounded-md px-2 py-1 text-[11px] font-semibold text-t2 hover:bg-bgSoft transition">
                🎨 Melhorar tom
              </button>
              <button className="rounded-md px-2 py-1 text-[11px] font-semibold text-t2 hover:bg-bgSoft transition">
                💬 Explicar escolha
              </button>
            </div>
          )}
        </div>

        {/* Coluna 2 — Comentário geral pro Claude (aplicado ao clicar
            "Pedir alteração" no topo — não tem mais botão duplicado aqui) */}
        <div className="p-5 space-y-3 bg-bgSoft/20 min-h-full flex flex-col">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
              🤖 Comentário geral pro Claude
            </div>
            <p className="mt-1 text-[11px] text-t3 leading-relaxed">
              Ele conhece o briefing, tom de voz e histórico do cliente. Ao
              clicar em <b>Pedir alteração</b> lá em cima, esse comentário
              entra junto com os feedbacks por card.
            </p>
          </div>

          <textarea
            value={instrucaoClaude}
            onChange={(e) => setInstrucaoClaude(e.target.value)}
            placeholder={`Ex: 'Reescreve mais curto', 'Muda o tom pra descontraído', 'Adiciona uma pergunta no começo'…`}
            className="w-full rounded-lg border border-[rgba(21,21,33,0.15)] bg-white p-4 text-[13px] resize-y min-h-[220px] focus:outline-none focus:border-ink"
          />

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-t3 mb-1.5">
              Sugestões rápidas
            </div>
            <div className="flex flex-wrap gap-1">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => setInstrucaoClaude(s)}
                  className="rounded-full border border-[rgba(21,21,33,0.15)] bg-white px-2.5 py-1 text-[10.5px] font-medium text-t2 transition hover:border-ink hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-3 border-t border-[rgba(21,21,33,0.08)] text-[10px] text-t3 leading-relaxed">
            💡 Dica: selecione um trecho na copy pra pedir mudança pontual, ou
            use 💬 Comentar dentro de cada card do carrossel.
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CarrosselCardPorCard — parseia a copy do carrossel e mostra
// cada lâmina como um bloco separado com botão de feedback.
// ============================================================

type CardParseado = { numero: string; titulo: string; corpo: string };

function ClaudeTrabalhando({ label = 'Claude reescrevendo' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-bounce" />
      </span>
      <span>{label}</span>
    </span>
  );
}

function parsearCarrossel(texto: string): CardParseado[] {
  const cards: CardParseado[] = [];
  const linhas = texto.split('\n');
  let atual: CardParseado | null = null;
  for (const l of linhas) {
    const m = l.match(/^\s*CARD\s+(\d+)(?:\s*\(([^)]+)\))?\s*$/i);
    if (m) {
      if (atual) cards.push(atual);
      atual = {
        numero: m[1],
        titulo: m[2] ? `CARD ${m[1]} · ${m[2]}` : `CARD ${m[1]}`,
        corpo: '',
      };
    } else if (atual) {
      // Ignora linhas que sejam só separadores "---" (deixa o corpo limpo)
      if (/^\s*-{3,}\s*$/.test(l)) continue;
      atual.corpo += l + '\n';
    }
  }
  if (atual) cards.push(atual);
  return cards.map((c) => ({ ...c, corpo: c.corpo.trim() }));
}

function serializarCarrossel(cards: CardParseado[]): string {
  return cards
    .map((c) => {
      const rotuloExtra = c.titulo.includes('·')
        ? ` (${c.titulo.split('·')[1].trim()})`
        : '';
      return `CARD ${c.numero}${rotuloExtra}\n\n${c.corpo}`;
    })
    .join('\n\n');
}

function CarrosselCardPorCard({
  texto,
  onSelecao,
  onEdit,
  feedbacks: feedbacksExternos,
  onFeedbacksChange,
}: {
  texto: string;
  onSelecao: () => void;
  onEdit?: (novoTexto: string) => void;
  feedbacks?: Record<string, string>;
  onFeedbacksChange?: (f: Record<string, string>) => void;
}) {
  const [cards, setCards] = useState<CardParseado[]>(() => parsearCarrossel(texto));
  const [ultimoTextoExterno, setUltimoTextoExterno] = useState(texto);
  useEffect(() => {
    if (texto !== ultimoTextoExterno) {
      setCards(parsearCarrossel(texto));
      setUltimoTextoExterno(texto);
    }
  }, [texto, ultimoTextoExterno]);

  // Feedbacks vêm de fora (state no PainelRevisao) pra o botão "Pedir alteração"
  // conseguir juntá-los. Se ninguém passar, funciona só localmente.
  const [feedbacksLocal, setFeedbacksLocal] = useState<Record<string, string>>({});
  const feedbacks = feedbacksExternos ?? feedbacksLocal;
  function setFeedbacks(novo: Record<string, string>) {
    if (onFeedbacksChange) onFeedbacksChange(novo);
    else setFeedbacksLocal(novo);
  }
  const [abertoCard, setAbertoCard] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [editandoCorpo, setEditandoCorpo] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <textarea
        value={texto}
        onChange={(e) => onEdit?.(e.target.value)}
        onMouseUp={onSelecao}
        onTouchEnd={onSelecao}
        className="w-full rounded-xl border border-[rgba(21,21,33,0.15)] bg-white p-5 text-[14px] leading-relaxed text-ink font-[system-ui] resize-y min-h-[520px] max-h-[75vh] focus:outline-none focus:border-ink"
      />
    );
  }

  function atualizarCorpoCard(numero: string, novoCorpo: string) {
    const novos = cards.map((c) =>
      c.numero === numero ? { ...c, corpo: novoCorpo } : c,
    );
    setCards(novos);
    if (onEdit) {
      const textoNovo = serializarCarrossel(novos);
      setUltimoTextoExterno(textoNovo); // evita re-parse desnecessário
      onEdit(textoNovo);
    }
  }

  function salvarFeedback(numero: string) {
    if (!rascunho.trim()) return;
    setFeedbacks({ ...feedbacks, [numero]: rascunho.trim() });
    setAbertoCard(null);
    setRascunho('');
  }

  return (
    <div className="space-y-3 min-h-[520px] max-h-[75vh] overflow-y-auto pr-1">
      {cards.map((c) => {
        const aberto = abertoCard === c.numero;
        const feedback = feedbacks[c.numero];
        return (
          <article
            key={c.numero}
            className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-white overflow-hidden"
          >
            <header className="flex items-center justify-between gap-2 px-4 py-2 bg-bgSoft/40 border-b border-[rgba(21,21,33,0.06)]">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-t2">
                {c.titulo}
              </span>
              <div className="flex items-center gap-1.5">
                {feedback && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-bold uppercase tracking-[0.06em]"
                    style={{ background: '#FDECEA', color: '#B02E2A' }}
                  >
                    ● feedback
                  </span>
                )}
                {onEdit && (
                  <button
                    onClick={() =>
                      setEditandoCorpo(
                        editandoCorpo === c.numero ? null : c.numero,
                      )
                    }
                    className="text-[11px] font-semibold text-t2 hover:text-ink transition rounded-md px-2 py-1 hover:bg-white"
                  >
                    {editandoCorpo === c.numero ? 'Fechar edição' : '✏️ Editar'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setAbertoCard(aberto ? null : c.numero);
                    setRascunho(feedback ?? '');
                  }}
                  className="text-[11px] font-semibold text-t2 hover:text-ink transition rounded-md px-2 py-1 hover:bg-white"
                >
                  {aberto ? 'Fechar' : feedback ? 'Editar feedback' : '💬 Comentar'}
                </button>
              </div>
            </header>
            {editandoCorpo === c.numero ? (
              <textarea
                value={c.corpo}
                onChange={(e) => atualizarCorpoCard(c.numero, e.target.value)}
                className="w-full border-0 p-4 text-[14px] leading-relaxed text-ink font-[system-ui] resize-y min-h-[140px] focus:outline-none focus:bg-bgSoft/20"
                autoFocus
              />
            ) : (
              <div
                onMouseUp={onSelecao}
                onTouchEnd={onSelecao}
                className="p-4 text-[14px] leading-relaxed text-ink whitespace-pre-wrap font-[system-ui] select-text"
              >
                {c.corpo}
              </div>
            )}
            {feedback && !aberto && (
              <div className="border-t border-[rgba(21,21,33,0.06)] bg-[#FDECEA]/40 px-4 py-2.5">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#B02E2A] mb-1">
                  Seu feedback
                </div>
                <div className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">
                  {feedback}
                </div>
              </div>
            )}
            {aberto && (
              <div className="border-t border-[rgba(21,21,33,0.06)] p-3 space-y-2 bg-bgSoft/20">
                <textarea
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  rows={3}
                  placeholder="O que precisa mudar neste card?"
                  className="w-full rounded-lg border border-[rgba(21,21,33,0.15)] bg-white p-2 text-[12px] resize-y min-h-[60px] focus:outline-none focus:border-ink"
                />
                <div className="flex items-center justify-end gap-2">
                  {feedback && (
                    <button
                      onClick={() => {
                        const novo = { ...feedbacks };
                        delete novo[c.numero];
                        setFeedbacks(novo);
                        setAbertoCard(null);
                        setRascunho('');
                      }}
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-t3 hover:text-hubRed transition"
                    >
                      Remover
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setAbertoCard(null);
                      setRascunho('');
                    }}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-t3 hover:text-ink transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => salvarFeedback(c.numero)}
                    disabled={!rascunho.trim()}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#6E2A2C', color: 'white' }}
                  >
                    Salvar feedback
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
      {Object.keys(feedbacks).length > 0 && (
        <div className="rounded-xl border border-[#B02E2A]/30 bg-[#FDECEA]/40 p-3 text-[11px] text-t2">
          <b>{Object.keys(feedbacks).length}</b> feedback{Object.keys(feedbacks).length === 1 ? '' : 's'} pendente{Object.keys(feedbacks).length === 1 ? '' : 's'}.
          Quando clicar em <b>Pedir alteração</b> no topo, todos vão junto pra
          equipe (por enquanto ficam salvos só nesta sessão).
        </div>
      )}
    </div>
  );
}

// ============================================================
// SecaoAprovadas — lista compacta de cards já aprovados hoje.
// Fica embaixo do kanban, colapsada por padrão.
// ============================================================
function SecaoAprovadas({
  cards,
  onSelect,
}: {
  cards: Card[];
  onSelect: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  if (cards.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white overflow-hidden">
      <button
        onClick={() => setAberto((s) => !s)}
        className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-bgSoft/40 transition"
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em]"
            style={{ background: '#E4F2E6', color: '#2F5A3A' }}
          >
            ✓ Aprovadas
          </span>
          <span className="text-[13px] text-t2">
            {cards.length} copy{cards.length === 1 ? '' : 's'} concluída
            {cards.length === 1 ? '' : 's'}
          </span>
        </div>
        <span className="text-[13px] text-t3">{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <ul className="divide-y divide-[rgba(21,21,33,0.06)]">
          {cards.map((c) => (
            <li
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="px-5 py-2.5 hover:bg-bgSoft/40 cursor-pointer flex items-center gap-3"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: c.cliente.cor }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.06em] shrink-0"
                style={{ color: c.cliente.cor }}
              >
                {c.cliente.nome}
              </span>
              <span className="text-t3 shrink-0">·</span>
              <span className="text-[13px] text-ink truncate flex-1">
                {c.titulo}
              </span>
              <span className="text-[10px] text-t3 shrink-0">✓</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
