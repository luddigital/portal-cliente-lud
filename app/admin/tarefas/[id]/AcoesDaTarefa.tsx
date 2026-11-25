'use client';

import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';

/** Botões da página da tarefa: concluir, mudar prazo e ver o post (prévia). */
export function AcoesDaTarefa({
  tarefaId,
  aberta,
  prazo,
  postId,
}: {
  tarefaId: string;
  aberta: boolean;
  prazo: string | null;
  postId: string | null;
}) {
  const router = useRouter();
  const [atualizando, startTransition] = useTransition();
  const [previa, setPrevia] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [feita, setFeita] = useState(false);
  const [prazoAberto, setPrazoAberto] = useState(false);
  const [novoPrazo, setNovoPrazo] = useState(prazo ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function concluir() {
    setConcluindo(true);
    setErro(null);
    try {
      const r = await fetch(`/api/tarefas/${tarefaId}/concluir`, { method: 'POST' });
      if (!r.ok) throw new Error();
      avisarConcluida(tarefaId);
      setFeita(true);
      startTransition(() => router.refresh());
    } catch {
      setErro('Não consegui concluir no Notion. Tente de novo.');
    } finally {
      setConcluindo(false);
    }
  }

  async function salvarPrazo() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novoPrazo)) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/tarefas/${tarefaId}/prazo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prazo: novoPrazo }),
      });
      if (!r.ok) throw new Error();
      setPrazoAberto(false);
      startTransition(() => router.refresh());
    } catch {
      setErro('Não consegui mudar o prazo. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative flex flex-wrap gap-2.5">
        {aberta && !feita ? (
          <button
            type="button"
            onClick={concluir}
            disabled={concluindo || atualizando}
            className="rounded-xl bg-ink px-4 py-3 text-[14px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {concluindo ? 'Concluindo…' : '✓ Concluir tarefa'}
          </button>
        ) : (
          <span className="rounded-xl bg-[var(--prazo-em-dia)] px-4 py-3 text-[14px] font-bold text-white">✓ Concluída</span>
        )}
        {aberta && !feita && (
          <button
            type="button"
            onClick={() => setPrazoAberto((v) => !v)}
            className="rounded-xl border border-[#DCDCE0] bg-white px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-bgSoft"
          >
            Mudar prazo
          </button>
        )}
        {postId && (
          <button
            type="button"
            onClick={() => setPrevia(true)}
            className="rounded-xl border border-[#DCDCE0] bg-white px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-bgSoft"
          >
            Ver o post
          </button>
        )}
        {prazoAberto && (
          <div className="absolute left-0 top-full z-20 mt-2 w-[280px] space-y-3 rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4 shadow-[0_12px_32px_rgba(21,21,33,0.14)]">
            <div className="text-[14px] font-semibold text-ink">Novo prazo</div>
            <p className="text-[12.5px] text-t2">Fica no histórico do post.</p>
            <input
              type="date"
              value={novoPrazo}
              onChange={(e) => setNovoPrazo(e.target.value)}
              className="w-full rounded-xl border border-[#DCDCE0] px-3 py-2 text-[14px] text-ink"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPrazoAberto(false)} className="rounded-lg px-3 py-2 text-[13px] text-t2 hover:text-ink">
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarPrazo}
                disabled={salvando || !novoPrazo || novoPrazo === prazo}
                className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {salvando ? 'Salvando…' : 'Salvar prazo'}
              </button>
            </div>
          </div>
        )}
      </div>
      {erro && <p className="text-[12.5px] text-[var(--prazo-atrasado)]">{erro}</p>}
      {previa && postId && <PreviaPostModal postId={postId} tarefaId={tarefaId} fechar={() => setPrevia(false)} />}
    </div>
  );
}
