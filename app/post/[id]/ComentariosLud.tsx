'use client';

import { useState } from 'react';

/**
 * Card único com 2 painéis lado a lado (empilha no mobile):
 *   - Com o cliente  → posta no Notion via API existente (cliente vê no histórico)
 *   - Nota interna   → STUB por enquanto (só layout; persistência vem depois)
 */
export function ComentariosLud({
  postId,
  tarefaId,
}: {
  postId: string;
  tarefaId: string | null;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold text-ink">Comentários</h3>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
          2 conversas separadas
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PainelComCliente postId={postId} tarefaId={tarefaId} />
        <PainelInterno postId={postId} />
      </div>
    </section>
  );
}

function PainelComCliente({
  postId,
  tarefaId,
}: {
  postId: string;
  tarefaId: string | null;
}) {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit() {
    if (texto.trim().length < 2) return;
    setLoading(true);
    setErro(null);
    try {
      const url = tarefaId
        ? `/api/tarefas/${tarefaId}/comentar`
        : `/api/post/${postId}/comentar`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: texto.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setFeito(true);
      setTexto('');
      setTimeout(() => setFeito(false), 3000);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-[rgba(21,21,33,0.06)] bg-[var(--cal-agendado-soft)] px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--cal-agendado)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--cal-agendado)]" />
          Com o cliente
        </div>
        <span className="rounded-full border border-[rgba(59,103,137,0.3)] bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--cal-agendado)]">
          cliente vê
        </span>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-[11.5px] leading-[1.5] text-t3">
          Vira comentário no post do Notion — aparece no histórico do cliente.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder="Ex.: subimos a nova versão com o corte do reels ajustado."
          className="w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] leading-[1.5] text-ink"
          disabled={loading}
        />
        {erro && (
          <p className="rounded-md bg-[var(--prazo-atrasado-soft)] px-2 py-1 text-[11px] text-[var(--prazo-atrasado)]">
            {erro}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          {feito && (
            <span className="text-[11px] font-medium text-[var(--prazo-em-dia)]">
              ✓ enviado
            </span>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={loading || texto.trim().length < 2}
            className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Enviando…' : 'Comentar no post'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PainelInterno({ postId }: { postId: string }) {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [feito, setFeito] = useState(false);

  async function submit() {
    if (texto.trim().length < 2) return;
    setLoading(true);
    // STUB: só simula. Persistência real vem em iteração posterior
    // (tabela `post_notas_internas` no Supabase + API).
    // eslint-disable-next-line no-console
    console.log('[nota interna stub]', { postId, texto });
    await new Promise((r) => setTimeout(r, 350));
    setFeito(true);
    setTexto('');
    setLoading(false);
    setTimeout(() => setFeito(false), 3000);
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-dashed border-[var(--prazo-hoje)]/40 bg-[var(--prazo-hoje-soft)]/30">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--prazo-hoje)]/20 bg-[var(--prazo-hoje-soft)]/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--prazo-hoje)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--prazo-hoje)]" />
          Nota interna
        </div>
        <span className="rounded-full bg-[var(--prazo-hoje)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-white">
          só a equipe
        </span>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-[11.5px] leading-[1.5] text-t2">
          Anotações da equipe — decisões, contexto, pendências. Cliente <b>não</b> vê.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder="Ex.: cliente pediu pra não usar imagem de bebida alcoólica nesse projeto."
          className="w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] leading-[1.5] text-ink"
          disabled={loading}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] italic text-t3">submit em stub — só layout</span>
          <div className="flex items-center gap-2">
            {feito && (
              <span className="text-[11px] font-medium text-[var(--prazo-em-dia)]">
                ✓ salvo (stub)
              </span>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={loading || texto.trim().length < 2}
              className="rounded-full border border-[var(--prazo-hoje)] bg-white px-4 py-1.5 text-[12px] font-semibold text-[var(--prazo-hoje)] transition hover:bg-[var(--prazo-hoje-soft)] disabled:opacity-40"
            >
              {loading ? 'Salvando…' : 'Salvar nota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
