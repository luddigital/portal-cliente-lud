'use client';

import { useState } from 'react';

type Resultado = {
  email: string;
  nome: string | null;
  enviado: boolean;
  totalTarefas: number;
  motivo?: string;
  pushEnviados?: number;
};

export function AdminAvisarPanel() {
  const [emailsTexto, setEmailsTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function disparar(modo: 'todos' | 'lista') {
    setLoading(true);
    setError(null);
    setResultados(null);
    try {
      const body: any = {};
      if (modo === 'lista') {
        const emails = emailsTexto
          .split(/[\n,;\s]+/)
          .map((e) => e.trim())
          .filter((e) => e.includes('@'));
        if (emails.length === 0) {
          setError('Cola pelo menos 1 email válido na caixa de texto.');
          setLoading(false);
          return;
        }
        body.emails = emails;
      }
      const res = await fetch('/api/admin/avisar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setResultados(data.resultados ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Avisar todos os clientes com tarefas pendentes
        </div>
        <p className="text-[13px] text-t2 leading-[1.5]">
          Varre o banco de Clientes do Notion e manda email só pra quem tem tarefa pendente
          (aprovação, materiais, info, etc).
        </p>
        <button
          type="button"
          onClick={() => disparar('todos')}
          disabled={loading}
          className="btn-primary"
          style={{ background: 'var(--cal-publicado)' }}
        >
          {loading ? 'Enviando…' : '✉️ Avisar todos'}
        </button>
      </div>

      <div className="card p-5 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Ou avisar emails específicos
        </div>
        <textarea
          rows={4}
          value={emailsTexto}
          onChange={(e) => setEmailsTexto(e.target.value)}
          placeholder="cola um email por linha ou separados por vírgula"
          className="input resize-y text-[13px]"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => disparar('lista')}
          disabled={loading || !emailsTexto.trim()}
          className="btn-ghost"
        >
          {loading ? 'Enviando…' : 'Avisar essa lista'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-[rgba(192,71,55,0.1)] border border-[rgba(192,71,55,0.3)] px-4 py-3 text-[13px] text-hubRed">
          {error}
        </div>
      )}

      {resultados && (
        <div className="card p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Resultado
          </div>
          <div className="mt-2 text-[13px] text-t2">
            {resultados.filter((r) => r.enviado).length} de {resultados.length} emails enviados.
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px]">
            {resultados.map((r, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 rounded-lg bg-bgSoft px-3 py-2"
              >
                <span className="font-mono text-ink truncate">{r.email}</span>
                <span
                  className={
                    r.enviado
                      ? 'shrink-0 text-[var(--prazo-em-dia)] font-semibold'
                      : 'shrink-0 text-t3'
                  }
                >
                  {r.enviado
                    ? `✓ ${r.totalTarefas} tarefa${r.totalTarefas === 1 ? '' : 's'}${
                        r.pushEnviados ? ` + ${r.pushEnviados} push` : ''
                      }`
                    : `— ${r.motivo ?? 'pulado'}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
