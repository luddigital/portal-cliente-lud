'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function TarefaForm({
  tarefaId,
  voltarPara = '/',
}: {
  tarefaId: string;
  voltarPara?: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ driveLink: string | null; arquivos: number } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      if (texto) fd.set('texto', texto);
      for (const f of arquivos) fd.append('arquivos', f);
      const res = await fetch(`/api/tarefas/${tarefaId}/submit`, { method: 'POST', body: fd });
      let data: any = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setDone({ driveLink: data.driveLink, arquivos: data.arquivos });
      setTimeout(() => router.push(voltarPara), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <div className="text-[16px] font-semibold text-ink">Enviado ✨</div>
        <p className="mt-2 text-[13px] text-mauve">
          {done.arquivos > 0 ? `${done.arquivos} arquivo${done.arquivos > 1 ? 's' : ''} no Drive + ` : ''}
          tarefa atualizada no Notion.
        </p>
        <p className="mt-4 text-[11px] text-t3">
          {voltarPara === '/' ? 'Voltando pro dashboard…' : 'Voltando pra etapa…'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card p-5">
        <label className="label">Informações</label>
        <textarea
          rows={8}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva aqui tudo que a gente precisa saber pra montar esse post."
          className="input resize-y"
        />
      </div>

      <div className="card p-5">
        <label className="label">Fotos e vídeos</label>
        <div className="relative rounded-[10px] border-2 border-dashed border-[rgba(21,21,33,0.1)] bg-[#FAFAFB] p-10 text-center transition hover:border-navy/40">
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <svg
            className="mx-auto mb-3 h-8 w-8 text-mauve"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="M21 15l-4.5-4.5L8 19" />
          </svg>
          <div className="text-[13px] font-medium text-ink">
            {arquivos.length > 0
              ? `${arquivos.length} arquivo${arquivos.length > 1 ? 's' : ''} selecionado${arquivos.length > 1 ? 's' : ''}`
              : 'Selecione as fotos e vídeos do seu computador ou celular'}
          </div>
          <div className="mt-1 text-[11px] text-t3">Você pode anexar vários arquivos</div>
        </div>
        {arquivos.length > 0 && (
          <ul className="mt-3 space-y-1 text-[12px] text-t2">
            {arquivos.map((f, i) => (
              <li key={i} className="flex justify-between font-mono">
                <span className="truncate">{f.name}</span>
                <span className="text-t3">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-[12px] font-medium text-crimson">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <button type="submit" disabled={loading || (!texto && arquivos.length === 0)} className="btn-primary">
          {loading ? 'Enviando…' : 'Enviar materiais'}
        </button>
      </div>
    </form>
  );
}
