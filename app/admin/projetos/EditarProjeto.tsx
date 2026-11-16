'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProjetoConfig } from '@/lib/notion';

const FOCO_OPCOES = [
  'Alcance e descoberta',
  'Engajamento e retenção',
  'Conversão',
  'Autoridade',
];

type Metrica = keyof ProjetoConfig['metas'];
type Campo = 'inicio' | 'atual' | 'meta';

const METRICAS: { chave: Metrica; label: string }[] = [
  { chave: 'seguidores', label: 'Seguidores' },
  { chave: 'engajamento', label: 'Engajamento' },
  { chave: 'alcance', label: 'Alcance' },
];

/** Seg → dom; o valor é o dia da semana do JS (0 = domingo). */
const DIAS_SEMANA = [
  { v: 1, l: 'Seg' },
  { v: 2, l: 'Ter' },
  { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' },
  { v: 5, l: 'Sex' },
  { v: 6, l: 'Sáb' },
  { v: 0, l: 'Dom' },
];

export type Combinado = { postsPorMes: number | null; diasFixos: number[] };

export function EditarProjeto({
  projetoId,
  projetoNome,
  configInicial,
  combinadoInicial,
}: {
  projetoId: string;
  projetoNome: string;
  configInicial: ProjetoConfig;
  combinadoInicial: Combinado;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [c, setC] = useState<ProjetoConfig>(configInicial);
  const [postsMes, setPostsMes] = useState<string>(combinadoInicial.postsPorMes != null ? String(combinadoInicial.postsPorMes) : '');
  const [dias, setDias] = useState<number[]>(combinadoInicial.diasFixos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setMeta(metrica: Metrica, campo: Campo, v: string) {
    setC((prev) => ({
      ...prev,
      metas: {
        ...prev.metas,
        [metrica]: { ...prev.metas[metrica], [campo]: v },
      },
    }));
  }

  function toggleFoco(opt: string) {
    setC((prev) => ({
      ...prev,
      foco: prev.foco.includes(opt)
        ? prev.foco.filter((f) => f !== opt)
        : [...prev.foco, opt],
    }));
  }

  async function salvar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projeto-config/${projetoId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projetoNome,
          config: c,
          combinado: { postsPorMes: postsMes.trim() === '' ? null : Number(postsMes), diasFixos: dias },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Erro ${res.status}`);
      setAberto(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setC(configInicial);
          setPostsMes(combinadoInicial.postsPorMes != null ? String(combinadoInicial.postsPorMes) : '');
          setDias(combinadoInicial.diasFixos);
          setError(null);
          setAberto(true);
        }}
        className="btn-ghost text-[12px]"
      >
        Editar projeto
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
          onClick={() => !loading && setAberto(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-[0_8px_40px_rgba(21,21,33,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[rgba(21,21,33,0.08)] px-5 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  editar projeto
                </div>
                <div className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  {projetoNome}
                </div>
              </div>
              <button
                type="button"
                onClick={() => !loading && setAberto(false)}
                className="shrink-0 rounded-full bg-bgSoft px-2.5 py-1 text-[13px] text-t2 transition hover:text-ink"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {/* combinado com o cliente */}
              <div className="rounded-xl bg-bgSoft p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  Combinado com o cliente
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink">Posts por mês</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={postsMes}
                      onChange={(e) => setPostsMes(e.target.value)}
                      placeholder="Ex.: 16"
                      className="input w-[96px] px-2 py-1.5 text-[13px]"
                      disabled={loading}
                    />
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-ink">Dias fixos de post</span>
                    <div className="flex flex-wrap gap-1">
                      {DIAS_SEMANA.map((d) => {
                        const on = dias.includes(d.v);
                        return (
                          <button
                            key={d.v}
                            type="button"
                            disabled={loading}
                            onClick={() => setDias((ds) => (on ? ds.filter((x) => x !== d.v) : [...ds, d.v]))}
                            className={`h-[30px] w-[42px] rounded-[8px] text-[12px] font-semibold transition ${
                              on ? 'bg-ink text-white' : 'border border-[rgba(21,21,33,0.14)] bg-white text-t2'
                            }`}
                          >
                            {d.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-t3">
                  É o que foi fechado no início: a nova pauta usa esses dias pra montar o mês.
                </p>
              </div>

              {/* objetivo */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  Objetivo principal
                </label>
                <textarea
                  rows={3}
                  value={c.objetivo}
                  onChange={(e) => setC({ ...c, objetivo: e.target.value })}
                  placeholder="Qual o objetivo principal desse projeto?"
                  className="input mt-1 resize-y text-[13px]"
                  disabled={loading}
                />
              </div>

              {/* foco */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  Foco
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {FOCO_OPCOES.map((opt) => {
                    const on = c.foco.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleFoco(opt)}
                        disabled={loading}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                          on ? 'bg-ink text-white' : 'bg-bgSoft text-t2'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* metas */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  Metas
                </label>
                <div className="mt-1.5 space-y-2">
                  {METRICAS.map((m) => (
                    <div key={m.chave} className="rounded-xl bg-bgSoft p-2.5">
                      <div className="text-[11px] font-semibold text-ink">
                        {m.label}
                      </div>
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                        {(['inicio', 'atual', 'meta'] as Campo[]).map((campo) => (
                          <div key={campo}>
                            <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
                              {campo === 'inicio'
                                ? 'Início'
                                : campo === 'atual'
                                  ? 'Atual'
                                  : 'Meta'}
                            </div>
                            <input
                              type="text"
                              value={c.metas[m.chave][campo]}
                              onChange={(e) => setMeta(m.chave, campo, e.target.value)}
                              className="input mt-0.5 px-2 py-1.5 text-[12px]"
                              disabled={loading}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-[12px] font-medium text-hubRed">{error}</p>
              )}

              <button
                type="button"
                onClick={salvar}
                disabled={loading}
                className="btn-primary w-full justify-center"
              >
                {loading ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
