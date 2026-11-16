'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Reuniao } from '@/lib/supabase';

type ProjetoLite = { id: string; nome: string; servico: string };

export function ReunioesView({
  reunioes: iniciais,
  projetos,
}: {
  reunioes: Reuniao[];
  projetos: ProjetoLite[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [reunioes, setReunioes] = useState(iniciais);
  const [modalNova, setModalNova] = useState(false);
  const [edicao, setEdicao] = useState<Reuniao | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'proximas' | 'feitas'>('proximas');

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const projetoPorId = useMemo(() => {
    const m = new Map<string, ProjetoLite>();
    for (const p of projetos) m.set(p.id, p);
    return m;
  }, [projetos]);

  const filtradas = useMemo(() => {
    return reunioes.filter((r) => {
      if (filtroStatus === 'feitas') return r.feita;
      if (filtroStatus === 'proximas') {
        if (r.feita) return false;
        return new Date(r.data) >= hoje;
      }
      return true;
    });
  }, [reunioes, filtroStatus, hoje]);

  function atualizarListaLocal(novaOuAtualizada: Reuniao) {
    setReunioes((lista) => {
      const existente = lista.findIndex((x) => x.id === novaOuAtualizada.id);
      if (existente === -1) return [novaOuAtualizada, ...lista];
      const copia = [...lista];
      copia[existente] = novaOuAtualizada;
      return copia;
    });
    startTransition(() => router.refresh());
  }

  async function toggleFeita(r: Reuniao) {
    const resp = await fetch('/api/reuniao', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, feita: !r.feita }),
    });
    const data = await resp.json();
    if (resp.ok && data.reuniao) atualizarListaLocal(data.reuniao);
  }

  async function excluir(r: Reuniao) {
    if (!confirm(`Excluir a reunião "${r.titulo || 'sem título'}"?`)) return;
    const resp = await fetch(`/api/reuniao?id=${r.id}`, { method: 'DELETE' });
    if (resp.ok) {
      setReunioes((lista) => lista.filter((x) => x.id !== r.id));
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="space-y-5">
      {/* Filtros + botão de nova */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full bg-bgSoft p-1">
          {([
            ['proximas', 'Próximas'],
            ['feitas', 'Feitas'],
            ['todas', 'Todas'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltroStatus(k)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                filtroStatus === k ? 'bg-white text-ink shadow-sm' : 'text-t3 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setModalNova(true)}
          className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
        >
          + Agendar reunião
        </button>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.15)] bg-white p-10 text-center">
          <div className="text-[14px] font-semibold text-ink">Nada aqui ainda</div>
          <p className="mt-1 text-[12px] text-t3">
            {filtroStatus === 'proximas' && 'Nenhuma reunião futura agendada.'}
            {filtroStatus === 'feitas' && 'Nenhuma reunião concluída.'}
            {filtroStatus === 'todas' && 'Agende a primeira reunião pelo botão acima.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((r) => {
            const p = projetoPorId.get(r.projetoId);
            return (
              <ReuniaoItem
                key={r.id}
                r={r}
                projetoNome={p?.nome ?? r.clienteNome ?? 'Projeto'}
                onToggle={() => toggleFeita(r)}
                onEditar={() => setEdicao(r)}
                onExcluir={() => excluir(r)}
              />
            );
          })}
        </div>
      )}

      {modalNova && (
        <ModalReuniao
          projetos={projetos}
          onFechar={() => setModalNova(false)}
          onSalvo={(nova) => {
            atualizarListaLocal(nova);
            setModalNova(false);
          }}
        />
      )}

      {edicao && (
        <ModalReuniao
          projetos={projetos}
          reuniao={edicao}
          onFechar={() => setEdicao(null)}
          onSalvo={(atualizada) => {
            atualizarListaLocal(atualizada);
            setEdicao(null);
          }}
        />
      )}
    </div>
  );
}

function ReuniaoItem({
  r, projetoNome, onToggle, onEditar, onExcluir,
}: {
  r: Reuniao;
  projetoNome: string;
  onToggle: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const d = new Date(r.data);
  const dataFormatada = d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const atrasada = !r.feita && d < new Date();

  return (
    <div
      className={`card flex flex-wrap items-start gap-3 p-4 transition ${r.feita ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={r.feita ? 'Marcar como não feita' : 'Marcar como feita'}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          r.feita
            ? 'border-[var(--prazo-em-dia)] bg-[var(--prazo-em-dia)] text-white'
            : 'border-[rgba(21,21,33,0.25)] bg-white hover:border-ink'
        }`}
      >
        {r.feita && '✓'}
      </button>

      <button
        type="button"
        onClick={onEditar}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={`text-[14px] font-semibold text-ink ${r.feita ? 'line-through' : ''}`}>
            {r.titulo || 'Reunião sem título'}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-t3">
            {projetoNome}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-t2">
          <span className={atrasada ? 'font-semibold text-[var(--prazo-atrasado)]' : ''}>
            {dataFormatada} · {hora}
            {atrasada && ' · atrasada'}
          </span>
          {r.pauta && <span className="text-t3">· pauta registrada</span>}
          {r.anotacoes && <span className="text-t3">· tem anotações</span>}
        </div>
      </button>

      <button
        type="button"
        onClick={onExcluir}
        className="text-[11px] font-medium text-t3 transition hover:text-[var(--prazo-atrasado)]"
      >
        Excluir
      </button>
    </div>
  );
}

function ModalReuniao({
  projetos,
  reuniao,
  onFechar,
  onSalvo,
}: {
  projetos: ProjetoLite[];
  reuniao?: Reuniao;
  onFechar: () => void;
  onSalvo: (r: Reuniao) => void;
}) {
  const editing = !!reuniao;
  const [projetoId, setProjetoId] = useState(reuniao?.projetoId ?? projetos[0]?.id ?? '');
  const [data, setData] = useState(reuniao ? toLocalDateTimeInput(reuniao.data) : amanhaAs10());
  const [titulo, setTitulo] = useState(reuniao?.titulo ?? '');
  const [pauta, setPauta] = useState(reuniao?.pauta ?? '');
  const [anotacoes, setAnotacoes] = useState(reuniao?.anotacoes ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const projeto = projetos.find((p) => p.id === projetoId);
      const isoData = new Date(data).toISOString();
      const body = editing
        ? { id: reuniao!.id, data: isoData, titulo, pauta, anotacoes }
        : { projetoId, clienteNome: projeto?.nome, data: isoData, titulo, pauta };
      const resp = await fetch('/api/reuniao', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await resp.json();
      if (!resp.ok) {
        setErro(j.error ?? 'Erro ao salvar');
        return;
      }
      onSalvo(j.reuniao);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgba(21,21,33,0.06)] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-ink">
            {editing ? 'Editar reunião' : 'Nova reunião'}
          </h3>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-full p-2 text-t3 transition hover:bg-bgSoft hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <Campo label="Projeto">
            <select
              value={projetoId}
              onChange={(e) => setProjetoId(e.target.value)}
              disabled={editing}
              className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink disabled:opacity-60"
            >
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Data e hora">
            <input
              type="datetime-local"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
            />
          </Campo>

          <Campo label="Título">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Alinhamento mensal · novembro"
              className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
            />
          </Campo>

          <Campo label="Pauta">
            <textarea
              value={pauta}
              onChange={(e) => setPauta(e.target.value)}
              placeholder="O que vamos tratar?"
              rows={4}
              className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
            />
          </Campo>

          {editing && (
            <Campo label="Anotações">
              <textarea
                value={anotacoes}
                onChange={(e) => setAnotacoes(e.target.value)}
                placeholder="O que ficou combinado? Próximos passos?"
                rows={6}
                className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
              />
            </Campo>
          )}

          {erro && (
            <p
              className="rounded-lg px-3 py-2 text-[12px]"
              style={{ background: 'var(--prazo-atrasado-soft)', color: 'var(--prazo-atrasado)' }}
            >
              {erro}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-2 text-[12px] font-medium text-t2 transition hover:text-ink disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !projetoId || !data}
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : editing ? 'Salvar' : 'Agendar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function amanhaAs10(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalDateTimeInput(d.toISOString());
}

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
