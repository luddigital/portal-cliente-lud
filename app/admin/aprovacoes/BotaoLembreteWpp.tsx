'use client';

import { useState } from 'react';

/**
 * Botão que dispara um lembrete via WhatsApp (Z-API) pro cliente responsável
 * por uma tarefa de aprovação.
 *
 * Estados visuais:
 *  - idle: ícone 📱 + "Lembrar WhatsApp"
 *  - enviando: spinner + "Enviando…"
 *  - sucesso: ✓ verde + "Enviado" (volta pra idle em 3s)
 *  - erro: ⚠ vermelho + toast com mensagem (volta pra idle em 5s)
 */
export function BotaoLembreteWpp({
  tarefaId,
  clienteNome,
}: {
  tarefaId: string;
  clienteNome: string;
}) {
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'erro'>('idle');
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const ok = window.confirm(
      `Mandar lembrete pelo WhatsApp pra ${clienteNome}?`,
    );
    if (!ok) return;

    setEstado('enviando');
    setErro(null);
    try {
      const res = await fetch(
        `/api/admin/wpp-lembrete-aprovacao/${tarefaId}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setEstado('ok');
      setTimeout(() => setEstado('idle'), 3000);
    } catch (e: any) {
      setErro(e?.message ?? 'erro desconhecido');
      setEstado('erro');
      setTimeout(() => {
        setEstado('idle');
        setErro(null);
      }, 5000);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={enviar}
        disabled={estado === 'enviando'}
        title={`Enviar lembrete de aprovação pelo WhatsApp pra ${clienteNome}`}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition ${
          estado === 'ok'
            ? 'bg-[var(--prazo-em-dia-soft)] text-[var(--prazo-em-dia)]'
            : estado === 'erro'
              ? 'bg-[var(--prazo-atrasado-soft)] text-[var(--prazo-atrasado)]'
              : 'bg-bgSoft text-t2 hover:bg-ink hover:text-white disabled:opacity-50'
        }`}
      >
        {estado === 'enviando'
          ? '…'
          : estado === 'ok'
            ? '✓ enviado'
            : estado === 'erro'
              ? '⚠ erro'
              : '📱 lembrar'}
      </button>
      {estado === 'erro' && erro && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-[rgba(21,21,33,0.1)] bg-white p-2.5 text-[11px] text-[var(--prazo-atrasado)] shadow-lg">
          {erro}
        </div>
      )}
    </div>
  );
}
