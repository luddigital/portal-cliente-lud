'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { LinkPrevia } from '../_components/LinkPrevia';
import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';

/**
 * Esteira Copy · layout "NOVA · Esteira Copy".
 * A copy é feita pela skill criar-copy-completo e gravada no post do Notion;
 * aqui a Luiza revisa, aprova ou pede alteração pro Claude.
 */

export type EtapaEsteira = 'nao' | 'andamento' | 'aprovacao' | 'alteracao';
export type CardEsteira = {
  tarefaId: string;
  postId: string;
  titulo: string;
  handle: string;
  pessoa: string | null;
  prazo: string | null; // YYYY-MM-DD
  etapa: EtapaEsteira;
  etapaNome: string;
  /** Status na fila da skill (Na fila / Produzindo / Erro), se foi pedido pelo botão Produzir copy. */
  fila: string | null;
  /** Formato do post (Reels, Carrossel…). */
  formato?: string | null;
};

/** Emoji do formato pra lista: 📱 reels · 🗂️ carrossel · ⭕ story · 🖼️ estático. */
export function emojiDoFormato(nome?: string | null): string | null {
  if (!nome) return null;
  const n = nome.toLowerCase();
  if (n.includes('reel') || n.includes('vídeo') || n.includes('video')) return '📱';
  if (n.includes('carross')) return '🗂️';
  if (n.includes('stor')) return '⭕';
  if (n.includes('est') || n.includes('foto') || n.includes('post') || n.includes('imagem')) return '🖼️';
  return '📝';
}

const ST: Record<EtapaEsteira, { rot: string; bg: string; tx: string; barra: string }> = {
  nao: { rot: 'não iniciado', bg: '#F0F0F1', tx: '#46464B', barra: '#D6D6D9' },
  andamento: { rot: 'produzindo', bg: '#E8E4FA', tx: '#3E2F8F', barra: '#7462D6' },
  aprovacao: { rot: 'aprovação', bg: '#FBE3E0', tx: '#7E211C', barra: '#B42318' },
  alteracao: { rot: 'alteração', bg: '#F8DCEA', tx: '#7A1F4C', barra: '#C2417E' },
};
const ROT_ETAPA: Record<EtapaEsteira, string> = {
  nao: 'B&C',
  andamento: 'B&C · em andamento',
  aprovacao: 'Aprovação | B&C',
  alteracao: 'Alteração | B&C',
};
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const soma = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const BTN = 'inline-flex h-8 items-center whitespace-nowrap rounded-[10px] border border-[#D6D6D9] bg-white px-3 text-[12.5px] font-extrabold text-[#111113] hover:bg-[#F4F4F5]';
const CARD = 'rounded-[20px] border border-[#E9E9EB] bg-white';

function Pill({ etapa, children }: { etapa: EtapaEsteira; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-extrabold" style={{ background: ST[etapa].bg, color: ST[etapa].tx }}>
      {children}
    </span>
  );
}


/* Cores das tags da lista (proposta A). */
const TAG: Record<EtapaEsteira, { rot: string; bg: string; tx: string }> = {
  nao: { rot: 'Não iniciado', bg: '#F4F4F5', tx: '#46464B' },
  andamento: { rot: 'Produzindo', bg: '#E8E4FA', tx: '#3E2F8F' },
  aprovacao: { rot: 'Aprovação', bg: '#F2D0EA', tx: '#6A2B5F' },
  alteracao: { rot: 'Alteração', bg: '#F8DCEA', tx: '#7A1F4C' },
};
const revisavel = (c: CardEsteira) => c.etapa === 'aprovacao' || c.etapa === 'alteracao';

function Tag({ etapa, className = '' }: { etapa: EtapaEsteira; className?: string }) {
  return (
    <span className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-[9px] py-[2px] text-[11px] font-extrabold ${className}`} style={{ background: TAG[etapa].bg, color: TAG[etapa].tx }}>
      {TAG[etapa].rot}
    </span>
  );
}

function TagDoCard({ card, ajuste }: { card: CardEsteira; ajuste?: EstadoAjuste }) {
  const S = 'inline-flex w-fit items-center whitespace-nowrap rounded-full px-[9px] py-[2px] text-[11px] font-extrabold';
  if (ajuste?.estado === 'ajustando') return <span className={`${S} animate-pulse bg-[#E8E4FA] text-[#3E2F8F]`}>Ajustando…</span>;
  if (ajuste?.estado === 'ajustado' && revisavel(card)) return <span className={`${S} bg-[#D8EDCF] text-[#2E5520]`}>✓ Ajustado</span>;
  if (ajuste?.estado === 'erro') return <span title={ajuste.erro} className={`${S} bg-[#FBE3E0] text-[#7E211C]`}>Não ajustou</span>;
  return <Tag etapa={card.etapa} />;
}

export type Contagem = { revisar: number; nao: number; andamento: number };

/** Selos do topo: pra revisar · não iniciados · produzindo. */
export function SelosDoTopo({ n }: { n: Contagem }) {
  const S = 'inline-flex items-center whitespace-nowrap rounded-full px-3 py-[5px] text-[12px] font-extrabold';
  return (
    <span className="flex flex-wrap gap-2">
      <span className={S} style={{ background: '#F2D0EA', color: '#6A2B5F' }}>
        {n.revisar} pra revisar
      </span>
      <span className={S} style={{ background: '#F4F4F5', color: '#46464B' }}>
        {n.nao} {n.nao === 1 ? 'não iniciado' : 'não iniciados'}
      </span>
      <span className={S} style={{ background: '#E8E4FA', color: '#3E2F8F' }}>
        {n.andamento} produzindo
      </span>
    </span>
  );
}

type FiltroLista = '' | 'revisar' | 'ajustando' | 'nao' | 'andamento';

/**
 * Ajustes em andamento: quando a Luiza manda um feedback, o post sai de "Pra revisar"
 * e vai pra "Ajustando" enquanto o Claude reescreve; quando termina, volta pra revisar
 * marcado como "ajustado". Fica na tela (o ajuste continua no servidor mesmo se sair).
 */
type EstadoAjuste = { estado: 'ajustando' | 'ajustado' | 'erro'; pendentes: number; erro?: string };
const AjustesCtx = createContext<{ comecar: (id: string) => void; terminar: (id: string, ok: boolean, erro?: string) => void } | null>(null);

/** Esteira Copy · proposta A: lista estreita à esquerda e a revisão larga ocupando o resto. */
export function EsteiraNova({ cards: cardsDoServidor, souLuiza }: { cards: CardEsteira[]; hoje?: string; souLuiza: boolean }) {
  // Aprovados saem da lista aqui mesmo, sem recarregar a página (recarregar deixava a tela em branco).
  const [aprovados, setAprovados] = useState<Set<string>>(new Set());
  const cards = cardsDoServidor.filter((c) => !aprovados.has(c.tarefaId));
  const n: Contagem = {
    revisar: cards.filter(revisavel).length,
    nao: cards.filter((c) => c.etapa === 'nao').length,
    andamento: cards.filter((c) => c.etapa === 'andamento').length,
  };
  const [ajustes, setAjustes] = useState<Record<string, EstadoAjuste>>({});
  const ajustando = (c: CardEsteira) => ajustes[c.tarefaId]?.estado === 'ajustando';
  const nAjustando = cards.filter(ajustando).length;
  const [filtro, setFiltro] = useState<FiltroLista>(n.revisar ? 'revisar' : '');
  const [cliente, setCliente] = useState('');
  const clientes = [...new Set(cards.map((c) => c.handle))].sort();
  const lista = cards
    .filter((c) => !cliente || c.handle === cliente)
    .filter((c) =>
      filtro === 'revisar' ? revisavel(c) && !ajustando(c) : filtro === 'ajustando' ? ajustando(c) : filtro ? c.etapa === filtro : true,
    )
    .sort((a, b) => Number(revisavel(b)) - Number(revisavel(a)) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
  const [selId, setSelId] = useState<string | null>(lista[0]?.tarefaId ?? null);
  const idAberto = selId ?? lista[0]?.tarefaId ?? null; // ao trocar de lista, abre o primeiro
  const idx = lista.findIndex((c) => c.tarefaId === idAberto);
  // o post aberto continua aberto mesmo se mudar de lista (ex.: foi pra "Ajustando")
  const sel = idx >= 0 ? lista[idx] : cards.find((c) => c.tarefaId === idAberto) ?? null;

  const ctx = {
    comecar: (id: string) => {
      setAjustes((a) => ({ ...a, [id]: { estado: 'ajustando', pendentes: (a[id]?.estado === 'ajustando' ? a[id].pendentes : 0) + 1 } }));
      // O post sai da fila de "Pra revisar" na hora: abre o próximo da lista.
      if (id === idAberto && filtro !== 'ajustando') {
        const resto = lista.filter((c) => c.tarefaId !== id);
        const prox = resto[Math.min(Math.max(idx, 0), resto.length - 1)];
        setSelId(prox?.tarefaId ?? null);
      }
    },
    terminar: (id: string, ok: boolean, erro?: string) =>
      setAjustes((a) => {
        const pend = Math.max(0, (a[id]?.pendentes ?? 1) - 1);
        const ultimoErro = ok ? a[id]?.erro : erro;
        return { ...a, [id]: pend ? { estado: 'ajustando', pendentes: pend, erro: ultimoErro } : { estado: ultimoErro ? 'erro' : 'ajustado', pendentes: 0, erro: ultimoErro } };
      }),
  };
  const Chip = ({ f, rot, qtd }: { f: FiltroLista; rot: string; qtd: number }) => (
    <button
      type="button"
      onClick={() => {
        const novo = filtro === f ? '' : f;
        setFiltro(novo);
        setSelId(null);
      }}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[5px] text-[11px] font-extrabold ${filtro === f ? 'bg-[#111113] text-white' : 'bg-[#F4F4F5] text-[#46464B] hover:bg-[#EBEBED]'}`}
    >
      {rot} {qtd}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">Social media · produção</span>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight">Esteira Copy</h1>
        </div>
        <SelosDoTopo n={n} />
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        {/* lista estreita */}
        <div className="flex w-full flex-none flex-col gap-2 rounded-[18px] border border-[#E9E9EB] bg-white p-3.5 lg:sticky lg:top-4 lg:w-[330px]">
          <span className="flex flex-wrap gap-1.5">
            <Chip f="revisar" rot="Pra revisar" qtd={n.revisar - cards.filter((c) => revisavel(c) && ajustando(c)).length} />
            <Chip f="ajustando" rot="Ajustando" qtd={nAjustando} />
            <Chip f="nao" rot="Não iniciado" qtd={n.nao} />
            {n.andamento > 0 && <Chip f="andamento" rot="Produzindo" qtd={n.andamento} />}
          </span>
          <label className="flex items-center gap-1 px-1 py-0.5 text-[12px] text-[#636369]">
            filtro:
            <select value={cliente} onChange={(e) => (setCliente(e.target.value), setSelId(null))} className="cursor-pointer bg-transparent text-[12px] text-[#636369] outline-none hover:text-[#111113]">
              <option value="">todos os clientes</option>
              {clientes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {lista.length === 0 && <span className="px-1 py-2 text-[13px] text-[#636369]">Nada aqui.</span>}
          <div className="flex max-h-[calc(100vh-13rem)] flex-col gap-[3px] overflow-y-auto pr-0.5">
            {lista.map((c) => {
              const ativo = sel?.tarefaId === c.tarefaId;
              return (
                <div
                  key={c.tarefaId} data-tarefa-id={c.tarefaId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelId(c.tarefaId)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelId(c.tarefaId)}
                  className={`flex cursor-pointer flex-col gap-[3px] rounded-[12px] border px-3 py-2.5 text-left ${ativo ? 'border-[#C9BFF5] bg-[#F3F0FD]' : 'border-[#F0F0F2] bg-white hover:bg-[#FAFAFA]'}`}
                >
                  <b className="text-[13px] font-bold leading-[1.3]">{c.titulo}</b>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-[#636369]">
                      {emojiDoFormato(c.formato) && (
                        <span title={c.formato ?? ''} aria-label={c.formato ?? ''} className="text-[13px] leading-none">
                          {emojiDoFormato(c.formato)}
                        </span>
                      )}
                      <span className="truncate">{c.handle}</span>
                    </span>
                    <TagDoCard card={c} ajuste={ajustes[c.tarefaId]} />
                  </span>
                  {c.etapa === 'nao' && (
                    <span className="mt-1 flex justify-end">
                      <BotaoProduzir card={c} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* revisão larga */}
        <div className="w-full min-w-0 flex-1">
          <AjustesCtx.Provider value={ctx}>
          {sel ? (
            <PainelRevisao
              key={sel.tarefaId}
              card={sel}
              souLuiza={souLuiza}
              posicao={idx + 1}
              total={lista.length}
              onAnterior={idx > 0 ? () => setSelId(lista[idx - 1].tarefaId) : null}
              onProximo={idx < lista.length - 1 ? () => setSelId(lista[idx + 1].tarefaId) : idx < 0 && lista.length ? () => setSelId(lista[0].tarefaId) : null}
              ajuste={ajustes[sel.tarefaId]}
              onAprovado={() => {
                const id = sel.tarefaId;
                setTimeout(() => {
                  const resto = lista.filter((c) => c.tarefaId !== id);
                  setSelId(resto[Math.min(Math.max(idx, 0), resto.length - 1)]?.tarefaId ?? null);
                  setAprovados((a) => new Set(a).add(id));
                }, 1200);
              }}
            />
          ) : (
            <div className="rounded-[18px] border border-[#E9E9EB] bg-white px-5 py-4 text-[13px] text-[#636369]">Escolha um post na lista pra revisar.</div>
          )}
          </AjustesCtx.Provider>
        </div>
      </div>
    </div>
  );
}

/** "Produzir copy": põe o post na fila da skill criar-copy-completo (rotina agendada). */
function BotaoProduzir({ card }: { card: CardEsteira }) {
  const [estado, setEstado] = useState<'pronto' | 'enviando' | 'fila' | 'erro'>(card.fila && card.fila !== 'Erro' ? 'fila' : 'pronto');
  if (estado === 'fila') {
    return <span className="w-[104px] text-right text-[11.5px] font-bold text-[#3E2F8F]">{card.fila === 'Produzindo' ? 'produzindo…' : 'na fila da skill'}</span>;
  }
  return (
    <button
      type="button"
      disabled={estado === 'enviando'}
      title={card.fila === 'Erro' ? 'A última tentativa deu erro. Clique pra tentar de novo.' : 'A skill criar-copy-completo escreve a copy e o post vem pra Aprovação'}
      onClick={async (e) => {
        e.stopPropagation();
        setEstado('enviando');
        try {
          const r = await fetch('/api/esteira/produzir-copy', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tarefaId: card.tarefaId, postId: card.postId, titulo: card.titulo, handle: card.handle }),
          });
          if (!r.ok) throw new Error();
          setEstado('fila');
        } catch {
          setEstado('erro');
        }
      }}
      className={`${BTN} disabled:opacity-50 ${estado === 'erro' || card.fila === 'Erro' ? '!border-[#B42318] !text-[#7E211C]' : ''}`}
    >
      {estado === 'enviando' ? 'Enviando…' : estado === 'erro' || card.fila === 'Erro' ? 'Tentar de novo' : 'Produzir copy'}
    </button>
  );
}

type Copy = { voice: string | null; carrossel: string | null; legenda: string | null };
type Info = { formato: string | null; ideia: string | null; briefing: string | null; skills: string[] };
type Campo = keyof Copy;
const ROT_CAMPO: Record<Campo, string> = { voice: 'Voice over', carrossel: 'Carrossel', legenda: 'Legenda' };

/** Lê copy + informações do post (uma chamada). */
function useCopyDoPost(postId: string) {
  const [copy, setCopy] = useState<Copy | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [erro, setErro] = useState(false);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let cancelou = false;
    fetch(`/api/esteira/copy/${postId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelou) return;
        setCopy({ voice: j?.copy?.voice ?? null, carrossel: j?.copy?.carrossel ?? null, legenda: j?.copy?.legenda ?? null });
        setInfo(j?.info ?? null);
      })
      .catch(() => !cancelou && setErro(true));
    return () => {
      cancelou = true;
    };
  }, [postId, versao]);
  return { copy, setCopy, info, erro, recarregar: () => setVersao((v) => v + 1) };
}

/** Primeiras informações do post: formato, skills usadas, ideia e briefing pra equipe. */
function SeletorFormato({ postId, atual, onMudou }: { postId: string; atual: string | null; onMudou: () => void }) {
  const [opcoes, setOpcoes] = useState<{ id: string; nome: string }[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/esteira/formato')
      .then((r) => r.json())
      .then((j) => vivo && setOpcoes(j.opcoes ?? []))
      .catch(() => vivo && setOpcoes([]));
    return () => {
      vivo = false;
    };
  }, []);
  const idAtual = opcoes?.find((o) => o.nome === atual)?.id ?? '';
  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={idAtual}
        disabled={!opcoes || salvando}
        onChange={async (e) => {
          const formatoId = e.target.value;
          if (!formatoId || formatoId === idAtual) return;
          setSalvando(true);
          setErro(null);
          try {
            const r = await fetch('/api/esteira/formato', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ postId, formatoId }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`);
            onMudou();
          } catch (er: any) {
            setErro(er?.message ?? 'Não consegui trocar.');
          } finally {
            setSalvando(false);
          }
        }}
        className="h-7 cursor-pointer rounded-full border border-[#E2E2E5] bg-[#F0F0F1] px-2.5 text-[11.5px] font-extrabold text-[#111113] outline-none hover:border-[#C9C9CE] disabled:cursor-default disabled:opacity-60"
      >
        {!idAtual && <option value="">{opcoes ? atual ?? 'sem formato' : atual ?? 'carregando…'}</option>}
        {opcoes?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
      {salvando && <span className="text-[11px] text-[#8A8A90]">salvando…</span>}
      {erro && <span className="text-[11px] font-bold text-[#B42318]">{erro}</span>}
    </span>
  );
}


/* ───────────────────────── Revisão: takes em cards (propostas A e B) ───────────────────────── */

const ROT_ABA = { voice: 'Voice over', carrossel: 'Carrossel', legenda: 'Legenda', briefing: 'Briefing', ideia: 'Ideia' } as const;
type AbaRev = keyof typeof ROT_ABA;
const BTN_P = 'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#111113] bg-[#111113] px-3 py-1.5 text-[12px] font-extrabold text-white hover:bg-[#2C2C30] disabled:opacity-50';
const BTN_C = 'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#D6D6D9] bg-white px-3 py-1.5 text-[12px] font-extrabold text-[#111113] hover:bg-[#F4F4F5] disabled:opacity-40';
const BTN_V = 'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#2E7D4F] bg-[#2E7D4F] px-4 py-2 text-[13px] font-extrabold text-white hover:bg-[#25683F] disabled:opacity-50';
const EB = 'text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#636369]';

/** "TAKE 1", "CARD 2:" começam um bloco; linha de sugestão visual fica em cinza; hashtags também. */
const ehRotulo = (l: string) => /^\s*(take|card|cena|slide|bloco|parte)\s*\d+\s*(\([^)]{0,24}\)|[-–·:]\s*[^.!?]{0,24})?\s*:?\s*$/i.test(l);
const ehVisual = (l: string) => /^\s*(🎬|\[|\(|visual\b|sugest[aã]o visual|b-?roll|imagem\s*:|foto\s*:|v[ií]deo\s*:|cena\s*:)/i.test(l);
const ehHashtags = (l: string) => /^\s*(#\S+\s*){2,}$/.test(l);
const semPrefixo = (l: string) => l.replace(/^\s*(voice|voz|narra[çc][ãa]o)\s*:\s*/i, '');
const semPrefixoVisual = (l: string) => l.trim().replace(/^🎬\s*/, '').replace(/^sugest[aã]o visual\s*:\s*/i, '');

type Linha = { texto: string; tipo: 'fala' | 'visual' | 'hashtag' | 'vazia' };
type Bloco = { rotulo: string | null; rotuloOriginal?: string; linhas: Linha[] };

function blocosDaCopy(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: Bloco = { rotulo: null, linhas: [] };
  for (const l of texto.split('\n')) {
    if (ehRotulo(l)) {
      if (atual.rotulo || atual.linhas.some((x) => x.tipo !== 'vazia')) blocos.push(atual);
      atual = { rotulo: l.trim().replace(/:\s*$/, ''), rotuloOriginal: l, linhas: [] };
      continue;
    }
    atual.linhas.push({ texto: l, tipo: !l.trim() ? 'vazia' : ehVisual(l) ? 'visual' : ehHashtags(l) ? 'hashtag' : 'fala' });
  }
  if (atual.rotulo || atual.linhas.some((x) => x.tipo !== 'vazia')) blocos.push(atual);
  // tira linhas vazias das pontas de cada bloco
  for (const b of blocos) {
    while (b.linhas[0]?.tipo === 'vazia') b.linhas.shift();
    while (b.linhas[b.linhas.length - 1]?.tipo === 'vazia') b.linhas.pop();
  }
  return blocos;
}

type TipoFeedback = 'post' | 'geral' | 'frase' | 'edicao-geral' | 'edicao-frase';

/** Manda feedback/edição pro post; tudo vai pro banco de feedbacks da melhoria contínua. */
function useFeedback(card: CardEsteira, info: Info | null, onMudou: () => void) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const ajustes = useContext(AjustesCtx);
  async function enviar(tipo: TipoFeedback, campo: Campo | null, dados: { texto?: string; original?: string; novo?: string }): Promise<boolean> {
    // Na lista, o ajuste feito pelo Claude roda por trás: o post vai pra "Ajustando" e a Luiza segue revisando.
    if (ajustes && !tipo.startsWith('edicao')) {
      ajustes.comecar(card.tarefaId);
      setMsg({ ok: true, t: 'Mandei pro Claude ajustar. O post foi pra "Ajustando" e volta pra revisar quando ficar pronto. Pode seguir pro próximo.' });
      fetch('/api/esteira/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo, campo: tipo === 'post' ? null : campo, postId: card.postId, titulo: card.titulo, handle: card.handle, skills: info?.skills ?? [], ...dados }),
      })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`);
          // A rota responde 200 com "aviso" quando registrou o feedback mas não mudou a copy: isso é erro pra Luiza.
          if (j.aviso) throw new Error(j.aviso);
          ajustes.terminar(card.tarefaId, true);
          onMudou();
        })
        .catch((e: any) => ajustes.terminar(card.tarefaId, false, e?.message ?? 'erro'));
      return true;
    }
    setEnviando(`${tipo}:${dados.original ?? ''}`);
    setMsg(null);
    try {
      const r = await fetch('/api/esteira/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo, campo: tipo === 'post' ? null : campo, postId: card.postId, titulo: card.titulo, handle: card.handle, skills: info?.skills ?? [], ...dados }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`);
      if (j.aviso) setMsg({ ok: false, t: j.aviso });
      else setMsg({ ok: true, t: tipo.startsWith('edicao') ? 'Salvo no post. Registrado pra melhoria contínua.' : 'Ajustado no post. O feedback foi pra melhoria contínua.' });
      if (tipo.startsWith('edicao') || j.aplicado) onMudou();
      return true;
    } catch (e: any) {
      setMsg({ ok: false, t: e?.message ?? 'Não consegui salvar.' });
      return false;
    } finally {
      setEnviando(null);
    }
  }
  return { enviar, enviando, msg };
}
type Fb = ReturnType<typeof useFeedback>;

/** Aprova a copy: conclui a tarefa e manda os feedbacks do post pra melhoria contínua. */
function useAprovar(card: CardEsteira, onFeito: () => void) {
  const [aprovando, setAprovando] = useState(false);
  const [msgAprovar, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function aprovar() {
    setAprovando(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/tarefas/${card.tarefaId}/concluir`, { method: 'POST' });
      if (!r.ok) throw new Error();
      avisarConcluida(card.tarefaId, card.etapaNome);
      const fb = await fetch('/api/esteira/feedback/aprovado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: card.postId }),
      })
        .then((x) => x.json())
        .catch(() => null);
      const n = fb?.marcados ?? 0;
      setMsg({ ok: true, t: `Aprovado. O post segue pra próxima etapa.${n ? ` ${n} feedback${n > 1 ? 's' : ''} entrou na melhoria contínua de hoje.` : ''}` });
      onFeito();
    } catch {
      setMsg({ ok: false, t: 'Não consegui aprovar. Tenta de novo.' });
    } finally {
      setAprovando(false);
    }
  }
  return { aprovar, aprovando, msgAprovar };
}

function Aviso({ m }: { m: { ok: boolean; t: string } | null }) {
  if (!m) return null;
  return <span className={`rounded-[10px] px-3 py-2 text-[12.5px] font-bold ${m.ok ? 'bg-[#D8EDCF] text-[#2E5520]' : 'bg-[#FBE3E0] text-[#7E211C]'}`}>{m.t}</span>;
}

/** Um take, card do carrossel ou a legenda num card. Dá pra editar qualquer linha clicando nela. */
function CardTake({ bloco, campo, podeFeedback, fb, titulo }: { bloco: Bloco; campo: Campo; podeFeedback: boolean; fb: Fb; titulo?: string }) {
  // Clicar em qualquer linha (texto, sugestão visual, hashtags) abre a edição ali mesmo,
  // com o campo de comentário logo embaixo pra pedir o ajuste pro Claude.
  const [sel, setSel] = useState<number | null>(null);
  const [edit, setEdit] = useState('');
  const [com, setCom] = useState('');
  const [comCard, setComCard] = useState<string | null>(null); // comentário do card inteiro (null = fechado)
  const ocupado = !!fb.enviando;
  // Texto do card inteiro, igual ao que está no post (linhas seguidas), pra o Claude reescrever só esse trecho.
  const textoDoCard = bloco.linhas.map((l) => l.texto).join('\n').trim();
  async function ajustarCard() {
    if (!comCard || comCard.trim().length < 2) return;
    if ((await fb.enviar('frase', campo, { texto: comCard, original: textoDoCard })) === true) setComCard(null);
  }
  const prefixo = (l: string) => l.match(/^\s*(voice|voz|narra[çc][ãa]o)\s*:\s*/i)?.[0] ?? '';
  function abrir(i: number) {
    setComCard(null);
    setSel(i);
    setEdit(i === -1 ? (bloco.rotuloOriginal ?? '').trim() : semPrefixo(bloco.linhas[i].texto).trim());
    setCom('');
  }
  function fechar() {
    setSel(null);
    setEdit('');
    setCom('');
  }
  async function salvar(original: string) {
    const novo = edit.trim() ? prefixo(original) + edit.trim() : ''; // vazio = apagar a linha
    if ((await fb.enviar('edicao-frase', campo, { original, novo, texto: com.trim() || undefined })) === true) fechar();
  }
  async function ajustar(original: string) {
    if ((await fb.enviar('frase', campo, { texto: com, original })) === true) fechar();
  }
  const ativo = sel !== null || comCard !== null;
  const estilo: Record<Linha['tipo'], string> = {
    fala: 'text-[15.5px] leading-[1.6] text-[#111113]',
    visual: 'text-[12.5px] leading-[1.5] text-[#8A8A90]',
    hashtag: 'text-[13px] text-[#8A8A90]',
    vazia: '',
  };
  return (
    <div className={`flex flex-col gap-1.5 px-4 py-3.5 ${ativo ? 'bg-[#FCFBFF]' : ''}`}>
      {(bloco.rotulo || titulo) && (
        <div className="flex min-h-[24px] items-center justify-between gap-2">
          {podeFeedback && bloco.rotuloOriginal && sel === -1 ? (
            <span className="flex flex-1 flex-wrap items-center gap-2">
              <input
                value={edit}
                onChange={(e) => setEdit(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') fechar();
                  if (e.key === 'Enter' && edit.trim() && edit.trim() !== bloco.rotuloOriginal!.trim()) salvar(bloco.rotuloOriginal!);
                }}
                className="min-w-[200px] flex-1 rounded-[8px] border-2 border-[#7462D6] px-2 py-1 text-[12px] font-extrabold uppercase tracking-[0.06em] outline-none"
              />
              {edit.trim() && edit.trim() !== bloco.rotuloOriginal.trim() && (
                <button type="button" disabled={ocupado} onClick={() => salvar(bloco.rotuloOriginal!)} className={BTN_P}>
                  {ocupado ? 'Salvando…' : 'Salvar título'}
                </button>
              )}
              <button type="button" onClick={fechar} aria-label="Fechar" className="px-1 text-[15px] leading-none text-[#8A8A90] hover:text-[#111113]">
                ×
              </button>
            </span>
          ) : podeFeedback && bloco.rotuloOriginal ? (
            <button type="button" onClick={() => abrir(-1)} title="Clique pra editar o título do card" className={`${EB} -mx-1 cursor-text rounded-[6px] px-1 text-left hover:bg-[#F7F5FE]`}>
              {bloco.rotulo}
            </button>
          ) : (
            <span className={EB}>{bloco.rotulo ?? titulo}</span>
          )}
          {podeFeedback && bloco.rotulo && comCard === null && (
            <button
              type="button"
              onClick={() => (fechar(), setComCard(''))}
              className="rounded-full bg-[#F4F4F5] px-[9px] py-1 text-[11px] font-extrabold text-[#46464B] hover:bg-[#EBEBED]"
            >
              💬 Comentar o card
            </button>
          )}
        </div>
      )}
      {comCard !== null && (
        <div className="flex flex-wrap items-start gap-2 rounded-[10px] bg-[#F3F0FD] px-2.5 py-2">
          <textarea
            value={comCard}
            onChange={(e) => setComCard(e.target.value)}
            autoFocus
            rows={1}
            placeholder={`O que ajustar no ${(bloco.rotulo ?? 'card').toLowerCase()} inteiro?`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setComCard(null);
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ajustarCard();
              }
            }}
            className="min-h-[34px] min-w-[180px] flex-1 resize-y rounded-[8px] border border-[#C9BFF5] bg-white px-2.5 py-[7px] text-[13px] text-[#3E2F8F] outline-none placeholder:text-[#9C93C9] focus:border-[#7462D6]"
          />
          {comCard.trim().length >= 2 && (
            <button type="button" disabled={ocupado} onClick={ajustarCard} className={BTN_P}>
              {ocupado ? 'Ajustando…' : 'Ajustar o card'}
            </button>
          )}
          <button type="button" onClick={() => setComCard(null)} aria-label="Fechar" className="px-1 py-1.5 text-[15px] leading-none text-[#8A8A90] hover:text-[#111113]">
            ×
          </button>
        </div>
      )}
      {bloco.linhas.map((l, i) => {
        if (l.tipo === 'vazia') return <div key={i} className="h-2" />;
        const mostra = l.tipo === 'visual' ? `🎬 ${semPrefixoVisual(l.texto)}` : l.tipo === 'hashtag' ? l.texto.trim() : semPrefixo(l.texto);
        if (!podeFeedback) return <p key={i} className={`m-0 ${estilo[l.tipo]}`}>{mostra}</p>;
        if (sel !== i) {
          return (
            <p
              key={i}
              role="button"
              tabIndex={0}
              title="Clique pra editar ou comentar"
              onClick={() => abrir(i)}
              onKeyDown={(e) => e.key === 'Enter' && abrir(i)}
              className={`m-0 -mx-1 cursor-text rounded-[6px] px-1 hover:bg-[#F7F5FE] ${estilo[l.tipo]}`}
            >
              {mostra}
            </p>
          );
        }
        const mudou = edit.trim() !== semPrefixo(l.texto).trim();
        return (
          <div key={i} className="flex flex-col gap-2">
            <textarea
              value={edit}
              onChange={(e) => setEdit(e.target.value)}
              autoFocus
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') fechar();
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && mudou) salvar(l.texto);
              }}
              rows={Math.max(1, Math.ceil(edit.length / 78))}
              className={`-mx-1 w-[calc(100%+0.5rem)] resize-none rounded-[8px] border-2 border-[#7462D6] bg-white px-1 py-0.5 outline-none ${estilo[l.tipo]}`}
            />
            <div className="flex flex-wrap items-start gap-2 rounded-[10px] bg-[#F3F0FD] px-2.5 py-2">
              <textarea
                value={com}
                onChange={(e) => setCom(e.target.value)}
                rows={1}
                placeholder="Ou comente o que ajustar e eu reescrevo…"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') fechar();
                  if (e.key === 'Enter' && !e.shiftKey && com.trim().length >= 2 && !mudou) {
                    e.preventDefault();
                    ajustar(l.texto);
                  }
                }}
                className="min-h-[34px] min-w-[180px] flex-1 resize-y rounded-[8px] border border-[#C9BFF5] bg-white px-2.5 py-[7px] text-[13px] text-[#3E2F8F] outline-none placeholder:text-[#9C93C9] focus:border-[#7462D6]"
              />
              {mudou && (
                <button type="button" disabled={ocupado} onClick={() => salvar(l.texto)} className={BTN_P}>
                  {ocupado ? 'Salvando…' : edit.trim() ? 'Salvar edição' : 'Apagar linha'}
                </button>
              )}
              {!mudou && com.trim().length >= 2 && (
                <button type="button" disabled={ocupado} onClick={() => ajustar(l.texto)} className={BTN_P}>
                  {ocupado ? 'Ajustando…' : 'Ajustar'}
                </button>
              )}
              <button type="button" onClick={fechar} aria-label="Fechar" className="px-1 py-1.5 text-[15px] leading-none text-[#8A8A90] hover:text-[#111113]">
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Um campo da copy numa caixa só, com uma linha separando os cards/takes. */
function CampoEmTakes({ campo, texto, podeFeedback, fb, comTitulo }: { campo: Campo; texto: string; podeFeedback: boolean; fb: Fb; comTitulo?: boolean }) {
  // Voice over: a revisão é só do texto falado, corrido, sem separar em takes e sem as sugestões visuais.
  const blocos: Bloco[] =
    campo === 'voice'
      ? [{ rotulo: null, linhas: blocosDaCopy(texto).flatMap((bl) => bl.linhas.filter((l) => l.tipo === 'fala')) }]
      : blocosDaCopy(texto);
  // Editar o campo inteiro de uma vez (além de linha por linha).
  const [tudo, setTudo] = useState<string | null>(null);
  const ocupado = !!fb.enviando;
  const rot = ROT_ABA[campo].toLowerCase();
  if (tudo !== null) {
    const mudou = tudo.trim() !== texto.trim() && !!tudo.trim();
    return (
      <div className="flex flex-col gap-2 rounded-[14px] border border-[#C9BFF5] bg-white p-3">
        <span className={EB}>Editando {rot} inteiro</span>
        <textarea
          value={tudo}
          onChange={(e) => setTudo(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') setTudo(null);
          }}
          rows={Math.min(40, Math.max(8, tudo.split('\n').length + 2))}
          className="w-full resize-y rounded-[10px] border-2 border-[#7462D6] bg-white px-3 py-2.5 text-[15px] leading-[1.6] outline-none"
        />
        <span className="flex justify-end gap-2">
          <button type="button" onClick={() => setTudo(null)} className={BTN_C}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupado || !mudou}
            onClick={async () => (await fb.enviar('edicao-geral', campo, { original: texto, novo: tudo })) && setTudo(null)}
            className={BTN_P}
          >
            {ocupado ? 'Salvando…' : `Salvar ${rot}`}
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {podeFeedback && (
        <span className="flex justify-end">
          <button type="button" onClick={() => setTudo(texto)} className="rounded-full bg-[#F4F4F5] px-[10px] py-1 text-[11.5px] font-extrabold text-[#46464B] hover:bg-[#EBEBED]">
            ✏️ Editar {rot} inteiro
          </button>
        </span>
      )}
      <div className="flex flex-col divide-y divide-[#EFEFF1] overflow-hidden rounded-[14px] border border-[#EFEFF1] bg-white">
        {blocos.map((b, i) => (
          <CardTake key={`${campo}-${i}-${b.rotulo ?? ''}`} bloco={b} campo={campo} podeFeedback={podeFeedback} fb={fb} titulo={comTitulo && i === 0 && !b.rotulo ? ROT_ABA[campo] : undefined} />
        ))}
      </div>
    </div>
  );
}

function TextoSimples({ texto }: { texto: string | null | undefined }) {
  return (
    <div className="whitespace-pre-wrap rounded-[14px] border border-[#EFEFF1] bg-white px-4 py-3.5 text-[14px] leading-[1.6]">
      {texto?.trim() ? texto : <span className="text-[#8A8A90]">não preenchido no post</span>}
    </div>
  );
}

function SkillsUsadas({ skills }: { skills: string[] }) {
  if (!skills.length) return <span className="text-[12px] text-[#8A8A90]">skills não registradas</span>;
  return (
    <details className="group text-[12px] text-[#636369]">
      <summary className="cursor-pointer list-none hover:text-[#111113] [&::-webkit-details-marker]:hidden">
        {skills.length} skills usadas <span className="inline-block transition group-open:rotate-180">▾</span>
      </summary>
      <span className="mt-1.5 flex flex-wrap gap-1">
        {skills.map((sk) => (
          <span key={sk} className="inline-flex h-6 items-center rounded-full bg-[#E8E4FA] px-2.5 text-[11px] font-extrabold text-[#3E2F8F]">
            {sk}
          </span>
        ))}
      </span>
    </details>
  );
}

const temCopyEm = (c: Copy | null) => !!c && !!(c.voice || c.carrossel || c.legenda);
const linhaDoPost = (card: CardEsteira, info: Info | null) => [card.handle, card.prazo ? `prazo ${ddmm(card.prazo)}` : null, info?.formato].filter(Boolean).join(' · ');

/** Proposta A · painel de revisão (lado direito da lista). */
function PainelRevisao({
  card,
  souLuiza,
  posicao,
  total,
  onAnterior,
  onProximo,
  onAprovado,
  ajuste,
}: {
  card: CardEsteira;
  souLuiza: boolean;
  posicao: number;
  total: number;
  onAnterior: (() => void) | null;
  onProximo: (() => void) | null;
  onAprovado: () => void;
  ajuste?: EstadoAjuste;
}) {
  const { copy, info, erro, recarregar } = useCopyDoPost(card.postId);
  const fb = useFeedback(card, info, recarregar);
  const { aprovar, aprovando, msgAprovar } = useAprovar(card, onAprovado);
  const abasCopy = (['voice', 'carrossel', 'legenda'] as Campo[]).filter((k) => copy?.[k]);
  const [aba, setAba] = useState<AbaRev | null>(null);
  const abaAtual: AbaRev = aba ?? abasCopy[0] ?? 'briefing';
  const podeFeedback = souLuiza && card.etapa !== 'alteracao';
  const [comPost, setComPost] = useState('');
  const temCopy = temCopyEm(copy);

  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] border border-[#E9E9EB] bg-white px-[22px] pb-4 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] text-[#636369]">{linhaDoPost(card, info)}</span>
          <LinkPrevia postId={card.postId} className="text-[22px] font-extrabold leading-tight hover:underline">
            {card.titulo}
          </LinkPrevia>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {revisavel(card) && (
            <a href={`/admin/esteira-copy/${card.tarefaId}`} className={BTN_C} title="Abre só este post, com voice e legenda lado a lado">
              Modo foco ⤢
            </a>
          )}
          <button type="button" disabled={!onAnterior} onClick={() => onAnterior?.()} className={BTN_C}>
            ← anterior
          </button>
          <span className="text-[12px] text-[#636369]">{posicao > 0 ? `${posicao} de ${total}` : `${total} na lista`}</span>
          <button type="button" disabled={!onProximo} onClick={() => onProximo?.()} className={BTN_C}>
            próximo →
          </button>
        </div>
      </div>

      {info && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#636369]">
          Formato
          <SeletorFormato postId={card.postId} atual={info.formato} onMudou={recarregar} />
          <span className="ml-2">
            <SkillsUsadas skills={info.skills} />
          </span>
        </div>
      )}

      {copy && (
      <span className="flex flex-wrap gap-1.5">
        {([...abasCopy, 'briefing', 'ideia'] as AbaRev[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold ${abaAtual === k ? 'bg-[#111113] text-white' : 'bg-[#F4F4F5] text-[#46464B] hover:bg-[#EBEBED]'}`}
          >
            {ROT_ABA[k]}
          </button>
        ))}
      </span>
      )}

      {ajuste?.estado === 'ajustando' ? (
        <span className="animate-pulse rounded-[10px] bg-[#E8E4FA] px-3 py-2 text-[12.5px] font-bold text-[#3E2F8F]">O Claude está ajustando esse post. Quando terminar, a copy nova aparece aqui e ele volta pra “Pra revisar”.</span>
      ) : ajuste?.estado === 'ajustado' ? (
        <span className="rounded-[10px] bg-[#D8EDCF] px-3 py-2 text-[12.5px] font-bold text-[#2E5520]">✓ Ajustado com o seu feedback. Revisa de novo e aprova.</span>
      ) : ajuste?.estado === 'erro' ? (
        <span className="rounded-[10px] bg-[#FBE3E0] px-3 py-2 text-[12.5px] font-bold text-[#7E211C]">{ajuste.erro ?? 'O ajuste não foi aplicado.'} Enquanto isso, dá pra editar direto na linha.</span>
      ) : (
        <Aviso m={fb.msg} />
      )}
      {!copy && !erro && <div className="h-[360px] animate-pulse rounded-[14px] bg-[#F4F4F5]" />}
      {erro && <span className="text-[13px] text-[#7E211C]">Não consegui ler o post no Notion.</span>}
      {copy && !temCopy && (abaAtual === 'briefing' || abaAtual === 'ideia') && (
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[#FAFAFA] px-4 py-3 text-[13px] text-[#636369]">
          Esse post ainda não tem copy.
          {!revisavel(card) && <BotaoProduzir card={card} />}
        </div>
      )}
      {copy && (abaAtual === 'briefing' || abaAtual === 'ideia') && <TextoSimples texto={abaAtual === 'briefing' ? info?.briefing : info?.ideia} />}
      {copy && abaAtual !== 'briefing' && abaAtual !== 'ideia' && <CampoEmTakes key={abaAtual} campo={abaAtual} texto={copy[abaAtual] ?? ''} podeFeedback={podeFeedback} fb={fb} />}

      <Aviso m={msgAprovar} />
      {temCopy && (podeFeedback || revisavel(card)) && (
        <div className="sticky bottom-3 flex w-full flex-wrap items-center gap-2.5 rounded-[16px] bg-[#111113] px-3 py-2.5 shadow-[0_6px_20px_rgba(17,17,19,0.18)]">
          {podeFeedback && (
            <textarea
              value={comPost}
              onChange={(e) => setComPost(e.target.value)}
              rows={1}
              placeholder={`Comentário sobre o post inteiro (${abasCopy.map((k) => ROT_ABA[k].toLowerCase()).join(' e ')}). Eu ajusto na hora…`}
              className="min-h-[40px] min-w-[200px] flex-1 resize-y rounded-[10px] border-0 bg-[#2A2A2E] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-[#A1A1A8]"
            />
          )}
          {podeFeedback && comPost.trim().length >= 2 && (
            <button
              type="button"
              disabled={!!fb.enviando}
              onClick={async () => (await fb.enviar('post', null, { texto: comPost })) && setComPost('')}
              className="inline-flex items-center rounded-full border border-[#3A3A3F] bg-[#2A2A2E] px-4 py-2 text-[13px] font-extrabold text-white hover:bg-[#35353A] disabled:opacity-50"
            >
              {fb.enviando?.startsWith('post') ? 'Ajustando o post…' : 'Enviar e ajustar'}
            </button>
          )}
          {revisavel(card) && souLuiza && (
            <button type="button" onClick={aprovar} disabled={aprovando} className={`${BTN_V} ml-auto`}>
              {aprovando ? 'Aprovando…' : '✓ Aprovar copy'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Proposta B · modo foco: a lista sai, voice e legenda lado a lado e as ações numa coluna à direita. */
export function Revisao({
  card,
  souLuiza,
  posicao,
  total,
  anteriorId,
  proximoId,
  contagem,
  onFeito,
}: {
  card: CardEsteira;
  souLuiza: boolean;
  posicao: number | null;
  total: number;
  anteriorId: string | null;
  proximoId: string | null;
  contagem: Contagem | null;
  onFeito: () => void;
}) {
  const { copy, info, erro, recarregar } = useCopyDoPost(card.postId);
  const fb = useFeedback(card, info, recarregar);
  const { aprovar, aprovando, msgAprovar } = useAprovar(card, onFeito);
  const podeFeedback = souLuiza && card.etapa !== 'alteracao';
  const [comPost, setComPost] = useState('');
  const temCopy = temCopyEm(copy);
  const esquerda = (['voice', 'carrossel'] as Campo[]).filter((k) => copy?.[k]);
  const temLegenda = !!copy?.legenda;
  const campos = (['voice', 'carrossel', 'legenda'] as Campo[]).filter((k) => copy?.[k]);
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className={EB}>Social media · produção</span>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight">Esteira Copy</h1>
        </div>
        {contagem && <SelosDoTopo n={contagem} />}
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3.5 rounded-[18px] border border-[#E9E9EB] bg-white px-[22px] py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] text-[#636369]">{linhaDoPost(card, info)}</span>
              <LinkPrevia postId={card.postId} className="text-[22px] font-extrabold leading-tight hover:underline">
                {card.titulo}
              </LinkPrevia>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href="/admin/esteira-copy" className={BTN_C}>
                ← voltar pra lista
              </a>
              {anteriorId ? (
                <a href={`/admin/esteira-copy/${anteriorId}`} className={BTN_C}>
                  ← anterior
                </a>
              ) : (
                <span className={`${BTN_C} opacity-40`}>← anterior</span>
              )}
              {total > 0 && <span className="text-[12px] text-[#636369]">{posicao ? `${posicao} de ${total}` : `${total} na fila`}</span>}
              {proximoId ? (
                <a href={`/admin/esteira-copy/${proximoId}`} className={BTN_C}>
                  próximo →
                </a>
              ) : (
                <span className={`${BTN_C} opacity-40`}>próximo →</span>
              )}
            </div>
          </div>

          <Aviso m={fb.msg} />
          {!copy && !erro && <div className="h-[420px] animate-pulse rounded-[14px] bg-[#F4F4F5]" />}
          {erro && <span className="text-[13px] text-[#7E211C]">Não consegui ler a copy do post no Notion.</span>}
          {copy && !temCopy && <span className="text-[13px] text-[#636369]">Esse post ainda não tem copy escrita. Rode a skill de copy completa pra ele.</span>}
          {copy && temCopy && (
            <div className={`grid items-start gap-3.5 ${esquerda.length && temLegenda ? 'xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]' : ''}`}>
              {esquerda.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {esquerda.map((k) => (
                    <div key={k} className="flex flex-col gap-2.5">
                      <span className={EB}>{ROT_ABA[k]}</span>
                      <CampoEmTakes campo={k} texto={copy[k] ?? ''} podeFeedback={podeFeedback} fb={fb} />
                    </div>
                  ))}
                </div>
              )}
              {temLegenda && (
                <div className="flex flex-col gap-2.5 xl:sticky xl:top-4">
                  {!esquerda.length && <span className={EB}>Legenda</span>}
                  <CampoEmTakes campo="legenda" texto={copy.legenda ?? ''} podeFeedback={podeFeedback} fb={fb} comTitulo={esquerda.length > 0} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* coluna de ações */}
        <div className="flex w-full flex-none flex-col gap-3 lg:sticky lg:top-4 lg:w-[300px]">
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-[#E9E9EB] bg-white p-4">
            <span className={EB}>Sobre o post</span>
            <span className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="text-[#636369]">Formato</span>
              {info ? <SeletorFormato postId={card.postId} atual={info.formato} onMudou={recarregar} /> : <b>…</b>}
            </span>
            <span className="text-[12px]">
              <span className="text-[#636369]">Prazo da copy</span> <b>{card.prazo ? (card.prazo === hoje ? 'hoje' : ddmm(card.prazo)) : 'sem data'}</b>
            </span>
            <details className="group text-[12px] text-[#636369]">
              <summary className="cursor-pointer list-none hover:text-[#111113] [&::-webkit-details-marker]:hidden">
                Ideia e briefing <span className="inline-block transition group-open:rotate-90">▸</span>
              </summary>
              <div className="mt-2 flex max-h-[320px] flex-col gap-2 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-[1.5] text-[#111113]">
                <b className="text-[11px] uppercase tracking-[0.06em] text-[#636369]">Ideia</b>
                {info?.ideia || <span className="text-[#8A8A90]">não preenchido</span>}
                <b className="mt-1 text-[11px] uppercase tracking-[0.06em] text-[#636369]">Briefing</b>
                {info?.briefing || <span className="text-[#8A8A90]">não preenchido</span>}
              </div>
            </details>
            {info && <SkillsUsadas skills={info.skills} />}
          </div>

          {podeFeedback && temCopy && (
            <div className="flex flex-col gap-2.5 rounded-[18px] border border-[#E9E9EB] bg-white p-4">
              <span className={EB}>Feedback do post inteiro</span>
              <textarea
                value={comPost}
                onChange={(e) => setComPost(e.target.value)}
                placeholder={`Vale pra ${campos.map((k) => ROT_ABA[k].toLowerCase()).join(' e ')}…`}
                className="h-[90px] w-full resize-y rounded-[10px] border border-[#D6D6D9] px-2.5 py-2 text-[13px] outline-none placeholder:text-[#A1A1A8] focus:border-[#111113]"
              />
              {comPost.trim().length >= 2 && (
                <button type="button" disabled={!!fb.enviando} onClick={async () => (await fb.enviar('post', null, { texto: comPost })) && setComPost('')} className={`${BTN_P} !py-2 !text-[13px]`}>
                  {fb.enviando?.startsWith('post') ? 'Ajustando o post…' : 'Enviar e ajustar'}
                </button>
              )}
            </div>
          )}

          {revisavel(card) && (
            <button type="button" onClick={aprovar} disabled={aprovando} className={`${BTN_V} !py-3`}>
              {aprovando ? 'Aprovando…' : '✓ Aprovar copy'}
            </button>
          )}
          <Aviso m={msgAprovar} />
          {podeFeedback && temCopy && <span className="text-center text-[12px] text-[#636369]">Clique em qualquer parte da copy pra editar ali mesmo ou comentar o ajuste.</span>}
        </div>
      </div>
    </div>
  );
}
