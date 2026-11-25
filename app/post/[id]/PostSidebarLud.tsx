'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TarefaDoPost } from '@/lib/notion';
import { MiniCalendario } from '@/app/_components/MiniCalendario';
import { statusPrazo } from '@/lib/prazoStatus';
import { compararNoFluxo, ehTarefaDoCliente } from '@/lib/etapas-projeto';
import { BotaoLembreteWpp } from '@/app/admin/aprovacoes/BotaoLembreteWpp';
import type { MudancaPrazo, ProgramacaoConfig } from '@/lib/supabase';
import type { EnvioHistorico, NotaHistorico, TarefaClienteHistorico } from '@/lib/historico-post';

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

/** Cor da etapa (mesmas do calendário) pelo texto do Status Geral do Notion. */
function coresDaEtapa(etapa: string): { bg: string; fg: string } {
  const t = etapa.toLowerCase();
  const par = (n: string) => ({ bg: `var(--${n}-soft)`, fg: `var(--${n})` });
  if (/postado|publicado/.test(t)) return par('cal-publicado');
  if (/conferir/.test(t)) return par('cal-conferir');
  if (/programar|agendad/.test(t)) return par('cal-programar');
  if (/altera/.test(t)) return par('cal-alteracao');
  if (/aprova[çc][ãa]o\s*\|\s*(post|pauta)/.test(t)) return par('cal-aguardando');
  if (/aprova|enviar post/.test(t)) return par('cal-aprovacao');
  if (/materia|pr[ée]vi|conte[úu]do/.test(t)) return par('cal-aguardando');
  return par('cal-agendado');
}

export function StatusDoPostChips({
  postId,
  status,
  statusGeral = null,
  alinhar = 'direita',
  grande = false,
}: {
  postId: string;
  status: string | null;
  /** Etapa do post como no Notion ("Alteração | Arte"). Com ela, os chips de troca ficam recolhidos. */
  statusGeral?: string | null;
  alinhar?: 'esquerda' | 'direita';
  /** Cabeçalho do post: chips maiores, sem borda. */
  grande?: boolean;
}) {
  const router = useRouter();
  const atual = bucketDoStatus(status);
  const [loading, setLoading] = useState<StatusChip | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

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
      startTransition(() => router.refresh());
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setLoading(null);
    }
  }

  if (statusGeral && !trocando) {
    const cor = coresDaEtapa(statusGeral);
    return (
      <div className={`flex flex-col gap-1 ${alinhar === 'esquerda' ? 'items-start' : 'items-end'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`font-semibold uppercase text-t3 ${
              grande ? 'mr-1 text-[11px] tracking-[0.12em] lg:text-[10px]' : 'text-[10px] tracking-[0.1em]'
            }`}
          >
            Status
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
              grande ? 'px-4 py-1.5 text-[13.5px] lg:px-3 lg:py-1 lg:text-[12.5px]' : 'px-2.5 py-1 text-[11px]'
            }`}
            style={{ background: cor.bg, color: cor.fg }}
            title="Status Geral do Notion"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {statusGeral}
          </span>
          <button
            type="button"
            onClick={() => setTrocando(true)}
            className="text-[11px] font-semibold text-t3 underline-offset-2 transition hover:text-ink hover:underline"
          >
            trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${alinhar === 'esquerda' ? 'items-start' : 'items-end'}`}>
      <div className={`flex flex-wrap items-center gap-1.5 ${alinhar === 'esquerda' ? 'justify-start' : 'justify-end'}`}>
        <span
          className={`mr-1 font-semibold uppercase text-t3 ${
            grande ? 'mr-3 text-[11px] tracking-[0.12em] lg:mr-1 lg:text-[10px]' : 'text-[10px] tracking-[0.1em]'
          }`}
        >
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
              className={`rounded-full border font-semibold transition disabled:cursor-not-allowed ${
                grande ? 'px-4 py-1.5 text-[13.5px] lg:px-3 lg:py-1 lg:text-[12px]' : 'px-2.5 py-1 text-[11px]'
              } ${
                selecionado
                  ? 'text-white'
                  : grande
                    ? 'border-transparent bg-bgSoft text-t2 hover:text-ink disabled:opacity-40'
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
        {statusGeral && (
          <button
            type="button"
            onClick={() => setTrocando(false)}
            className="ml-1 text-[11px] font-semibold text-t3 transition hover:text-ink"
          >
            fechar
          </button>
        )}
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
// Tarefas — data de entrega · prazo · tarefa · responsável · cliente/interno · check
// ============================================================================

function ddmmCurto(iso: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}`;
}

function hojeLocal(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

function prazoRelativo(iso: string | null): { texto: string; atrasada: boolean } {
  if (!iso) return { texto: 'sem prazo', atrasada: false };
  const d = (s: string) => {
    const [y, m, dd] = s.split('T')[0].split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  const dias = Math.round((d(iso) - d(hojeLocal())) / 86_400_000);
  if (dias < 0) return { texto: `atrasada ${Math.abs(dias)}d`, atrasada: true };
  if (dias === 0) return { texto: 'hoje', atrasada: false };
  if (dias === 1) return { texto: 'amanhã', atrasada: false };
  return { texto: `em ${dias}d`, atrasada: false };
}

function Avatar({ nome, url }: { nome: string | null; url: string | null }) {
  if (!nome) return <span className="h-6 w-6 shrink-0" />;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nome} title={nome} className="h-6 w-6 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      title={nome}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E9E9E7] text-[10px] font-semibold text-ink"
    >
      {nome.trim()[0]?.toUpperCase()}
    </span>
  );
}

function TagTipo({ doCliente }: { doCliente: boolean }) {
  return (
    <span
      className={`w-[58px] shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${
        doCliente ? 'bg-[var(--prazo-hoje-soft)] text-[var(--prazo-hoje)]' : 'bg-bgSoft text-t2'
      }`}
    >
      {doCliente ? 'Cliente' : 'Interno'}
    </span>
  );
}

/** Mesma ordem da view de tarefas do post no Notion (Ordem → Ordem (1)). */
const porOrdem = (a: TarefaDoPost, b: TarefaDoPost) => compararNoFluxo(a as any, b as any);

function fmtQuando(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}

/** Data da tarefa: clica pra trocar (Enter salva, Esc cancela). */
function PrazoEditavel({
  prazo,
  mudancas,
  onSalvar,
}: {
  prazo: string | null;
  mudancas: MudancaPrazo[];
  onSalvar: (novo: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [calAberto, setCalAberto] = useState(false);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ultima = mudancas[0];
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  // Fecha ao clicar fora / Esc.
  useEffect(() => {
    if (!editando) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setEditando(false);
        setCalAberto(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setEditando(false);
        setCalAberto(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [editando]);

  async function salvar() {
    if (!valor || valor === prazo) {
      setEditando(false);
      setCalAberto(false);
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(valor);
      setEditando(false);
      setCalAberto(false);
    } catch {
      /* erro aparece no card */
    } finally {
      setSalvando(false);
    }
  }

  const fmtChip = (iso: string) =>
    iso ? iso.split('-').reverse().join('/') : 'escolher data';

  if (editando) {
    return (
      <span ref={wrapRef} className="relative flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setCalAberto((v) => !v)}
          className="flex h-7 items-center gap-1.5 rounded-md border border-ink bg-white px-2 font-mono text-[11px] text-ink outline-none"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {fmtChip(valor)}
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-7 rounded-md bg-ink px-2 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {salvando ? '…' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setCalAberto(false);
          }}
          aria-label="Cancelar"
          className="h-7 px-1 text-[14px] text-t3 hover:text-ink"
        >
          ×
        </button>

        {calAberto && (
          <div className="absolute left-0 top-8 z-50">
            <MiniCalendario
              value={valor || null}
              onPick={(iso) => {
                setValor(iso);
                setCalAberto(false);
              }}
            />
          </div>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValor(prazo ?? hojeLocal());
        setEditando(true);
        setCalAberto(true);
      }}
      title={
        ultima
          ? `Prazo mudou ${mudancas.length}x · última: ${ddmmCurto(ultima.de)} → ${ddmmCurto(ultima.para)} (${ultima.por}, ${fmtQuando(ultima.em)}). Clique pra mudar.`
          : 'Clique pra mudar o prazo'
      }
      className="group inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11.5px] font-extrabold transition hover:brightness-95"
      style={(() => {
        const h = hojeLocal();
        const d = prazo?.slice(0, 10) ?? null;
        return !d
          ? { background: '#F4F4F5', color: '#636369' }
          : d < h
            ? { background: '#F6CFCB', color: '#7E211C' }
            : d === h
              ? { background: '#F8D5E5', color: '#7A1F4C' }
              : { background: '#F4F4F5', color: '#46464B' };
      })()}
    >
      {ddmmCurto(prazo)}
      {mudancas.length > 0 ? (
        <span className="text-[9px] text-[var(--cal-agendado)]">↺</span>
      ) : (
        <span className="text-[9px] text-t3 opacity-60 transition group-hover:opacity-100">✎</span>
      )}
    </button>
  );
}

function Responsavel({
  nome,
  url,
  colaboradorId,
}: {
  nome: string | null;
  url: string | null;
  colaboradorId: string | null;
}) {
  const conteudo = (
    <>
      <Avatar nome={nome} url={url} />
      <span className="truncate text-[11.5px]">{nome ? nome.split(' ')[0] : '—'}</span>
    </>
  );
  if (nome && colaboradorId) {
    return (
      <Link
        href={`/admin/equipe/${colaboradorId}`}
        title={`Abrir a página de ${nome}`}
        className="flex w-[96px] shrink-0 items-center gap-1.5 rounded-full py-0.5 pr-2 text-t2 transition hover:bg-bgSoft hover:text-ink hover:underline"
      >
        {conteudo}
      </Link>
    );
  }
  return <span className="flex w-[96px] shrink-0 items-center gap-1.5 text-t3">{conteudo}</span>;
}

export function TodasTarefasCard({
  tarefas: iniciais,
  colaboradores = {},
  historico,
  podeEditarPrazo = false,
  semMoldura = false,
  linkAdmin = false,
  compacto = false,
}: {
  /** Popup: botões de concluir pequenos (círculo, como checkbox). */
  compacto?: boolean;
  tarefas: TarefaDoPost[];
  /** Notion user id do responsável → id da página do colaborador. */
  colaboradores?: Record<string, string>;
  /** Mudanças de prazo; sem isso o card não mostra a seção de histórico. */
  historico?: MudancaPrazo[];
  podeEditarPrazo?: boolean;
  /** Dentro do popup: sem o card em volta. */
  semMoldura?: boolean;
  /** Admin: "abrir tarefa" vai pra página da tarefa (/admin/tarefas/[id]); senão a do cliente. */
  linkAdmin?: boolean;
}) {
  const router = useRouter();
  const [tarefas, setTarefas] = useState(iniciais);
  const [mudancas, setMudancas] = useState<MudancaPrazo[]>(historico ?? []);
  const [atualizando, iniciarAtualizacao] = useTransition();
  // Depois de concluir/mudar prazo a página recarrega os dados do servidor;
  // o card acompanha (o que foi marcado aqui segue na lista pro "desmarcar").
  useEffect(() => setTarefas(iniciais), [iniciais]);
  useEffect(() => {
    if (historico) setMudancas(historico);
  }, [historico]);
  const atualizarPagina = () => iniciarAtualizacao(() => router.refresh());
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);
  // Concluídas aqui: guardam o status anterior pro "desmarcar".
  const [agora, setAgora] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Tarefa expandida: mostra o histórico dela + link pra tarefa completa.
  const [expandido, setExpandido] = useState<string | null>(null);

  const feita = (t: TarefaDoPost) => !t.aberta || !!t.finalizada;
  const abertas = tarefas.filter((t) => !feita(t) || t.tarefaId in agora).sort(porOrdem);
  const concluidas = tarefas.filter((t) => feita(t) && !(t.tarefaId in agora)).sort(porOrdem);
  // Só a equipe (rota de reabrir é de admin): setinha pra voltar uma concluída pra "Iniciar".
  const podeReabrir = linkAdmin;
  const atualId = abertas.find((t) => !feita(t))?.tarefaId ?? null;
  const total = tarefas.length;
  const nFeitas = tarefas.filter(feita).length;
  const pct = total > 0 ? Math.round((nFeitas / total) * 100) : 0;

  /** Tarefa concluída por engano: volta pra "Iniciar" no Notion. */
  async function reabrirConcluida(t: TarefaDoPost) {
    setSalvando(t.tarefaId);
    setErro(null);
    try {
      const res = await fetch(`/api/tarefas/${t.tarefaId}/reabrir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'Iniciar' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setTarefas((ts) => ts.map((x) => (x.tarefaId === t.tarefaId ? { ...x, aberta: true, finalizada: null, status: 'Iniciar' } : x)));
      atualizarPagina();
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui voltar a tarefa.');
    } finally {
      setSalvando(null);
    }
  }

  async function alternar(t: TarefaDoPost) {
    const desfazer = t.tarefaId in agora;
    setSalvando(t.tarefaId);
    setErro(null);
    try {
      const res = await fetch(`/api/tarefas/${t.tarefaId}/${desfazer ? 'reabrir' : 'concluir'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: desfazer ? JSON.stringify({ status: agora[t.tarefaId] }) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      const hoje = hojeLocal();
      setTarefas((ts) =>
        ts.map((x) =>
          x.tarefaId === t.tarefaId
            ? { ...x, aberta: desfazer, finalizada: desfazer ? null : hoje, status: desfazer ? agora[t.tarefaId] : 'Concluído' }
            : x,
        ),
      );
      setAgora((a) => {
        const n = { ...a };
        if (desfazer) delete n[t.tarefaId];
        else n[t.tarefaId] = t.status;
        return n;
      });
      // Status, prazo, "agora", card de alteração e histórico vêm do servidor.
      atualizarPagina();
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui salvar.');
    } finally {
      setSalvando(null);
    }
  }

  async function mudarPrazo(t: TarefaDoPost, novo: string) {
    setErro(null);
    try {
      const res = await fetch(`/api/admin/tarefas/${t.tarefaId}/prazo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prazo: novo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setTarefas((ts) => ts.map((x) => (x.tarefaId === t.tarefaId ? { ...x, prazo: novo } : x)));
      if (j.mudanca) setMudancas((m) => [j.mudanca as MudancaPrazo, ...m]);
      atualizarPagina();
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui mudar o prazo.');
      throw e;
    }
  }

  // Função (não componente) pra não remontar a linha a cada render.
  const linha = (t: TarefaDoPost, concluida: boolean) => {
    const marcada = feita(t);
    const podeMexer = !concluida;
    const doTarefa = mudancas.filter((m) => m.tarefaId === t.tarefaId);
    const aberto = expandido === t.tarefaId;
    const sp = statusPrazo({
      dataEntrega: t.prazo,
      status: t.status,
      finalizadaEm: t.finalizada,
      concluido: concluida || marcada,
    });
    return (
      <li key={t.tarefaId} className="py-1">
        <div className="flex items-center gap-2.5 py-1">
        {podeEditarPrazo && !concluida && !marcada ? (
          <PrazoEditavel prazo={t.prazo} mudancas={doTarefa} onSalvar={(novo) => mudarPrazo(t, novo)} />
        ) : (
          <span className="inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full bg-[#F4F4F5] px-2 text-[11.5px] font-extrabold text-[#8A8A90]">{ddmmCurto(t.prazo)}</span>
        )}
        <span
          className="flex w-[124px] shrink-0 items-center gap-1 truncate text-[11px] font-semibold"
          style={{ color: sp.cor }}
          title={
            sp.concluido && t.finalizada
              ? `${sp.label} · ${ddmmCurto(t.finalizada)}`
              : sp.label
          }
        >
          <span aria-hidden>{sp.emoji}</span>
          <span className="truncate">{sp.texto}</span>
        </span>
        <button
          type="button"
          onClick={() => setExpandido((id) => (id === t.tarefaId ? null : t.tarefaId))}
          title="Ver histórico da tarefa"
          className={`group/t flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] ${marcada ? 'text-t3 line-through' : 'text-ink'}`}
        >
          <span
            className={`shrink-0 text-[8px] text-t3 transition-transform ${aberto ? 'rotate-90' : ''}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="min-w-0 truncate group-hover/t:underline">{t.titulo}</span>
          {t.status === 'Reprovado' && <span className="shrink-0 text-[11px] text-t3">(reprovado)</span>}
          {t.tarefaId === atualId && (
            <span className="shrink-0 rounded-full bg-[var(--prazo-hoje-soft)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--prazo-hoje)]">
              agora
            </span>
          )}
        </button>
        <Responsavel
          nome={t.pessoaNome}
          url={t.pessoaAvatar}
          colaboradorId={t.pessoaId ? colaboradores[t.pessoaId] ?? null : null}
        />
        <TagTipo doCliente={ehTarefaDoCliente(t.titulo)} />
        <Link
          href={linkAdmin ? `/admin/tarefas/${t.tarefaId}` : `/tarefa/${t.tarefaId}`}
          title="Abrir tarefa completa"
          aria-label="Abrir tarefa completa"
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[13px] text-t3 transition hover:bg-bgSoft hover:text-ink"
        >
          ↗
        </Link>
        {concluida ? (
          <span className="flex w-[112px] shrink-0 items-center justify-end gap-1.5 whitespace-nowrap text-[12px] text-t3">
            ✓ feita{t.finalizada ? ` ${ddmmCurto(t.finalizada)}` : ''}
            {podeReabrir && (
              <button
                type="button"
                onClick={() => reabrirConcluida(t)}
                disabled={salvando === t.tarefaId}
                title="Voltar a tarefa pra Iniciar"
                aria-label={`Voltar ${t.titulo} pra Iniciar`}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#D6D6D9] bg-white text-[12px] font-extrabold text-[#46464B] hover:bg-[#F4F4F5] disabled:opacity-50"
              >
                {salvando === t.tarefaId ? '…' : '↺'}
              </button>
            )}
          </span>
        ) : marcada ? (
          <button
            type="button"
            onClick={() => alternar(t)}
            disabled={salvando === t.tarefaId}
            aria-label={`Desmarcar ${t.titulo}`}
            title="Desfazer"
            className={compacto ? 'inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-[#2E5520] text-[12px] font-extrabold text-white hover:opacity-80 disabled:opacity-50' : 'inline-flex h-[30px] min-w-[112px] shrink-0 items-center justify-center rounded-[10px] border border-[#D6D6D9] bg-white px-3 text-[12px] font-extrabold text-[#46464B] hover:bg-[#F4F4F5] disabled:opacity-50'}
          >
            {salvando === t.tarefaId ? '…' : compacto ? '✓' : '↺ Desfazer'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => alternar(t)}
            disabled={salvando === t.tarefaId}
            aria-label={`Concluir ${t.titulo}`}
            title="Concluir"
            className={compacto ? 'group/ok inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#B9B9BE] bg-white text-[12px] font-extrabold text-transparent hover:border-[#2E5520] hover:text-[#2E5520] disabled:opacity-50' : 'inline-flex h-[30px] min-w-[112px] shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[#2E7D4F] bg-white px-3 text-[12px] font-extrabold text-[#2E5520] hover:bg-[#F1F8EE] disabled:opacity-50'}
          >
            {salvando === t.tarefaId ? '…' : compacto ? '✓' : '✓ Concluir'}
          </button>
        )}
        </div>

        {aberto && (
          <div className="mb-1 ml-[70px] rounded-lg border border-[rgba(21,21,33,0.08)] bg-bgSoft/60 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-t3">
                Histórico da tarefa
              </span>
              <Link
                href={linkAdmin ? `/admin/tarefas/${t.tarefaId}` : `/tarefa/${t.tarefaId}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy transition hover:underline"
              >
                Abrir tarefa completa →
              </Link>
            </div>
            <ul className="mt-2 space-y-1 text-[11.5px] text-t2">
              {t.finalizada && <li>✓ Concluída em {ddmmCurto(t.finalizada)}</li>}
              {t.status && <li>Status atual: <b className="text-ink">{t.status}</b></li>}
              {doTarefa.length > 0 ? (
                doTarefa.map((m, i) => (
                  <li key={i}>
                    Prazo: {ddmmCurto(m.de)} →{' '}
                    <b className="text-ink">{ddmmCurto(m.para)}</b>
                    {m.por ? ` · ${m.por}` : ''} · {fmtQuando(m.em)}
                  </li>
                ))
              ) : (
                <li className="text-t3">
                  Prazo nunca mudou{t.prazo ? ` (${ddmmCurto(t.prazo)})` : ''}.
                </li>
              )}
            </ul>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className={semMoldura ? '' : 'card p-5'}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Tarefas
          {atualizando && <span className="text-[11px] font-normal text-t3">atualizando…</span>}
        </h2>
        {total > 0 && (
          <span className="font-mono text-[11px] text-t3">
            {nFeitas}/{total} concluídas
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-[12px] text-t3">Nenhuma tarefa relacionada a este post.</p>
      ) : (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bgSoft">
            <div className="h-full rounded-full bg-[var(--prazo-em-dia)] transition-all" style={{ width: `${pct}%` }} />
          </div>

          {abertas.length > 0 ? (
            (() => {
              const h = hojeLocal();
              const grupos: { rot: string; cor: string; ponto: string; lista: TarefaDoPost[] }[] = [
                { rot: 'Atrasadas', cor: '#7E211C', ponto: '#B42318', lista: abertas.filter((t) => t.prazo && t.prazo.slice(0, 10) < h) },
                { rot: 'Pra hoje', cor: '#7A1F4C', ponto: '#C2417E', lista: abertas.filter((t) => t.prazo?.slice(0, 10) === h) },
                { rot: 'Próximas', cor: '#46464B', ponto: '#B4B4B9', lista: abertas.filter((t) => !t.prazo || t.prazo.slice(0, 10) > h) },
              ];
              return grupos
                .filter((g) => g.lista.length > 0)
                .map((g) => (
                  <details key={g.rot} open className="group mt-3">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 pb-1 text-[11px] font-extrabold uppercase tracking-[0.08em] [&::-webkit-details-marker]:hidden" style={{ color: g.cor }}>
                      <span className="text-[9px] text-[#8A8A90] transition-transform group-open:rotate-90">▶</span>
                      <span className="h-2 w-2 rounded-full" style={{ background: g.ponto }} />
                      {g.rot} · {g.lista.length}
                    </summary>
                    <ul className="divide-y divide-[rgba(21,21,33,0.05)]">{g.lista.map((t) => linha(t, false))}</ul>
                  </details>
                ));
            })()
          ) : (
            <p className="mt-3 text-[12px] font-semibold text-[var(--prazo-em-dia)]">Tudo concluído ✨</p>
          )}
          {erro && (
            <p className="mt-2 rounded-md bg-[var(--prazo-atrasado-soft)] px-2 py-1 text-[11.5px] text-[var(--prazo-atrasado)]">
              {erro}
            </p>
          )}

          {concluidas.length > 0 && (
            <details className="group mt-3 border-t border-[rgba(21,21,33,0.06)] pt-3">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 pb-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#2E5520] [&::-webkit-details-marker]:hidden">
                <span className="text-[9px] text-[#8A8A90] transition-transform group-open:rotate-90">▶</span>
                <span className="h-2 w-2 rounded-full bg-[#2E7D4F]" />
                Concluídas · {concluidas.length}
              </summary>
              <ul className="divide-y divide-[rgba(21,21,33,0.05)]">{concluidas.map((t) => linha(t, true))}</ul>
            </details>
          )}

          {historico && (
            <div className="mt-3 border-t border-[rgba(21,21,33,0.06)] pt-3">
              {mudancas.length === 0 ? (
                <p className="text-[12px] text-t3">Nenhum prazo mudou por aqui ainda.</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setVerHistorico((v) => !v)}
                    className="text-[12px] font-semibold text-t2 transition hover:text-ink"
                  >
                    {verHistorico ? '▾' : '▸'} Histórico de prazos ({mudancas.length})
                  </button>
                  {verHistorico && (
                    <ul className="mt-1 divide-y divide-[rgba(21,21,33,0.05)]">
                      {mudancas.map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 py-2 text-[12px]">
                          <span className="w-[104px] shrink-0 text-t3">{fmtQuando(m.em)}</span>
                          <span className="min-w-0 flex-1 truncate text-ink">{m.tarefaTitulo ?? 'Tarefa'}</span>
                          <span className="shrink-0 font-mono text-[11px] text-t2">
                            {ddmmCurto(m.de)} → <span className="font-semibold text-ink">{ddmmCurto(m.para)}</span>
                          </span>
                          <span className="w-[64px] shrink-0 truncate text-right text-t3">{m.por}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
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
    <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Programação</h2>
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
        className="ml-auto rounded-full bg-[var(--cal-agendado)] px-4 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-95"
      >
        📅 Programar no Instagram
      </Link>
    </div>
  );
}

// ============================================================================
// Comunicação com o cliente — lembretes enviados + visualizações no portal
// ============================================================================

const MOMENTO_LABEL: Record<string, string> = {
  quinta: 'Envio pra aprovação (lote da semana)',
  separado: 'Envio pra aprovação (só este post)',
  sexta: 'Lembrete de sexta',
  segunda_manha: 'Último dia (manhã)',
  segunda_tarde: 'Último dia (tarde)',
  terca: 'Prazo vencido',
  avulso: 'Lembrete avulso',
  reaprovacao: 'Reaprovação (depois da alteração)',
  geral: 'Mensagem geral do projeto',
};

const VARIANTE_LABEL: Record<string, string> = {
  pendencias: 'pendências do cliente',
  viu: 'cliente tinha visto',
  nao_viu: 'cliente não tinha visto',
  no_prazo: 'no prazo',
  vence_amanha: 'vence amanhã',
  vence_hoje: 'vence hoje',
  vencido: 'prazo vencido',
  data_passou: 'data do post passou',
};

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type ComentarioCliente = {
  quando: string;
  tipo: 'comentou' | 'aprovou' | 'alteracao' | 'enviou';
  autor: string | null;
  trecho: string;
};

export type { NotaHistorico, TarefaClienteHistorico } from '@/lib/historico-post';

const ICONE_NOTA: Record<NotaHistorico['tipo'], string> = {
  interna: '🔒',
  cliente_comentou: '💬',
  cliente_aprovou: '✅',
  cliente_alteracao: '🔁',
  cliente_enviou: '📎',
  equipe: '📝',
  ok: '✓',
  voltou: '↺',
  enviado: '📱',
};

const DO_CLIENTE = new Set<NotaHistorico['tipo']>([
  'cliente_comentou',
  'cliente_aprovou',
  'cliente_alteracao',
  'cliente_enviou',
]);

function quandoCurto(iso: string): string {
  // Só a data (sem hora): mostra o dia sem converter fuso.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }
  return fmtDataHora(iso);
}

const ms = (iso: string) => Date.parse(iso) || 0;

type LinhaDoTempo = {
  id: string;
  quando: string;
  icone: string;
  titulo: string;
  corpo: string;
  quem: string | null;
  cor?: string;
  /** Envio pro cliente: mostra o prazo que ele recebeu e quanto tempo teve. */
  envioCliente?: boolean;
};

const DIA_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function diaSp(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

function diasEntreIso(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

/** Prazo que o cliente recebeu num envio: a primeira tarefa dele que vence no dia do envio ou depois. */
function prazoDoEnvio(
  quando: string,
  tarefas: TarefaClienteHistorico[],
): { texto: string; alerta: boolean } | null {
  const dia = diaSp(quando);
  const alvo = tarefas
    .filter((t) => t.prazo && t.prazo >= dia)
    .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''))[0];
  if (!alvo || !alvo.prazo) return null;
  const dias = diasEntreIso(dia, alvo.prazo);
  const ds = DIA_SEMANA_CURTO[new Date(`${alvo.prazo}T12:00:00Z`).getUTCDay()];
  const tempo = dias === 0 ? 'no mesmo dia' : dias === 1 ? '1 dia' : `${dias} dias`;
  let texto = `Prazo dado: ${alvo.titulo} até ${ds}, ${alvo.prazo.slice(8, 10)}/${alvo.prazo.slice(5, 7)} · ${tempo}`;
  if (alvo.concluidaEm) {
    const resp = diaSp(alvo.concluidaEm);
    texto += ` · respondeu ${resp.slice(8, 10)}/${resp.slice(5, 7)}`;
  }
  return { texto, alerta: dias < 2 };
}

/** Envios, aberturas e notas numa linha do tempo, do mais recente pro mais antigo. */
function montarLinhasDoTempo(
  historico: { visualizacoes: { email: string; vistoEm: string }[]; envios: EnvioHistorico[] },
  notas: NotaHistorico[],
): LinhaDoTempo[] {
  const { visualizacoes, envios } = historico;
  return [
    ...envios.map((e, i) => ({
      id: `envio-${i}-${e.enviadoEm}`,
      quando: e.enviadoEm,
      icone: '📱',
      titulo: [
        'Enviado no WhatsApp',
        MOMENTO_LABEL[e.momento] ?? e.momento,
        e.variante ? VARIANTE_LABEL[e.variante] : null,
      ]
        .filter(Boolean)
        .join(' · '),
      corpo: e.texto?.trim() ?? '',
      quem: e.enviadoPor ? `por ${e.enviadoPor.split('@')[0]}` : null,
      envioCliente: true,
    })),
    ...visualizacoes.map((v, i) => ({
      id: `vista-${i}-${v.vistoEm}`,
      quando: v.vistoEm,
      icone: '👁',
      titulo: 'Cliente abriu o post',
      corpo: '',
      quem: v.email,
    })),
    ...notas.map((n) => ({
      id: n.id,
      quando: n.quando,
      icone: ICONE_NOTA[n.tipo],
      titulo: n.titulo,
      corpo: n.corpo,
      quem: n.autor,
      envioCliente: n.tipo === 'enviado',
      cor:
        n.tipo === 'ok'
          ? 'var(--prazo-em-dia)'
          : n.tipo === 'voltou' || n.tipo === 'cliente_alteracao'
            ? 'var(--cal-alteracao)'
            : undefined,
    })),
  ].sort((a, b) => ms(b.quando) - ms(a.quando));
}

/**
 * Versão curta do histórico (popup de prévia): as últimas atualizações, com
 * aberturas seguidas do cliente juntas numa linha só.
 */
export function HistoricoResumo({
  historico,
  notas = [],
  tarefasCliente = [],
  max = 4,
  hrefCompleto,
  cronologico = false,
}: {
  historico: { visualizacoes: { email: string; vistoEm: string }[]; envios: EnvioHistorico[] };
  notas?: NotaHistorico[];
  tarefasCliente?: TarefaClienteHistorico[];
  max?: number;
  hrefCompleto?: string;
  /** Tudo, do mais antigo pro mais recente (o mais novo por último). */
  cronologico?: boolean;
}) {
  const todasDesc = montarLinhasDoTempo(historico, notas);
  const todas = cronologico ? [...todasDesc].reverse() : todasDesc;
  if (cronologico) max = Infinity;
  const linhas: (LinhaDoTempo & { vezes: number })[] = [];
  for (const l of todas) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && ultima.id.startsWith('vista-') && l.id.startsWith('vista-')) {
      ultima.vezes++;
      continue;
    }
    if (linhas.length >= max) break;
    linhas.push({ ...l, vezes: 1 });
  }
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">Histórico do post</div>
        {hrefCompleto && todas.length > 0 && (
          <a href={hrefCompleto} className="text-[11px] font-semibold text-t3 transition hover:text-ink">
            ver tudo →
          </a>
        )}
      </div>
      {linhas.length === 0 ? (
        <p className="text-[12px] text-t3">Nada por aqui ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {linhas.map((l) => {
            const p = l.envioCliente ? prazoDoEnvio(l.quando, tarefasCliente) : null;
            return (
              <li key={l.id} className="flex items-start gap-2 text-[12px]">
                <span className="w-[78px] shrink-0 pt-px font-mono text-[10.5px] text-t3">{quandoCurto(l.quando)}</span>
                <span className="w-4 shrink-0 text-center" style={l.cor ? { color: l.cor } : undefined}>
                  {l.icone}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-t1" style={l.cor ? { color: l.cor } : undefined} title={l.titulo}>
                    {l.titulo}
                    {l.vezes > 1 && <span className="text-t3"> · {l.vezes}x</span>}
                  </div>
                  {p && (
                    <div className={`truncate text-[11px] ${p.alerta ? 'font-semibold text-[var(--prazo-hoje)]' : 'text-t3'}`} title={p.texto}>
                      {p.texto}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Histórico do post: comunicação com o cliente numa linha do tempo só:
 * comentários (cliente e equipe), aberturas do portal, lembretes enviados e
 * eventos do processo (alteração concluída, reprovada…).
 */
export function ComunicacaoCard({
  historico,
  lembrete,
  notas = [],
  tarefasCliente = [],
}: {
  /** Comentários do post e eventos do processo, já classificados. */
  notas?: NotaHistorico[];
  /** Tarefas do cliente no post: base do "prazo dado" em cada envio. */
  tarefasCliente?: TarefaClienteHistorico[];
  /** Tarefa que está com o cliente agora (pra mandar lembrete). */
  lembrete?: { tarefaId: string; titulo: string; clienteNome: string } | null;
  historico: {
    visualizacoes: { email: string; vistoEm: string }[];
    envios: {
      momento: string;
      variante: string | null;
      enviadoEm: string;
      enviadoPor: string | null;
      texto?: string | null;
    }[];
  };
}) {
  const [verTudo, setVerTudo] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const { visualizacoes, envios } = historico;
  const linhas = montarLinhasDoTempo(historico, notas);

  const doCliente = notas.filter((n) => DO_CLIENTE.has(n.tipo)).sort((a, b) => ms(b.quando) - ms(a.quando));
  const visiveis = verTudo ? linhas : linhas.slice(0, 8);
  const ultimaVista = visualizacoes[0]?.vistoEm;
  const ultimoEnvio = envios[0]?.enviadoEm;

  function alternar(id: string) {
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Histórico do post</h2>
        {lembrete && (
          <BotaoLembreteWpp
            tarefaId={lembrete.tarefaId}
            clienteNome={lembrete.clienteNome}
            rotulo={`Lembrar cliente: ${lembrete.titulo}`}
          />
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-bgSoft/60 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-t3">Lembretes enviados</div>
          <div className="mt-0.5 text-[18px] font-semibold text-ink">{envios.length}</div>
          <div className="text-[11px] text-t3">
            {ultimoEnvio ? `último ${fmtDataHora(ultimoEnvio)}` : 'nenhum ainda'}
          </div>
        </div>
        <div className="rounded-xl bg-bgSoft/60 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-t3">Cliente abriu</div>
          <div className="mt-0.5 text-[18px] font-semibold text-ink">
            {visualizacoes.length} {visualizacoes.length === 1 ? 'vez' : 'vezes'}
          </div>
          <div className="text-[11px] text-t3">
            {ultimaVista ? `última ${fmtDataHora(ultimaVista)}` : 'ainda não abriu'}
          </div>
        </div>
        <div className="rounded-xl bg-bgSoft/60 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-t3">Cliente comentou</div>
          <div className="mt-0.5 text-[18px] font-semibold text-ink">
            {doCliente.length} {doCliente.length === 1 ? 'vez' : 'vezes'}
          </div>
          <div className="text-[11px] text-t3">
            {doCliente[0] ? `último ${quandoCurto(doCliente[0].quando)}` : 'nenhum comentário'}
          </div>
        </div>
      </div>

      {linhas.length > 0 && (
        <>
          <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-t3">Histórico</div>
          <ul className="mt-1.5 divide-y divide-[rgba(21,21,33,0.05)]">
            {visiveis.map((l) => {
              const aberto = abertos.has(l.id);
              const longo = l.corpo.length > 180 || l.corpo.split('\n').length > 3;
              return (
                <li key={l.id} className="flex items-start gap-2.5 py-2 text-[12.5px]">
                  <span className="w-[86px] shrink-0 pt-px font-mono text-[10.5px] text-t3">{quandoCurto(l.quando)}</span>
                  <span className="w-4 shrink-0 text-center" style={l.cor ? { color: l.cor } : undefined}>
                    {l.icone}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="font-medium text-t1" style={l.cor ? { color: l.cor } : undefined}>
                        {l.titulo}
                      </span>
                      {l.quem && <span className="text-[11px] text-t3">{l.quem}</span>}
                    </div>
                    {l.envioCliente &&
                      (() => {
                        const p = prazoDoEnvio(l.quando, tarefasCliente);
                        return p ? (
                          <div
                            className={`mt-0.5 text-[11.5px] ${
                              p.alerta ? 'font-semibold text-[var(--prazo-hoje)]' : 'text-t2'
                            }`}
                          >
                            {p.texto}
                            {p.alerta && ' · pouco tempo'}
                          </div>
                        ) : null;
                      })()}
                    {l.corpo && (
                      <div className="mt-1">
                        <p
                          className={`whitespace-pre-line rounded-lg bg-bgSoft/70 px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-ink ${
                            longo && !aberto ? 'line-clamp-3' : ''
                          }`}
                        >
                          {l.corpo}
                        </p>
                        {longo && (
                          <button
                            type="button"
                            onClick={() => alternar(l.id)}
                            className="mt-0.5 text-[11px] font-semibold text-t3 hover:text-ink"
                          >
                            {aberto ? 'ver menos' : 'ver tudo'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {linhas.length > 8 && (
        <button
          type="button"
          onClick={() => setVerTudo((v) => !v)}
          className="mt-2 text-[11.5px] font-semibold text-t3 transition hover:text-ink"
        >
          {verTudo ? 'Ver menos' : `Ver tudo (${linhas.length})`}
        </button>
      )}
      <p className="mt-2 text-[10.5px] text-t3">
        Visualizações contam desde 06/10. Acessos da equipe não entram.
      </p>
    </div>
  );
}
