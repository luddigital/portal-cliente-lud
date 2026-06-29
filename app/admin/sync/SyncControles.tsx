'use client';

import { useState } from 'react';

type Status = {
  postagens: number;
  tarefas: number;
  ultimaSync: {
    iniciadoEm: string | null;
    ok: boolean | null;
    erro: string | null;
  } | null;
} | null;

function fmtRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export function SyncControles({
  projetoIds,
  statusInicial,
}: {
  projetoIds: string[];
  statusInicial: Status;
}) {
  const [status, setStatus] = useState<Status>(statusInicial);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    postagens: { itensLidos: number; itensEscritos: number; duracaoMs: number; erro?: string };
    tarefas: { itensLidos: number; itensEscritos: number; duracaoMs: number; erro?: string };
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function sincronizar() {
    setRodando(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await fetch('/api/admin/sync/notion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projetoIds }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setResultado(j);
      // Atualiza status (refaz fetch leve do status atual)
      try {
        const sr = await fetch('/api/admin/sync/status').then((x) => x.json());
        if (sr && typeof sr.postagens === 'number') setStatus(sr);
      } catch {}
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setRodando(false);
    }
  }

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Sincronização</h2>
          <p className="mt-0.5 text-[12px] text-t3">
            {status ? (
              <>
                {status.postagens} postagens · {status.tarefas} tarefas no
                Supabase agora.
                {status.ultimaSync?.iniciadoEm && (
                  <>
                    {' '}
                    Última sync{' '}
                    <span
                      className={
                        status.ultimaSync.ok ? 'text-ink' : 'text-crimson'
                      }
                    >
                      {fmtRelativo(status.ultimaSync.iniciadoEm)}
                      {status.ultimaSync.ok === false && ' (com erro)'}
                    </span>
                    .
                  </>
                )}
              </>
            ) : (
              'Status indisponível — Supabase pode não estar configurado ainda.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={sincronizar}
          disabled={rodando}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-[13px] disabled:opacity-50"
        >
          {rodando ? '⏳ Sincronizando…' : '↻ Sincronizar agora'}
        </button>
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-redSoft px-3 py-2 text-[12px] text-crimson">
          ⚠️ {erro}
        </p>
      )}

      {resultado && (
        <div className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
          <div className="rounded-md bg-bgSoft px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Postagens
            </div>
            <div className="mt-1 text-ink">
              {resultado.postagens.itensEscritos} escritas (
              {resultado.postagens.itensLidos} lidas) ·{' '}
              {Math.round(resultado.postagens.duracaoMs / 100) / 10}s
            </div>
            {resultado.postagens.erro && (
              <div className="mt-1 text-[11px] text-crimson">
                {resultado.postagens.erro}
              </div>
            )}
          </div>
          <div className="rounded-md bg-bgSoft px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Tarefas
            </div>
            <div className="mt-1 text-ink">
              {resultado.tarefas.itensEscritos} escritas (
              {resultado.tarefas.itensLidos} lidas) ·{' '}
              {Math.round(resultado.tarefas.duracaoMs / 100) / 10}s
            </div>
            {resultado.tarefas.erro && (
              <div className="mt-1 text-[11px] text-crimson">
                {resultado.tarefas.erro}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
