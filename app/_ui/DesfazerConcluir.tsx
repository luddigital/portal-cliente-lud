'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * "Desfazer" depois de concluir uma tarefa (visão Lud.).
 * Quem conclui chama `avisarConcluida(id, rotulo)`; o aviso aparece no canto
 * por 10 segundos e o botão volta a tarefa pra "Iniciar" (API /reabrir).
 */
const EVENTO = 'lud:tarefa-concluida';

export function avisarConcluida(tarefaId: string, rotulo?: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { tarefaId, rotulo: rotulo ?? null } }));
}

type Aviso = { tarefaId: string; rotulo: string | null };

export function DesfazerConcluir() {
  const router = useRouter();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [estado, setEstado] = useState<'pronto' | 'desfazendo' | 'desfeito' | 'erro'>('pronto');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function agendarFechar(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(null), ms);
  }

  useEffect(() => {
    function ouvir(e: Event) {
      const d = (e as CustomEvent<Aviso>).detail;
      if (!d?.tarefaId) return;
      setAviso(d);
      setEstado('pronto');
      agendarFechar(10000);
    }
    window.addEventListener(EVENTO, ouvir);
    return () => {
      window.removeEventListener(EVENTO, ouvir);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function desfazer() {
    if (!aviso) return;
    setEstado('desfazendo');
    if (timer.current) clearTimeout(timer.current);
    try {
      const r = await fetch(`/api/tarefas/${aviso.tarefaId}/reabrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Iniciar' }),
      });
      if (!r.ok) throw new Error();
      setEstado('desfeito');
      // Atualiza os dados sem recarregar a página (sem tela branca).
      setTimeout(() => startTransition(() => router.refresh()), 300);
    } catch {
      setEstado('erro');
      agendarFechar(6000);
    }
  }

  if (!aviso) return null;
  return (
    <div role="status" className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-[14px] bg-[#111113] px-4 py-3 text-[13px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <span className="max-w-[60vw] truncate">
        {estado === 'desfeito'
          ? 'Pronto, a tarefa voltou a ficar aberta.'
          : estado === 'erro'
            ? 'Não deu pra desfazer. Tenta de novo.'
            : `✓ ${aviso.rotulo ? `"${aviso.rotulo}" concluída` : 'Tarefa concluída'}`}
      </span>
      {(estado === 'pronto' || estado === 'desfazendo' || estado === 'erro') && (
        <button
          type="button"
          onClick={desfazer}
          disabled={estado === 'desfazendo'}
          className="rounded-[9px] bg-white px-3 py-1 text-[12.5px] font-extrabold text-[#111113] hover:bg-[#F4F4F5] disabled:opacity-60"
        >
          {estado === 'desfazendo' ? 'Desfazendo…' : 'Desfazer'}
        </button>
      )}
      <button type="button" onClick={() => setAviso(null)} aria-label="Fechar" className="text-[14px] opacity-60 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}
