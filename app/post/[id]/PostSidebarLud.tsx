'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TarefaDoPost } from '@/lib/notion';
import { ehTarefaDoCliente } from '@/lib/etapas-projeto';
import { BotaoLembreteWpp } from '@/app/admin/aprovacoes/BotaoLembreteWpp';
import type { ProgramacaoConfig } from '@/lib/supabase';

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

export function StatusDoPostChips({
  postId,
  status,
  alinhar = 'direita',
  grande = false,
}: {
  postId: string;
  status: string | null;
  alinhar?: 'esquerda' | 'direita';
  /** Cabeçalho do post: chips maiores, sem borda. */
  grande?: boolean;
}) {
  const router = useRouter();
  const atual = bucketDoStatus(status);
  const [loading, setLoading] = useState<StatusChip | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  return (
    <div className={`flex flex-col gap-1 ${alinhar === 'esquerda' ? 'items-start' : 'items-end'}`}>
      <div className={`flex flex-wrap items-center gap-1.5 ${alinhar === 'esquerda' ? 'justify-start' : 'justify-end'}`}>
        <span
          className={`mr-1 font-semibold uppercase text-t3 ${
            grande ? 'mr-3 text-[11px] tracking-[0.12em]' : 'text-[10px] tracking-[0.1em]'
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
                grande ? 'px-4 py-1.5 text-[13.5px]' : 'px-2.5 py-1 text-[11px]'
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

const porPrazo = (a: TarefaDoPost, b: TarefaDoPost) =>
  (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999');

export function TodasTarefasCard({ tarefas: iniciais }: { tarefas: TarefaDoPost[] }) {
  const [tarefas, setTarefas] = useState(iniciais);
  const [verConcluidas, setVerConcluidas] = useState(false);
  // Concluídas aqui: guardam o status anterior pro "desmarcar".
  const [agora, setAgora] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const feita = (t: TarefaDoPost) => !t.aberta || !!t.finalizada;
  const abertas = tarefas.filter((t) => !feita(t) || t.tarefaId in agora).sort(porPrazo);
  const concluidas = tarefas
    .filter((t) => feita(t) && !(t.tarefaId in agora))
    .sort((a, b) => (a.finalizada ?? a.prazo ?? '').localeCompare(b.finalizada ?? b.prazo ?? ''));
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

  function Linha({ t, concluida }: { t: TarefaDoPost; concluida: boolean }) {
    const p = prazoRelativo(t.prazo);
    const marcada = feita(t);
    const podeMexer = !concluida;
    return (
      <li className="flex items-center gap-2.5 py-2">
        <span className="w-[42px] shrink-0 font-mono text-[11px] text-t2">{ddmmCurto(t.prazo)}</span>
        <span
          className={`w-[92px] shrink-0 text-[11px] ${
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
        <Avatar nome={t.pessoaNome} url={t.pessoaAvatar} />
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
  }

  return (
    <div className="card p-5">
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
            <ul className="mt-2 divide-y divide-[rgba(21,21,33,0.05)]">
              {abertas.map((t) => (
                <Linha key={t.tarefaId} t={t} concluida={false} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] font-semibold text-[var(--prazo-em-dia)]">Tudo concluído ✨</p>
          )}
          {erro && <p className="mt-2 text-[11.5px] font-semibold text-ink">{erro}</p>}

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
                  {concluidas.map((t) => (
                    <Linha key={t.tarefaId} t={t} concluida />
                  ))}
                </ul>
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

export function ComunicacaoCard({
  historico,
  lembrete,
}: {
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
  ].sort((a, b) => b.quando.localeCompare(a.quando));
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
      <div className="mt-3 grid grid-cols-2 gap-2">
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
        Visualizações contam desde 06/10. Acessos da equipe não entram.
      </p>
    </div>
  );
}
