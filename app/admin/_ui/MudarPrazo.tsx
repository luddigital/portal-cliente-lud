'use client';

/**
 * Troca rápida do prazo de uma tarefa (Data Entrega no Notion), sem sair da página.
 * Atalhos: hoje, amanhã, próxima segunda, +1 semana, ou escolher no calendário.
 * Fica registrado no histórico de mudanças de prazo.
 */
import { useState } from 'react';

function somaDias(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function MudarPrazo({
  tarefaId,
  prazo,
  hoje,
  onMudou,
}: {
  tarefaId: string;
  prazo: string | null;
  hoje: string;
  onMudou?: (novo: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState(prazo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dow = new Date(hoje + 'T12:00:00Z').getUTCDay();
  const proxSeg = somaDias(hoje, ((8 - dow) % 7) || 7);

  async function salvar(novo: string) {
    if (!novo) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/admin/tarefas/${tarefaId}/prazo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prazo: novo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'erro');
      setAtual(novo);
      setAberto(false);
      onMudou?.(novo);
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const atrasada = !!atual && atual < hoje;
  const rot = atual ? `${atual.slice(8)}/${atual.slice(5, 7)}` : 'sem data';
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        title="Mudar o prazo"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold"
        style={atrasada ? { background: '#F6CFCB', color: '#7E211C' } : { background: '#F4F4F5', color: '#46464B' }}
      >
        {salvando ? 'salvando…' : rot} <span className="text-[10px] opacity-70">✎</span>
      </button>
      {aberto && (
        <span className="absolute left-0 top-[calc(100%+6px)] z-20 flex w-[230px] flex-col gap-1.5 rounded-[14px] border border-[#E9E9EB] bg-white p-2.5 shadow-[0_8px_24px_rgba(17,17,19,0.12)]">
          <span className="px-1 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">Novo prazo</span>
          <span className="grid grid-cols-2 gap-1.5">
            {[
              ['Hoje', hoje],
              ['Amanhã', somaDias(hoje, 1)],
              ['Segunda', proxSeg],
              ['+1 semana', somaDias(hoje, 7)],
            ].map(([l, d]) => (
              <button
                key={l}
                type="button"
                disabled={salvando}
                onClick={() => salvar(d)}
                className="rounded-[9px] border border-[#E9E9EB] px-2 py-1.5 text-[12px] font-bold hover:border-[#111113] disabled:opacity-50"
              >
                {l}
              </button>
            ))}
          </span>
          <input
            id={`prazo-${tarefaId}`}
            type="date"
            defaultValue={atual ?? hoje}
            onChange={(e) => salvar(e.target.value)}
            className="rounded-[9px] border border-[#D6D6D9] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#111113]"
          />
          {erro && <span className="px-1 text-[11.5px] text-[#7E211C]">Não salvou: {erro}</span>}
          <button type="button" onClick={() => setAberto(false)} className="text-[11.5px] text-[#636369] hover:text-[#111113]">
            Fechar
          </button>
        </span>
      )}
    </span>
  );
}
