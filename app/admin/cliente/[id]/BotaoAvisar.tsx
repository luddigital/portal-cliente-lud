'use client';

import { useState } from 'react';

export function BotaoAvisar({ email }: { email: string }) {
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'erro'>('idle');
  const [info, setInfo] = useState<string | null>(null);

  async function avisar() {
    setEstado('enviando');
    setInfo(null);
    try {
      const res = await fetch('/api/admin/avisar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emails: [email] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      const r = data.resultados?.[0];
      if (r?.enviado) {
        setEstado('ok');
        setInfo(
          `enviado · ${r.totalTarefas} tarefa${r.totalTarefas === 1 ? '' : 's'}${
            r.pushEnviados ? ` + ${r.pushEnviados} push` : ''
          }`,
        );
      } else {
        setEstado('ok');
        setInfo(r?.motivo ?? 'cliente sem tarefa pendente');
      }
    } catch (e: any) {
      setEstado('erro');
      setInfo(e.message);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={avisar}
        disabled={estado === 'enviando'}
        className="btn-primary"
        style={{ background: 'var(--prazo-hoje)' }}
      >
        {estado === 'enviando' ? 'Enviando…' : '✉️ Avisar esse cliente'}
      </button>
      {info && (
        <span
          className="text-[12px]"
          style={{
            color:
              estado === 'erro'
                ? 'var(--prazo-atrasado)'
                : estado === 'ok'
                  ? 'var(--prazo-em-dia)'
                  : 'var(--t2)',
          }}
        >
          {info}
        </span>
      )}
    </div>
  );
}
