'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProjetoCover({
  projetoId,
  coverUrlInicial,
  capaNotion = null,
  nomeProjeto,
}: {
  projetoId: string;
  coverUrlInicial: string | null;
  /** Capa da página do projeto no Notion — usada quando não tem capa própria no portal. */
  capaNotion?: string | null;
  nomeProjeto: string;
}) {
  const router = useRouter();
  const [coverUrl, setCoverUrl] = useState(coverUrlInicial);
  const [modalAberto, setModalAberto] = useState(false);
  const [draftUrl, setDraftUrl] = useState(coverUrlInicial ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(novoUrl: string | null) {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/projeto/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetoId, coverUrl: novoUrl }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.error ?? 'Erro ao salvar');
        return;
      }
      setCoverUrl(data.coverUrl);
      setModalAberto(false);
      router.refresh();
    } catch {
      setErro('Erro de rede');
    } finally {
      setSalvando(false);
    }
  }

  const capa = coverUrl ?? capaNotion;
  return (
    <div className="relative w-full">
      {capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={capa}
          alt={`Capa de ${nomeProjeto}`}
          className="h-[170px] w-full rounded-t-[22px] object-cover sm:h-[200px]"
        />
      ) : (
        <div className="h-[150px] w-full rounded-t-[22px] sm:h-[180px]" style={{ background: '#D3E2F3' }} />
      )}

      <button
        type="button"
        onClick={() => {
          setDraftUrl(coverUrl ?? '');
          setErro(null);
          setModalAberto(true);
        }}
        className="absolute right-4 top-4 rounded-full bg-[#111113]/80 px-3 py-1.5 text-[12px] font-extrabold text-white transition hover:bg-[#111113]"
      >
        {capa ? 'Trocar capa' : '+ Adicionar capa'}
      </button>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[rgba(21,21,33,0.06)] px-5 py-4">
              <h3 className="text-[15px] font-semibold text-ink">Capa do projeto</h3>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-full p-2 text-t3 transition hover:bg-bgSoft hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
                  URL da imagem
                </label>
                <input
                  type="url"
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-2 w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
                />
                <p className="mt-1.5 text-[11px] text-t3">
                  Cola o link direto de uma imagem (ex: Unsplash, uma foto do Drive publicada,
                  uma imagem do site do cliente).
                </p>
              </div>

              {draftUrl && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                    Prévia
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draftUrl}
                    alt="Prévia"
                    className="mt-2 h-[120px] w-full rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {erro && (
                <p
                  className="rounded-lg px-3 py-2 text-[12px]"
                  style={{ background: 'var(--prazo-atrasado-soft)', color: 'var(--prazo-atrasado)' }}
                >
                  {erro}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => salvar(null)}
                    disabled={salvando}
                    className="text-[12px] font-medium text-mauve transition hover:text-ink disabled:opacity-50"
                  >
                    Remover capa
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    disabled={salvando}
                    className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-2 text-[12px] font-medium text-t2 transition hover:text-ink disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => salvar(draftUrl || null)}
                    disabled={salvando}
                    className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {salvando ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
