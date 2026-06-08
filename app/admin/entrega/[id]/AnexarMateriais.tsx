'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Caixa pra admin anexar materiais a uma tarefa de produção sem concluir.
 * Dois modos: upload direto de arquivo OU colar um link externo (Drive,
 * Dropbox, WeTransfer, etc).
 */
export function AnexarMateriais({
  tarefaId,
  onAnexado,
}: {
  tarefaId: string;
  onAnexado?: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [aba, setAba] = useState<'upload' | 'link'>('upload');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNome, setLinkNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar() {
    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const fd = new FormData();
      if (aba === 'upload') {
        if (arquivos.length === 0) {
          setError('Selecione pelo menos um arquivo.');
          setLoading(false);
          return;
        }
        for (const f of arquivos) fd.append('arquivos', f);
      } else {
        const url = linkUrl.trim();
        if (!url || !/^https?:\/\//.test(url)) {
          setError('Cola um link válido (começando com https://).');
          setLoading(false);
          return;
        }
        fd.set('linkUrl', url);
        if (linkNome.trim()) fd.set('linkNome', linkNome.trim());
      }
      const res = await fetch(`/api/admin/tarefas/${tarefaId}/anexar`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      const partes: string[] = [];
      if (data.arquivos > 0) partes.push(`${data.arquivos} arquivo(s) no Drive`);
      if (data.linkAdicionado) partes.push('link adicionado');
      setAviso(`✓ ${partes.join(' + ') || 'Anexado'}. Tarefa segue aberta.`);
      setArquivos([]);
      setLinkUrl('');
      setLinkNome('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
      onAnexado?.();
      setTimeout(() => setAviso(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-bgSoft/40 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Anexar materiais
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-full border border-[rgba(21,21,33,0.1)] bg-white text-[11px]">
          <button
            type="button"
            onClick={() => setAba('upload')}
            className={`px-2.5 py-1 transition ${
              aba === 'upload'
                ? 'bg-ink text-white'
                : 'text-t2 hover:text-ink'
            }`}
          >
            ⬆ Arquivo
          </button>
          <button
            type="button"
            onClick={() => setAba('link')}
            className={`px-2.5 py-1 transition ${
              aba === 'link' ? 'bg-ink text-white' : 'text-t2 hover:text-ink'
            }`}
          >
            🔗 Link
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-t3">
        Pra registrar material recebido por fora (whatsapp, e-mail). Não fecha
        a tarefa.
      </p>

      {aba === 'upload' ? (
        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.zip"
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
            className="block w-full text-[12px] text-t2 file:mr-3 file:rounded-full file:border-0 file:bg-bgSoft file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-ink hover:file:bg-[rgba(21,21,33,0.08)]"
          />
          {arquivos.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-t2">
              {arquivos.map((f, i) => (
                <li key={i} className="flex justify-between font-mono">
                  <span className="truncate">{f.name}</span>
                  <span className="text-t3">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
            className="input text-[12px]"
          />
          <input
            type="text"
            value={linkNome}
            onChange={(e) => setLinkNome(e.target.value)}
            placeholder="Nome do link (opcional)"
            className="input text-[12px]"
          />
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] font-medium text-hubRed">{error}</p>
      )}
      {aviso && (
        <p className="mt-2 rounded-md bg-[var(--prazo-em-dia-soft)] px-2.5 py-1.5 text-[11px] text-[var(--prazo-em-dia)]">
          {aviso}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={enviar}
          disabled={loading}
          className="rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white transition disabled:opacity-50"
        >
          {loading ? 'Enviando…' : aba === 'upload' ? 'Anexar arquivo' : 'Adicionar link'}
        </button>
      </div>
    </div>
  );
}
