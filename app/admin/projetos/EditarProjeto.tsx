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

export function EditarProjeto({
  projetoId,
  projetoNome,
  configInicial,
}: {
  projetoId: string;
  projetoNome: string;
  configInicial: ProjetoConfig;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [c, setC] = useState<ProjetoConfig>(configInicial);
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
        body: JSON.stringify({ projetoNome, config: c }),
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
