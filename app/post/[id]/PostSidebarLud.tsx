'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TarefaDoPost } from '@/lib/notion';
import { compararNoFluxo, ehTarefaDoCliente } from '@/lib/etapas-projeto';
import { BotaoLembreteWpp } from '@/app/admin/aprovacoes/BotaoLembreteWpp';
import type { MudancaPrazo, ProgramacaoConfig } from '@/lib/supabase';

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
      router.refresh();
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
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ultima = mudancas[0];

  async function salvar() {
    if (!valor || valor === prazo) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(valor);
      setEditando(false);
    } catch {
      /* erro aparece no card */
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <input
          type="date"
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar();
            if (e.key === 'Escape') setEditando(false);
          }}
          className="h-7 rounded-md border border-[rgba(21,21,33,0.2)] bg-white px-1.5 font-mono text-[11px] text-ink outline-none focus:border-ink"
        />
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
          onClick={() => setEditando(false)}
          aria-label="Cancelar"
          className="h-7 px-1 text-[14px] text-t3 hover:text-ink"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValor(prazo ?? hojeLocal());
        setEditando(true);
      }}
      title={
        ultima
          ? `Prazo mudou ${mudancas.length}x · última: ${ddmmCurto(ultima.de)} → ${ddmmCurto(ultima.para)} (${ultima.por}, ${fmtQuando(ultima.em)}). Clique pra mudar.`
          : 'Clique pra mudar o prazo'
      }
      className="group -mx-1 flex w-[54px] shrink-0 items-center gap-1 rounded px-1 py-0.5 font-mono text-[11px] text-t2 transition hover:bg-bgSoft hover:text-ink"
    >
      {ddmmCurto(prazo)}
      {mudancas.length > 0 ? (
        <span className="text-[9px] text-[var(--cal-agendado)]">↺</span>
      ) : (
        <span className="text-[9px] text-t3 opacity-0 transition group-hover:opacity-100">✎</span>
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
}: {
  tarefas: TarefaDoPost[];
  /** Notion user id do responsável → id da página do colaborador. */
  colaboradores?: Record<string, string>;
  /** Mudanças de prazo; sem isso o card não mostra a seção de histórico. */
  historico?: MudancaPrazo[];
  podeEditarPrazo?: boolean;
  /** Dentro do popup: sem o card em volta. */
  semMoldura?: boolean;
}) {
  const router = useRouter();
  const [tarefas, setTarefas] = useState(iniciais);
  const [mudancas, setMudancas] = useState<MudancaPrazo[]>(historico ?? []);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);
  // Concluídas aqui: guardam o status anterior pro "desmarcar".
  const [agora, setAgora] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const feita = (t: TarefaDoPost) => !t.aberta || !!t.finalizada;
  const abertas = tarefas.filter((t) => !feita(t) || t.tarefaId in agora).sort(porOrdem);
  const concluidas = tarefas.filter((t) => feita(t) && !(t.tarefaId in agora)).sort(porOrdem);
  const total = tarefas.length;
  const nFeitas = tarefas.filter(feita).length;
  const pct = total > 0 ? Math.round((nFeitas / total) * 100) : 0;

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
      router.refresh();
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui mudar o prazo.');
      throw e;
    }
  }

  // Função (não componente) pra não remontar a linha a cada render.
  const linha = (t: TarefaDoPost, concluida: boolean) => {
    const p = prazoRelativo(t.prazo);
    const marcada = feita(t);
    const podeMexer = !concluida;
    const doTarefa = mudancas.filter((m) => m.tarefaId === t.tarefaId);
    return (
      <li key={t.tarefaId} className="flex items-center gap-2.5 py-2">
        {podeEditarPrazo && !concluida && !marcada ? (
          <PrazoEditavel prazo={t.prazo} mudancas={doTarefa} onSalvar={(novo) => mudarPrazo(t, novo)} />
        ) : (
          <span className="w-[54px] shrink-0 font-mono text-[11px] text-t2">{ddmmCurto(t.prazo)}</span>
        )}
        <span
          className={`w-[84px] shrink-0 text-[11px] ${
            concluida || marcada
              ? 'text-t3'
              : p.atrasada
                ? 'font-semibold text-[var(--prazo-atrasado)]'
                : 'text-t2'
          }`}
        >
          {concluida || marcada
            ? `concluída ${ddmmCurto(t.finalizada ?? null)}`
            : p.texto}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-[13px] ${marcada ? 'text-t3 line-through' : 'text-ink'}`}
          title={t.titulo}
        >
          {t.titulo}
          {t.status === 'Reprovado' && <span className="ml-1.5 text-[11px] text-t3">(reprovado)</span>}
        </span>
        <Responsavel
          nome={t.pessoaNome}
          url={t.pessoaAvatar}
          colaboradorId={t.pessoaId ? colaboradores[t.pessoaId] ?? null : null}
        />
        <TagTipo doCliente={ehTarefaDoCliente(t.titulo)} />
        <button
          type="button"
          onClick={() => podeMexer && alternar(t)}
          disabled={!podeMexer || salvando === t.tarefaId}
          title={concluida ? 'Concluída' : marcada ? 'Desmarcar' : 'Concluir tarefa'}
          aria-label={marcada ? `Desmarcar ${t.titulo}` : `Concluir ${t.titulo}`}
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border text-[11px] leading-none transition ${
            marcada
              ? 'border-ink bg-ink text-white'
              : 'border-[rgba(21,21,33,0.25)] bg-white text-transparent hover:border-ink hover:text-t3'
          } ${concluida ? 'cursor-default' : ''} disabled:opacity-60`}
        >
          {salvando === t.tarefaId ? '…' : '✓'}
        </button>
      </li>
    );
  };

  return (
    <div className={semMoldura ? '' : 'card p-5'}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Tarefas</h2>
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
            <>
              <div className="mt-3 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-t3">
                <span className="w-[54px] shrink-0">Prazo</span>
                <span className="w-[84px] shrink-0" />
                <span className="min-w-0 flex-1">Tarefa</span>
                <span className="w-[96px] shrink-0">Responsável</span>
                <span className="w-[58px] shrink-0" />
                <span className="w-[18px] shrink-0" />
              </div>
              <ul className="mt-0.5 divide-y divide-[rgba(21,21,33,0.05)]">
                {abertas.map((t) => linha(t, false))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-[12px] font-semibold text-[var(--prazo-em-dia)]">Tudo concluído ✨</p>
          )}
          {erro && (
            <p className="mt-2 rounded-md bg-[var(--prazo-atrasado-soft)] px-2 py-1 text-[11.5px] text-[var(--prazo-atrasado)]">
              {erro}
            </p>
          )}

          {concluidas.length > 0 && (
            <div className="mt-3 border-t border-[rgba(21,21,33,0.06)] pt-3">
              <button
                type="button"
                onClick={() => setVerConcluidas((v) => !v)}
                className="text-[12px] font-semibold text-t2 transition hover:text-ink"
              >
                {verConcluidas ? '▾' : '▸'} {verConcluidas ? 'Esconder' : 'Ver'} {concluidas.length}{' '}
                {concluidas.length === 1 ? 'concluída' : 'concluídas'}
              </button>
              {verConcluidas && (
                <ul className="mt-1 divide-y divide-[rgba(21,21,33,0.05)]">
                  {concluidas.map((t) => linha(t, true))}
                </ul>
              )}
            </div>
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
        className="ml-auto rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-bgSoft"
      >
        Programar →
      </Link>
    </div>
  );
}

// ============================================================================
// Comunicação com o cliente — lembretes enviados + visualizações no portal
// ============================================================================

const MOMENTO_LABEL: Record<string, string> = {
  quinta: 'Envio da semana',
  sexta: 'Lembrete de sexta',
  segunda_manha: 'Último dia (manhã)',
  segunda_tarde: 'Último dia (tarde)',
  terca: 'Prazo vencido',
  avulso: 'Lembrete avulso',
  reaprovacao: 'Reaprovação enviada (depois da alteração)',
  geral: 'Mensagem geral do projeto',
};

const VARIANTE_LABEL: Record<string, string> = {
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

const COMENTARIO_LABEL: Record<ComentarioCliente['tipo'], { icone: string; texto: string }> = {
  comentou: { icone: '💬', texto: 'Cliente comentou' },
  aprovou: { icone: '✅', texto: 'Cliente aprovou' },
  alteracao: { icone: '🔁', texto: 'Cliente pediu alteração' },
  enviou: { icone: '📎', texto: 'Cliente enviou materiais' },
};

export function ComunicacaoCard({
  historico,
  lembrete,
  comentarios = [],
}: {
  /** Comentários do cliente no post (aprovou, pediu alteração, comentou…). */
  comentarios?: ComentarioCliente[];
  /** Tarefa que está com o cliente agora (pra mandar lembrete). */
  lembrete?: { tarefaId: string; titulo: string; clienteNome: string } | null;
  historico: {
    visualizacoes: { email: string; vistoEm: string }[];
    envios: { momento: string; variante: string | null; enviadoEm: string; enviadoPor: string | null }[];
  };
}) {
  const [verTudo, setVerTudo] = useState(false);
  const { visualizacoes, envios } = historico;
  const eventos = [
    ...envios.map((e) => ({
      quando: e.enviadoEm,
      icone: '📱',
      texto: [MOMENTO_LABEL[e.momento] ?? e.momento, e.variante ? VARIANTE_LABEL[e.variante] : null]
        .filter(Boolean)
        .join(' · '),
      quem: e.enviadoPor ? `por ${e.enviadoPor.split('@')[0]}` : null,
    })),
    ...visualizacoes.map((v) => ({
      quando: v.vistoEm,
      icone: '👁',
      texto: 'Cliente abriu o post',
      quem: v.email,
    })),
    ...comentarios.map((c) => ({
      quando: c.quando,
      icone: COMENTARIO_LABEL[c.tipo].icone,
      texto: c.trecho ? `${COMENTARIO_LABEL[c.tipo].texto}: “${c.trecho.replace(/\s+/g, ' ')}”` : COMENTARIO_LABEL[c.tipo].texto,
      quem: c.autor,
    })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));
  const ultimoComentario = [...comentarios].sort((a, b) => b.quando.localeCompare(a.quando))[0];
  const visiveis = verTudo ? eventos : eventos.slice(0, 6);
  const ultimaVista = visualizacoes[0]?.vistoEm;
  const ultimoEnvio = envios[0]?.enviadoEm;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Comunicação com o cliente</h2>
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
            {comentarios.length} {comentarios.length === 1 ? 'vez' : 'vezes'}
          </div>
          <div className="text-[11px] text-t3">
            {ultimoComentario
              ? `${COMENTARIO_LABEL[ultimoComentario.tipo].texto.replace('Cliente ', '')} ${fmtDataHora(ultimoComentario.quando)}`
              : 'nenhum comentário'}
          </div>
        </div>
      </div>

      {eventos.length > 0 && (
        <ul className="mt-3 space-y-1">
          {visiveis.map((e, i) => (
            <li key={`${e.quando}-${i}`} className="flex items-baseline gap-2 text-[12px]">
              <span className="w-[86px] shrink-0 font-mono text-[10.5px] text-t3">{fmtDataHora(e.quando)}</span>
              <span className="shrink-0">{e.icone}</span>
              <span className="min-w-0 flex-1 truncate text-t1">{e.texto}</span>
              {e.quem && <span className="hidden shrink-0 text-[11px] text-t3 sm:inline">{e.quem}</span>}
            </li>
          ))}
        </ul>
      )}
      {eventos.length > 6 && (
        <button
          type="button"
          onClick={() => setVerTudo((v) => !v)}
          className="mt-2 text-[11.5px] font-semibold text-t3 transition hover:text-ink"
        >
          {verTudo ? 'Ver menos' : `Ver tudo (${eventos.length})`}
        </button>
      )}
      <p className="mt-2 text-[10.5px] text-t3">
        Visualizações contam desde 06/10. Acessos e comentários da equipe não entram.
      </p>
    </div>
  );
}
