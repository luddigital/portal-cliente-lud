'use client';

import { useState } from 'react';

export function CompartilharDriveBotao() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function compartilhar() {
    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const res = await fetch('/api/admin/compartilhar-drive', {
        method: 'POST',
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setResultado(j);
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={compartilhar}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Compartilhando…' : 'Compartilhar raiz do Drive com admins'}
      </button>

      {erro && (
        <div className="rounded-lg bg-[var(--prazo-atrasado-soft)] p-3 text-[12px] text-[var(--prazo-atrasado)]">
          {erro}
        </div>
      )}

      {resultado && (
        <div className="card p-5 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--prazo-em-dia)]">
            ✓ Pronto
          </div>
          <div className="text-[12.5px] text-t1">
            <div className="font-semibold">Compartilhado com:</div>
            <ul className="mt-1 list-disc pl-5 text-t2">
              {resultado.compartilhadosCom?.map((e: string) => (
                <li key={e} className="font-mono text-[11.5px]">
                  {e}
                </li>
              ))}
            </ul>
          </div>
          {resultado.erros?.length > 0 && (
            <div className="text-[12.5px] text-[var(--prazo-atrasado)]">
              <div className="font-semibold">Erros:</div>
              <ul className="mt-1 list-disc pl-5">
                {resultado.erros.map((e: any, i: number) => (
                  <li key={i} className="font-mono text-[11px]">
                    {e.email}: {e.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11.5px] text-t3">
            Pode levar alguns minutos pra o Google propagar as permissões.
            Depois disso qualquer link do Drive do portal deve abrir normalmente.
          </p>
        </div>
      )}
    </div>
  );
}
