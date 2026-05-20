'use client';

import { useEffect, useState } from 'react';

export type NovoPost = {
  titulo: string;
  cliente: string;
  data: string;
  formato: 'post' | 'reels' | 'story';
};

const FORMATOS: { valor: NovoPost['formato']; label: string }[] = [
  { valor: 'post', label: 'Carrossel' },
  { valor: 'reels', label: 'Reels' },
  { valor: 'story', label: 'Stories' },
];

/**
 * Form de novo post. Por enquanto cria só o card local na tela —
 * a gravação no Notion entra depois.
 */
export function NovoPostModal({
  clientes,
  dataInicial,
  onCriar,
  onClose,
}: {
  clientes: string[];
  dataInicial?: string;
  onCriar: (post: NovoPost) => void;
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [cliente, setCliente] = useState(clientes[0] ?? '');
  const [data, setData] = useState(dataInicial ?? '');
  const [formato, setFormato] = useState<NovoPost['formato']>('post');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function criar() {
    if (!titulo.trim()) {
      setError('Dá um título pro post.');
      return;
    }
    if (!cliente.trim()) {
      setError('Escolhe o cliente.');
      return;
    }
    if (!data) {
      setError('Escolhe a data de postagem.');
      return;
    }
    onCriar({ titulo: titulo.trim(), cliente: cliente.trim(), data, formato });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-[0_8px_40px_rgba(21,21,33,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(21,21,33,0.08)] px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              novo post
            </div>
            <div className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
              Criar card de post
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-bgSoft px-2.5 py-1 text-[13px] text-t2 transition hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Título
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Chegando em Paris no verão?"
              className="input mt-1 text-[13px]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Cliente
            </label>
            {clientes.length > 0 ? (
              <select
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="input mt-1 text-[13px]"
              >
                {clientes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome do cliente"
                className="input mt-1 text-[13px]"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                Data
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="input mt-1 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                Formato
              </label>
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value as NovoPost['formato'])}
                className="input mt-1 text-[13px]"
              >
                {FORMATOS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}

          <div className="rounded-lg bg-bgSoft px-3 py-2 text-[11px] text-t2">
            ⚠ Por enquanto o post fica só aqui na tela — a gravação no Notion
            entra numa próxima etapa.
          </div>

          <button
            type="button"
            onClick={criar}
            className="btn-primary w-full justify-center"
          >
            Criar card
          </button>
        </div>
      </div>
    </div>
  );
}
