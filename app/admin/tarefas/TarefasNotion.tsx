'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rotas } from '@/lib/rotas';
import { corDaEtapa } from '@/lib/corEtapa';
import { quandoComEmoji } from '../entregas/[id]/EntregaSemanas';
import { BotaoLembreteWpp } from '../aprovacoes/BotaoLembreteWpp';
import { MenuPropriedades, NOME_COLUNA, usePropriedades, type Coluna } from '../_ui/Propriedades';
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
const BOTAO = 'inline-flex w-[136px] items-center justify-center whitespace-nowrap rounded-full border border-[#D6D6D9] bg-white py-[5px] text-[12px] font-bold text-[#111113] hover:bg-[#F4F4F5]';

export function TarefasNotion({ tarefas, hoje, pessoaInicial }: { tarefas: LinhaTarefa[]; hoje: string; pessoaInicial?: string }) {
  const router = useRouter();
  const amanha = soma(hoje, 1);
  const fimSemana = soma(hoje, 7);
  const [feitas, setFeitas] = useState<Record<string, true>>({});
  const [paraHoje, setParaHoje] = useState<Record<string, true>>({});
  const [pessoa, setPessoa] = useState<string>(pessoaInicial || 'todas');
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string } | null>(null);
  const props_ = usePropriedades('tarefas', ['data', 'tarefa', 'post', 'projeto', 'status', 'acao']);

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
  const colunas = props_.colunas.filter((c) => !(c === 'data' && (aba === 'hoje' || aba === 'amanha')));
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

  const LARG: Partial<Record<Coluna, string>> = { data: 'w-[96px]', tarefa: 'w-[270px]', status: 'w-[400px]', projeto: 'w-[72px]', pessoa: 'w-[130px]', acao: 'w-[160px]' };
  const celula = (c: Coluna, t: LinhaTarefa) => {
    switch (c) {
      case 'data': {
        if (!t.prazo) return <span className="text-[#A1A1A8]">—</span>;
        const q = quandoComEmoji(paraHoje[t.id] ? hoje : t.prazo, hoje);
        return (
          <span className="whitespace-nowrap text-[12.5px] font-semibold tabular-nums" style={{ color: q.cor }}>
            {q.texto}
          </span>
        );
      }
      case 'tarefa':
        // Igual ao Notion: o nome da tarefa em texto. Travada fica em cinza.
        return (
          <Link href={rotas.tarefa(t.id)} className={`block truncate text-[13.5px] hover:underline ${t.antes ? 'font-medium text-[#A1A1A8]' : 'font-semibold text-[#111113]'}`}>
            {t.titulo}
          </Link>
        );
      case 'status':
        return <StatusDaTarefa t={t} hoje={hoje} />;
      case 'post':
        return t.postId ? (
          <button
            type="button"
            onMouseEnter={() => prefetchPrevia(t.postId)}
            onClick={() => t.postId && setPrevia({ postId: t.postId, tarefaId: t.id })}
            className="text-left text-[13px] text-[#2C2C30] underline decoration-[#D6D6D9] underline-offset-[3px] hover:text-[#111113]"
          >
            {t.postTitulo ?? 'Post'}
          </button>
        ) : (
          <span className="text-[#A1A1A8]">—</span>
        );
      case 'projeto':
        return t.projeto && t.projetoId ? (
          <Link href={rotas.projeto(t.projetoId)} title={t.projeto} aria-label={t.projeto} className="inline-flex hover:opacity-80">
            {t.projetoFoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.projetoFoto} alt="" className="h-7 w-7 rounded-full border border-[#E9E9EB] object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111113] text-[11px] font-bold text-white">{t.projeto.replace(/^@/, '')[0]?.toUpperCase()}</span>
            )}
          </Link>
        ) : (
          <span className="text-[#A1A1A8]">—</span>
        );
      case 'pessoa':
        return (
          <span className="flex items-center gap-1.5 text-[12.5px] text-[#46464B]">
            <Avatar nome={t.pessoa ?? '?'} foto={t.pessoaAvatar} />
            {(t.pessoa ?? '—').split(' ')[0]}
          </span>
        );
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
          <button type="button" onClick={() => concluir(t)} className={BOTAO}>
            Concluir
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

      <MenuPropriedades disponiveis={['data', 'tarefa', 'status', 'post', 'projeto', 'pessoa', 'acao']} {...props_} />
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
      <p className="-mt-2 text-[12.5px] text-[#8A8A90]">{ABAS.find((a) => a.id === aba)?.dica}</p>

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
                    {ls.filter((t) => !t.antes).map((t) => (
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
                      </tr>
                    ))}
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
  const t = grande ? 'h-6 w-6 text-[10px]' : 'h-4 w-4 text-[8px]';
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" className={`${t} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${t} flex shrink-0 items-center justify-center rounded-full bg-[#E9E9EB] font-bold text-[#46464B]`}>{nome[0]?.toUpperCase()}</span>
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
    <span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ background: c.bg, color: c.fg }}>
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
 * Status: a etapa em que o post está agora (colorida) e a linha de bolinhas.
 * Travada → quem está com o post (+ 🚨 vermelho se passou do prazo).
 * Com o cliente → 📤 enviado no grupo (verde) ou não (vermelho) · 👁 viu (verde) ou não (cinza).
 * Liberada → só a pílula.
 */
function StatusDaTarefa({ t, hoje }: { t: LinhaTarefa; hoje: string }) {
  let titulo = t.titulo;
  const itens: Bolinha[] = [];
  if (t.antes) {
    titulo = t.antes.titulo;
    if (t.antes.pessoa) itens.push({ icone: <FotoPessoa nome={t.antes.pessoa} foto={t.antes.avatar} />, dica: `Com ${t.antes.pessoa}`, st: 'ok' });
    if (t.antes.prazo && t.antes.prazo < hoje) itens.push({ icone: '🚨', dica: `Atrasada desde ${ddmm(t.antes.prazo)}`, st: 'atr' });
  } else if (t.wpp) {
    itens.push(
      t.wpp.n
        ? { icone: '📤', dica: `Enviado no grupo${t.wpp.n > 1 ? ` (${t.wpp.n}×)` : ''}${t.wpp.ultimo ? ` · ${quandoMsg(t.wpp.ultimo)}` : ''}`, st: 'ok' }
        : { icone: '📤', dica: 'Não enviado no grupo', st: 'atr' },
    );
    if (/aprova/i.test(t.titulo)) itens.push(t.visto ? { icone: '👁', dica: `Viu ${quandoMsg(t.visto)}`, st: 'ok' } : { icone: '👁', dica: 'Ainda não viu', st: 'off' });
  }
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Pilula titulo={titulo} />
      {itens.length > 0 && <Bolinhas itens={itens} />}
    </span>
  );
}
