'use client';

import { useRef, useState } from 'react';

/**
 * Espaço livre na central pro cliente subir qualquer material a qualquer
 * momento — fora de uma tarefa específica. Vai pra uma pasta do cliente
 * no Drive e avisa a equipe.
 */
export function EnviarMateriais() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<number | null>(null);

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files ?? []);
    if (fs.length > 0) {
      setArquivos((a) => [...a, ...fs]);
      setEnviado(null);
      setError(null);
    }
  }

  function remover(idx: number) {
    setArquivos((a) => a.filter((_, i) => i !== idx));
  }

  async function enviar() {
    if (arquivos.length === 0) {
      setError('Anexe pelo menos um arquivo.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of arquivos) fd.append('arquivos', f);
      if (nota.trim()) fd.append('nota', nota.trim());
      const res = await fetch('/api/materiais', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setEnviado(data.qtd ?? arquivos.length);
      setArquivos([]);
      setNota('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
        Enviar materiais
      </div>
      <p className="mt-1 text-[13px] text-t2">
        Suba fotos, vídeos ou qualquer arquivo pra equipe — quando quiser, sem
        precisar de uma tarefa aberta.
      </p>

      <div className="mt-4 space-y-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={escolher}
          className="hidden"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(21,21,33,0.2)] bg-bgSoft px-4 py-5 text-[13px] font-medium text-t2 transition hover:border-navy/40 hover:text-ink disabled:opacity-50"
        >
          📎 Escolher arquivos
        </button>

        {arquivos.length > 0 && (
          <ul className="space-y-1">
            {arquivos.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-bgSoft px-3 py-2 text-[12px]"
              >
                <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                <button
                  type="button"
                  onClick={() => remover(i)}
                  disabled={loading}
                  className="shrink-0 text-t3 transition hover:text-hubRed"
                  aria-label="Remover"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Quer deixar um recado pra equipe? (opcional)"
          className="input resize-y text-[13px]"
          disabled={loading}
        />

        {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}
        {enviado != null && (
          <p className="text-[12px] font-medium text-[var(--prazo-em-dia)]">
            ✓ {enviado} arquivo{enviado > 1 ? 's' : ''} enviado{enviado > 1 ? 's' : ''}{' '}
            — a equipe foi avisada.
          </p>
        )}

        <button
          type="button"
          onClick={enviar}
          disabled={loading || arquivos.length === 0}
          className="btn-primary w-full justify-center"
        >
          {loading ? 'Enviando…' : 'Enviar materiais'}
        </button>
      </div>
    </div>
  );
}
