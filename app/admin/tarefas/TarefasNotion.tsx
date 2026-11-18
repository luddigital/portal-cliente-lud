'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rotas } from '@/lib/rotas';
import { corDaEtapa } from '@/lib/corEtapa';
import { quandoComEmoji } from '../entregas/[id]/EntregaSemanas';
import { BotaoLembreteWpp } from '../aprovacoes/BotaoLembreteWpp';
import { MenuPropriedades, NOME_COLUNA, usePropriedades, type Coluna } from '../_ui/Propriedades';
import { AvatarPessoa as AvatarPadrao, AvatarProjeto, Sinal } from '../_ui/Avatares';
import { PreviaPostModal, prefetchPrevia } from '../aprovacoes/PreviaPostModal';

/**
 * Tarefas no jeito da "Gestão de Projetos" do Notion: abas Atrasadas, Hoje,
 * Esperando, Amanhã e Próximos dias; dentro de cada uma, um bloco por pessoa.
 */

export type LinhaTarefa = {
  id: string;
  titulo: string;
  pessoa: string | null;
  pessoaAvatar: string | null;
  prazo: string | null;
  status: string | null;
  pronto: boolean;
  postId: string | null;
  postTitulo: string | null;
  projetoId: string | null;
  projeto: string | null;
  projetoFoto: string | null;
  etapaPost: string | null;
  doCliente: boolean;
  /** Tarefa do cliente: mensagens no grupo nesse ciclo (null = tarefa da equipe). */
  wpp: { n: number; ultimo: string | null } | null;
  visto: string | null;
  /** Envios no grupo e visualizações do cliente, na ordem (linha do tempo do sinal). */
  tempo?: { q: string; t: 'envio' | 'visto'; m: string }[];
  antes: { titulo: string; pessoa: string | null; avatar: string | null; prazo: string | null } | null;
};

type Aba = 'atr' | 'hoje' | 'amanha' | 'proximos' | 'inbox';

const ABAS: { id: Aba; rot: string; dica: string }[] = [
  { id: 'atr', rot: '⚠️ Atrasadas', dica: 'Prazo já passou e a tarefa segue aberta.' },
  { id: 'hoje', rot: '☀️ Hoje', dica: 'Vencem hoje. As que dependem de outra etapa ficam no fim, com 🔒.' },
  { id: 'amanha', rot: '⏭ Amanhã', dica: 'Vencem amanhã.' },
  { id: 'proximos', rot: '📅 Próximos 7 dias', dica: 'Vencem depois de amanhã, até uma semana.' },
  { id: 'inbox', rot: '📥 Inbox', dica: 'Tarefas soltas, sem data ou na caixa de entrada.' },
];

const soma = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
// Botões da coluna Ação: todos do mesmo tamanho, alinhados à direita.
/** Concluir: verde, pra ficar claro que é o botão de terminar a tarefa. */
const BOTAO_CONCLUIR = 'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#2E7D4F] bg-[#2E7D4F] px-3 py-[3px] text-[11.5px] font-bold text-white hover:bg-[#256A42]';
const BOTAO = 'inline-flex w-[136px] items-center justify-center whitespace-nowrap rounded-full border border-[#D6D6D9] bg-white py-[5px] text-[12px] font-bold text-[#111113] hover:bg-[#F4F4F5]';

export function TarefasNotion({ tarefas, hoje, pessoaInicial }: { tarefas: LinhaTarefa[]; hoje: string; pessoaInicial?: string }) {
  const router = useRouter();
  const amanha = soma(hoje, 1);
  const fimSemana = soma(hoje, 7);
  const [feitas, setFeitas] = useState<Record<string, true>>({});
  const [tempoAberto, setTempoAberto] = useState<Record<string, boolean>>({});
  const [paraHoje, setParaHoje] = useState<Record<string, true>>({});
  const [pessoa, setPessoa] = useState<string>(pessoaInicial || 'todas');
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string } | null>(null);
  const props_ = usePropriedades('tarefas-v2', ['data', 'tarefa', 'status', 'post', 'projeto', 'pessoa', 'sinal', 'acao']);

  const abaDe = (t: LinhaTarefa): Aba | null => {
    if (t.status === 'Inbox' || !t.prazo) return 'inbox';
    const p = paraHoje[t.id] ? hoje : t.prazo;
    if (p < hoje) return 'atr';
    if (p === hoje) return 'hoje';
    if (p === amanha) return 'amanha';
    if (p <= fimSemana) return 'proximos';
    return null;
  };

  const visiveis = tarefas.filter((t) => !feitas[t.id] && (pessoa === 'todas' || (t.pessoa ?? 'Sem responsável') === pessoa));
  const porAba = useMemo(() => {
    const m: Record<Aba, LinhaTarefa[]> = { atr: [], hoje: [], amanha: [], proximos: [], inbox: [] };
    for (const t of visiveis) {
      const a = abaDe(t);
      if (a) m[a].push(t);
    }
    return m;
  }, [visiveis, paraHoje]); // eslint-disable-line react-hooks/exhaustive-deps

  const [aba, setAba] = useState<Aba>(() => (porAba.atr.length ? 'atr' : 'hoje'));
  // Abas de um dia só (Hoje, Amanhã): a data já está na aba, não repete na coluna.
  // Status vem antes do nome da tarefa (o que importa primeiro é se dá pra começar).
  const colunas = props_.colunas
    .filter((c) => !(c === 'data' && (aba === 'hoje' || aba === 'amanha')))
    .sort((a, b) => (a === 'status' && b === 'tarefa' ? -1 : a === 'tarefa' && b === 'status' ? 1 : 0));
  const lista = porAba[aba];

  // Um bloco por pessoa (Sem responsável no fim).
  const grupos = useMemo(() => {
    const m = new Map<string, LinhaTarefa[]>();
    for (const t of lista) {
      const k = t.pessoa ?? 'Sem responsável';
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.entries()]
      .map(([k, ls]) => [k, ls.sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '') || a.titulo.localeCompare(b.titulo))] as const)
      .sort((a, b) => (a[0] === 'Sem responsável' ? 1 : b[0] === 'Sem responsável' ? -1 : b[1].length - a[1].length));
  }, [lista]);

  const pessoas = useMemo(() => {
    const m = new Map<string, { n: number; foto: string | null }>();
    for (const t of tarefas) {
      if (feitas[t.id] || !abaDe(t)) continue;
      const k = t.pessoa ?? 'Sem responsável';
      m.set(k, { n: (m.get(k)?.n ?? 0) + 1, foto: m.get(k)?.foto ?? t.pessoaAvatar });
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [tarefas, feitas, paraHoje]); // eslint-disable-line react-hooks/exhaustive-deps

  async function concluir(t: LinhaTarefa) {
    setFeitas((f) => ({ ...f, [t.id]: true }));
    const r = await fetch(`/api/tarefas/${t.id}/concluir`, { method: 'POST' }).catch(() => null);
    if (!r?.ok) {
      setFeitas((f) => {
        const n = { ...f };
        delete n[t.id];
        return n;
      });
      return;
    }
    router.refresh();
  }
  async function fazerHoje(t: LinhaTarefa) {
    setParaHoje((f) => ({ ...f, [t.id]: true }));
    const r = await fetch(`/api/admin/tarefas/${t.id}/prazo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prazo: hoje }),
    }).catch(() => null);
    if (!r?.ok)
      setParaHoje((f) => {
        const n = { ...f };
        delete n[t.id];
        return n;
      });
  }

  const LARG: Partial<Record<Coluna, string>> = { data: 'w-[76px]', tarefa: 'w-[290px]', status: 'w-[210px]', projeto: 'w-[68px] text-center', pessoa: 'w-[60px] text-center', sinal: 'w-[92px]', acao: 'w-[160px]' };
  const celula = (c: Coluna, t: LinhaTarefa) => {
    switch (c) {
      case 'data': {
        if (!t.prazo) return <span className="text-[#A1A1A8]">—</span>;
        const d = paraHoje[t.id] ? hoje : t.prazo.slice(0, 10);
        return (
          <span className="whitespace-nowrap text-[12.5px] font-semibold tabular-nums" style={{ color: d < hoje ? 'var(--prazo-atrasado)' : d === hoje ? '#8A3B0E' : '#46464B' }}>
            {d === hoje ? 'hoje' : Date.parse(`${d}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`) === 86_400_000 ? 'amanhã' : ddmm(d)}
          </span>
        );
      }
      case 'tarefa':
        // Igual ao Notion: o nome da tarefa em texto. Travada fica em cinza.
        return (
          <Link href={rotas.tarefa(t.id)} title={t.titulo} className={`block text-[13.5px] leading-[1.35] hover:underline ${t.antes ? 'font-medium text-[#A1A1A8]' : 'font-semibold text-[#111113]'}`}>
            {t.titulo}
          </Link>
        );
      case 'status':
        // Travada: a etapa em que o post está. Pronta: só "Iniciar" em verde, sem repetir o nome da tarefa.
        if (t.antes) return <Pilula titulo={t.antes.titulo} />;
        if (t.doCliente)
          return <span className="inline-flex whitespace-nowrap rounded-full bg-[#E3ECF7] px-2.5 py-[3px] text-[12px] font-bold text-[#24466B]">Com o cliente</span>;
        return <span className="inline-flex whitespace-nowrap rounded-full bg-[#D8EDCF] px-2.5 py-[3px] text-[12px] font-bold text-[#2E5520]">Iniciar</span>;
      case 'sinal':
        return (
          <span className="flex items-center gap-1.5">
            <Sinal itens={sinalDaTarefa(t, hoje)} />
            {!t.antes && (t.tempo?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setTempoAberto((o) => ({ ...o, [t.id]: !o[t.id] }))}
                title="Linha do tempo"
                aria-expanded={!!tempoAberto[t.id]}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] text-[#8A8A90] hover:bg-[#F0F0F1] hover:text-[#111113]"
              >
                <span className={`transition-transform ${tempoAberto[t.id] ? 'rotate-90' : ''}`}>▶</span>
              </button>
            )}
          </span>
        );
      case 'post':
        return t.postId ? (
          <button
            type="button"
            onMouseEnter={() => prefetchPrevia(t.postId)}
            onClick={() => t.postId && setPrevia({ postId: t.postId, tarefaId: t.id })}
            title={t.postTitulo ?? 'Post'}
            className="block w-full truncate text-left text-[13px] text-[#2C2C30] underline decoration-[#D6D6D9] underline-offset-[3px] hover:text-[#111113]"
          >
            {t.postTitulo ?? 'Post'}
          </button>
        ) : (
          <span className="text-[#A1A1A8]">—</span>
        );
      case 'projeto':
        return t.projeto && t.projetoId ? (
          <Link href={rotas.projeto(t.projetoId)} aria-label={t.projeto} className="flex justify-center hover:opacity-80">
            <AvatarProjeto handle={t.projeto} foto={t.projetoFoto} />
          </Link>
        ) : (
          <span className="text-[#A1A1A8]">—</span>
        );
      case 'pessoa': {
        // Resp.: quem está com o post agora (na travada, quem está segurando; com o cliente, o cliente).
        const nome = t.antes ? t.antes.pessoa : t.pessoa;
        const foto = t.antes ? t.antes.avatar : t.pessoaAvatar;
        return (
          <span className="flex justify-center">
            {nome ? <AvatarPadrao nome={nome} foto={foto ?? (t.doCliente ? t.projetoFoto : null)} titulo={`Com ${nome}`} /> : <span className="text-[#A1A1A8]">—</span>}
          </span>
        );
      }
      case 'acao':
        if (t.antes) return null;
        if (aba === 'atr' && !paraHoje[t.id])
          return (
            <button type="button" onClick={() => fazerHoje(t)} className={BOTAO} title="Muda o prazo pra hoje">
              Fazer hoje
            </button>
          );
        if (t.doCliente)
          return t.postId && /aprova/i.test(t.titulo) ? (
            <span className="inline-flex justify-end">
              <BotaoLembreteWpp tarefaId={t.id} clienteNome={t.projeto ?? 'cliente'} rotulo="Lembrar no grupo" compacto />
            </span>
          ) : null;
        return (
          <button type="button" onClick={() => concluir(t)} className={BOTAO_CONCLUIR}>
            ✓ Concluir
          </button>
        );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
      {/* Pessoas: escondido num menu */}
      <details className="relative w-fit">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-[#E2E2E5] bg-white px-3 py-1 text-[12.5px] font-semibold text-[#46464B] hover:bg-[#F4F4F5] [&::-webkit-details-marker]:hidden">
          👤 {pessoa === 'todas' ? 'Todo mundo' : pessoa.split(' ')[0]} <span className="text-[10px] text-[#8A8A90]">▾</span>
        </summary>
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 flex max-h-[320px] w-[220px] flex-col overflow-y-auto rounded-[12px] border border-[#E9E9EB] bg-white p-1 shadow-[0_8px_24px_rgba(17,17,19,0.12)]">
          {[['todas', { n: 0, foto: null }] as const, ...pessoas].map(([nome, { n, foto }]) => (
            <button
              key={nome}
              type="button"
              onClick={(e) => {
                setPessoa(nome);
                (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
              }}
              className={`flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] hover:bg-[#F4F4F5] ${pessoa === nome ? 'font-bold' : ''}`}
            >
              {nome === 'todas' ? <span className="w-4 text-center">👥</span> : <Avatar nome={nome} foto={foto} />}
              <span className="flex-1 truncate">{nome === 'todas' ? 'Todo mundo' : nome}</span>
              {nome !== 'todas' && <span className="text-[11.5px] text-[#8A8A90]">{n}</span>}
              {pessoa === nome && <span className="text-[12px]">✓</span>}
            </button>
          ))}
        </div>
      </details>

      <MenuPropriedades disponiveis={['data', 'tarefa', 'status', 'post', 'projeto', 'pessoa', 'sinal', 'acao']} {...props_} />
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1 border-b border-[#EDEDEF]">
        {ABAS.map((a) => {
          const n = porAba[a.id].length;
          const sel = aba === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              title={a.dica}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13.5px] ${sel ? 'border-[#111113] font-bold text-[#111113]' : 'border-transparent text-[#636369] hover:text-[#111113]'}`}
            >
              {a.rot}
              <span className={`rounded-full px-1.5 text-[11.5px] ${a.id === 'atr' && n ? 'bg-[var(--prazo-atrasado)] font-bold text-white' : 'bg-[#F0F0F1] text-[#636369]'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-[14px] border border-[#EDEDEF] bg-white px-5 py-10 text-center text-[13px] text-[#8A8A90]">Nada por aqui. 🎉</div>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map(([nome, ls]) => (
            <details key={nome} open className="group">
              <summary className="mb-1.5 flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <span className="text-[10px] text-[#8A8A90] transition-transform group-open:rotate-90">▶</span>
                <Avatar nome={nome} foto={ls[0].pessoaAvatar} grande />
                <b className="text-[14.5px]">{nome}</b>
                <span className="text-[12.5px] text-[#8A8A90]">{ls.length}</span>
              </summary>
              <div className="overflow-x-auto rounded-[12px] border border-[#EDEDEF] bg-white">
                <table className="w-full min-w-[960px] table-fixed border-collapse">
                  <thead>
                    <tr className="border-b border-[#EDEDEF]">
                      <th className="w-[44px]" />
                      {colunas.map((c) => (
                        <th key={c} className={`whitespace-nowrap px-3 py-2 text-left text-[12px] font-semibold text-[#8A8A90] ${LARG[c] ?? ''}`}>
                          {c === 'acao' ? '' : NOME_COLUNA[c]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ls.filter((t) => !t.antes).map((t) => [
                      <tr key={t.id} className="border-b border-[#F2F2F4] last:border-0 hover:bg-[#FAFAFA]">
                        <td className="py-2 pl-3">
                          <button
                            type="button"
                            onClick={() => concluir(t)}
                            title="Concluir"
                            aria-label={`Concluir ${t.titulo}`}
                            className="flex h-[20px] w-[20px] items-center justify-center rounded-full border-[1.5px] border-[#B9B9BE] text-[11px] font-extrabold text-transparent hover:border-[#2E5520] hover:text-[#2E5520]"
                          >
                            ✓
                          </button>
                        </td>
                        {colunas.map((c) => (
                          <td key={c} className={`px-3 py-2.5 ${c === 'acao' ? 'text-right' : ''}`}>
                            {celula(c, t)}
                          </td>
                        ))}
                      </tr>,
                      tempoAberto[t.id] && t.tempo?.length ? (
                        <tr key={`${t.id}-tempo`} className="border-b border-[#F2F2F4] bg-[#FAFAFB]">
                          <td />
                          <td colSpan={colunas.length} className="px-3 py-3">
                            <LinhaDoTempo tempo={t.tempo} aprovacao={/aprova/i.test(t.titulo)} />
                          </td>
                        </tr>
                      ) : null,
                    ])}
                    {ls.filter((t) => t.antes).map((t) => (
                      <tr key={t.id} className="border-b border-[#F2F2F4] bg-[#FCFCFC] last:border-0">
                        <td className="py-2 pl-3" title="Ainda não dá pra concluir: falta a etapa anterior">
                          <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border-[1.5px] border-dashed border-[#D6D6D9] text-[9px]" aria-hidden="true">
                            🔒
                          </span>
                        </td>
                        {colunas.map((c) => (
                          <td key={c} className={`px-3 py-2.5 ${c === 'acao' ? 'text-right' : ''}`}>
                            {celula(c, t)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
      {previa && <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />}
    </div>
  );
}

function Avatar({ nome, foto, grande = false }: { nome: string; foto: string | null; grande?: boolean }) {
  // Mesmo avatar do resto do portal (foto ou inicial em pastel), só no tamanho pequeno.
  return <AvatarPadrao nome={nome} foto={foto} tamanho={grande ? 24 : 16} />;
}

function rotuloMomento(m: string): string {
  if (m === 'quinta') return 'Envio de quinta';
  if (m === 'separado' || m === 'avulso') return 'Envio avulso';
  if (m === 'reaprovacao') return 'Reaprovação';
  if (m === 'geral') return 'Mensagem da entrega';
  if (m.startsWith('auto_') || m.startsWith('envio_auto')) return 'Lembrete automático';
  if (['sexta', 'segunda_manha', 'segunda_tarde', 'terca'].includes(m)) return 'Lembrete';
  return 'Mensagem no grupo';
}

/** Linha do tempo: o que mandamos e quando o cliente abriu, na ordem. No fim, se ainda não viu o último envio. */
function LinhaDoTempo({ tempo, aprovacao }: { tempo: NonNullable<LinhaTarefa['tempo']>; aprovacao: boolean }) {
  const ultimo = tempo[tempo.length - 1];
  const falta = aprovacao && ultimo?.t === 'envio';
  const itens = [
    ...tempo.map((e) =>
      e.t === 'envio'
        ? { icone: '📤', rot: rotuloMomento(e.m), q: quandoMsg(e.q), bg: '#E4EBDF', fg: '#2E5520', borda: 'solid' }
        : { icone: '👁', rot: 'Cliente viu', q: quandoMsg(e.q), bg: '#E3ECF7', fg: '#24466B', borda: 'solid' },
    ),
    ...(falta ? [{ icone: '👁', rot: 'Ainda não viu', q: 'esperando o cliente', bg: '#FFFFFF', fg: '#8A8A90', borda: 'dashed' }] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {itens.map((it, k) => (
        <span key={k} className="flex items-center">
          {k > 0 && <span className="mx-1.5 h-[2px] w-5 shrink-0 bg-[#E2E2E5]" />}
          <span className="flex items-center gap-2 rounded-full px-2.5 py-1" style={{ background: it.bg, color: it.fg, border: `1.5px ${it.borda} ${it.borda === 'dashed' ? '#D6D6D9' : 'transparent'}` }}>
            <span className="text-[12px]">{it.icone}</span>
            <span className="text-[12px] font-bold">{it.rot}</span>
            <span className="text-[11.5px] font-medium opacity-80">{it.q}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

const quandoMsg = (iso: string) => {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d).replace(':', 'h');
  return `${dia} ${hora}`;
};

/** Pílula colorida da etapa (cores e nome iguais ao Notion). */
function Pilula({ titulo }: { titulo: string }) {
  const c = corDaEtapa(titulo);
  return (
    <span title={titulo} className="inline-block max-w-full truncate whitespace-nowrap rounded-full px-2.5 py-[3px] align-middle text-[11.5px] font-bold" style={{ background: c.bg, color: c.fg }}>
      {titulo}
    </span>
  );
}

// Linha de status em bolinhas, sem texto: a cor diz o que é (detalhe ao passar o mouse).
const COR_BOLINHA = {
  ok: { bg: '#E4EBDF', fg: '#2E5520', linha: '#9BCB8A' },
  atr: { bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)', linha: '#F2B8B0' },
  off: { bg: '#F0F0F1', fg: '#8A8A90', linha: '#E2E2E5' },
};
type Bolinha = { icone: React.ReactNode; dica: string; st: keyof typeof COR_BOLINHA };

function Bolinhas({ itens }: { itens: Bolinha[] }) {
  return (
    <span className="flex items-center">
      {itens.map((b, k) => {
        const c = COR_BOLINHA[b.st];
        return (
          <span key={k} className="flex items-center">
            {k > 0 && <span className="h-[2px] w-3 shrink-0" style={{ background: c.linha }} />}
            {typeof b.icone === 'string' ? (
              <span title={b.dica} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: c.bg, color: c.fg }}>
                {b.icone}
              </span>
            ) : (
              <span title={b.dica} className="flex h-7 w-7 shrink-0 items-center justify-center">
                {b.icone}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function FotoPessoa({ nome, foto }: { nome: string; foto: string | null }) {
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" className="h-7 w-7 rounded-full object-cover" />
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111113] text-[11px] font-extrabold text-white">{nome.trim().charAt(0).toUpperCase()}</span>
  );
}

/**
 * Sinal da tarefa (só cores): travada → 🚨 se quem segura passou do prazo;
 * com o cliente → 📤 enviado no grupo (verde) ou não (vermelho) · 👁 viu (verde) ou não (cinza).
 */
function sinalDaTarefa(t: LinhaTarefa, hoje: string): import('../_ui/Avatares').Bolinha[] {
  if (t.antes) {
    if (!t.antes.prazo || t.antes.prazo >= hoje) return [];
    const n = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${t.antes.prazo.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
    return [
      {
        icone: '🚨',
        dica: `Atrasada desde ${ddmm(t.antes.prazo)}`,
        st: 'atr',
        linhas: [`${t.antes.titulo}${t.antes.pessoa ? ` com ${t.antes.pessoa}` : ''}`, `${n} ${n === 1 ? 'dia' : 'dias'} de atraso`],
      },
    ];
  }
  if (!t.wpp) return [];
  const b: import('../_ui/Avatares').Bolinha[] = [
    t.wpp.n
      ? {
          icone: '📤',
          dica: `Enviado no grupo${t.wpp.n > 1 ? ` · ${t.wpp.n} mensagens` : ''}`,
          st: 'ok',
          linhas: t.wpp.ultimo ? [`Última: ${quandoMsg(t.wpp.ultimo)}`] : [],
        }
      : { icone: '📤', dica: 'Ainda não foi pro grupo', st: 'atr' },
  ];
  if (/aprova/i.test(t.titulo))
    // O visto só vale se for DEPOIS do último envio: senão o cliente ainda não viu o que mandamos agora.
    b.push(
      !t.visto
        ? { icone: '👁', dica: 'Cliente ainda não abriu o post', st: 'off' }
        : t.wpp.ultimo && Date.parse(t.visto) < Date.parse(t.wpp.ultimo)
          ? { icone: '👁', dica: `Ainda não viu o envio de ${quandoMsg(t.wpp.ultimo)}`, st: 'off', linhas: [`Viu antes, ${quandoMsg(t.visto)}`] }
          : { icone: '👁', dica: 'Cliente viu o post', st: 'ok', linhas: [`Última vez ${quandoMsg(t.visto)}`] },
    );
  return b;
}
