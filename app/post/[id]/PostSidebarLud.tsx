'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * Sidebar da visão interna Lud. no post.
 * Reúne as ações que a equipe faz por dentro: programar, comentar no post
 * (visível pro cliente) e nota interna (só time Lud.).
 *
 * ATENÇÃO: a "nota interna" tá com submit STUB por enquanto — só layout.
 * Quando aprovar o visual, implementa API + persistência.
 */
export function PostSidebarLud({
  postId,
  tarefaId,
  status,
  bloqueadoProgramar,
}: {
  postId: string;
  tarefaId: string | null;
  status: string | null;
  bloqueadoProgramar: boolean;
}) {
  return (
    <div className="space-y-4">
      <ProgramarCTA postId={postId} bloqueado={bloqueadoProgramar} status={status} />
      <ComentarNoPost postId={postId} tarefaId={tarefaId} />
      <NotaInterna postId={postId} />
    </div>
  );
}

function ProgramarCTA({
  postId,
  bloqueado,
  status,
}: {
  postId: string;
  bloqueado: boolean;
  status: string | null;
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
        Ação principal
      </div>
      <div className="mt-1 text-[13px] text-t2">
        {bloqueado
          ? 'Aprove a arte antes de programar.'
          : 'Definir horário, plataformas e legenda.'}
      </div>
      {bloqueado ? (
        <button
          type="button"
          disabled
          className="mt-3 w-full cursor-not-allowed rounded-full bg-bgSoft px-4 py-2 text-[12px] font-semibold text-t3"
          title="Só posts com arte aprovada dá pra programar"
        >
          Programar (bloqueado)
        </button>
      ) : (
        <Link
          href={`/programacao/${postId}`}
          className="mt-3 block w-full rounded-full bg-[var(--cal-aprovacao)] px-4 py-2 text-center text-[12px] font-semibold text-white transition hover:opacity-90"
        >
          Programar →
        </Link>
      )}
      {status && (
        <div className="mt-3 text-[10px] uppercase tracking-[0.06em] text-t3">
          Status atual: <span className="font-semibold text-t2">{status}</span>
        </div>
      )}
    </div>
  );
}

function ComentarNoPost({
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
      // Prefere endpoint por post (não depende de tarefa aberta);
      // se não existir, cai pro comentário na tarefa.
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
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Comentário no post
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
          cliente vê
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-[1.5] text-t3">
        Vai como comentário no post do Notion — aparece pro cliente no histórico.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Ex.: subimos a nova versão com o corte do reels ajustado."
        className="mt-3 w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[12px] leading-[1.5] text-ink"
        disabled={loading}
      />
      {erro && (
        <p className="mt-2 rounded-md bg-[var(--prazo-atrasado-soft)] px-2 py-1 text-[11px] text-[var(--prazo-atrasado)]">
          {erro}
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        {feito && (
          <span className="text-[11px] font-medium text-[var(--prazo-em-dia)]">
            ✓ enviado
          </span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={loading || texto.trim().length < 2}
          className="rounded-full bg-ink px-4 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Enviando…' : 'Comentar no post'}
        </button>
      </div>
    </div>
  );
}

function NotaInterna({ postId }: { postId: string }) {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [feito, setFeito] = useState(false);

  async function submit() {
    if (texto.trim().length < 2) return;
    setLoading(true);
    // STUB: apenas simula o salvamento — persistência real vem em outra
    // iteração (Supabase table `post_notas_internas` ou similar).
    // Deixado explícito no console pra debugging.
    // eslint-disable-next-line no-console
    console.log('[nota interna stub]', { postId, texto });
    await new Promise((r) => setTimeout(r, 400));
    setFeito(true);
    setTexto('');
    setLoading(false);
    setTimeout(() => setFeito(false), 3000);
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-[var(--prazo-hoje)]/40 bg-[var(--prazo-hoje-soft)]/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--prazo-hoje)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
            Interno Lud.
          </span>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Nota interna
          </div>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-t3">
          cliente não vê
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-[1.5] text-t2">
        Anotações da equipe sobre o post — decisões de curadoria, pendências, contexto do cliente. Não aparece no Notion do cliente.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Ex.: cliente pediu pra não usar imagem de bebida alcoólica nesse projeto."
        className="mt-3 w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[12px] leading-[1.5] text-ink"
        disabled={loading}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] italic text-t3">
          submit ainda em stub — só layout
        </span>
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
            className="rounded-full border border-[var(--prazo-hoje)] bg-white px-4 py-1.5 text-[11px] font-semibold text-[var(--prazo-hoje)] transition hover:bg-[var(--prazo-hoje-soft)] disabled:opacity-40"
          >
            {loading ? 'Salvando…' : 'Salvar nota'}
          </button>
        </div>
      </div>
    </div>
  );
}
