'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ComentarioCliente } from './PostSidebarLud';

type Tipo = 'arte' | 'copy';

function hojeSp(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** Próximo dia útil (sexta → segunda). */
function proximoDiaUtil(): string {
  const d = new Date(`${hojeSp()}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/**
 * Pedido de alteração do cliente → alteração interna de arte e/ou copy.
 * Com "Alteração | Post" aberta vira um card em destaque (com o que o cliente
 * escreveu); sem pedido aberto fica só um botão discreto.
 */
export function SolicitarAlteracao({
  postId,
  pedido,
  comentarios,
  responsaveis,
}: {
  postId: string;
  /** Tarefa "Alteração | Post" aberta, se houver. */
  pedido: { tarefaId: string; prazo: string | null } | null;
  comentarios: ComentarioCliente[];
  responsaveis: { arte: string | null; copy: string | null };
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(!!pedido);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [prazo, setPrazo] = useState(proximoDiaUtil);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ titulo: string; pessoa: string | null }[] | null>(null);

  const doCliente = [...comentarios]
    .filter((c) => c.tipo === 'alteracao' || c.tipo === 'comentou')
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice(0, 3);

  function alternar(t: Tipo) {
    setTipos((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  }

  async function enviar() {
    if (tipos.length === 0) {
      setErro('Escolhe arte, copy ou as duas.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/post/${postId}/solicitar-alteracao`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipos, prazo, nota, alteracaoPostId: pedido?.tarefaId ?? null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setFeito(j.criadas ?? []);
      router.refresh();
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui pedir a alteração.');
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    return (
      <div className="card p-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Alteração pedida ✓</h2>
        <ul className="mt-2 space-y-1 text-[13px] text-t1">
          {feito.map((c) => (
            <li key={c.titulo}>
              {c.titulo}
              {c.pessoa && <span className="text-t3"> · {c.pessoa.split(' ')[0]}</span>}
              <span className="text-t3"> · até {ddmm(prazo)} às 17h</span>
            </li>
          ))}
        </ul>
        {pedido && <p className="mt-2 text-[12px] text-t3">"Alteração | Post" foi concluída.</p>}
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-t2 transition hover:bg-bgSoft hover:text-ink"
      >
        🔁 Solicitar alteração de arte ou copy
      </button>
    );
  }

  const opcoes: { id: Tipo; titulo: string; detalhe: string }[] = [
    { id: 'arte', titulo: 'Arte', detalhe: responsaveis.arte ? `com ${responsaveis.arte.split(' ')[0]}` : 'Alteração | Arte' },
    { id: 'copy', titulo: 'Copy', detalhe: responsaveis.copy ? `com ${responsaveis.copy.split(' ')[0]}` : 'Alteração | Briefing & Copy' },
  ];

  return (
    <section
      className={`card p-5 ${pedido ? '!bg-[var(--cal-alteracao-soft)]' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {pedido ? 'Cliente pediu alteração' : 'Solicitar alteração'}
        </h2>
        {pedido ? (
          <span className="rounded-full bg-[var(--cal-alteracao-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--cal-alteracao)]">
            Alteração | Post{pedido.prazo ? ` · até ${ddmm(pedido.prazo.slice(0, 10))}` : ''}
          </span>
        ) : (
          <button type="button" onClick={() => setAberto(false)} className="text-[12px] text-t3 hover:text-ink">
            Fechar
          </button>
        )}
      </div>

      {pedido && (
        <div className="mt-3 space-y-2">
          {doCliente.length > 0 ? (
            doCliente.map((c, i) => (
              <div key={`${c.quando}-${i}`} className="rounded-xl bg-bgSoft/70 px-3.5 py-2.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3">
                  {c.tipo === 'alteracao' ? 'Pedido de alteração' : 'Comentário'} · {fmtDataHora(c.quando)}
                </div>
                <p className="mt-1 whitespace-pre-line text-[13.5px] leading-[1.5] text-ink">{c.trecho || '(sem texto)'}</p>
              </div>
            ))
          ) : (
            <p className="text-[12.5px] text-t3">
              O comentário do cliente não veio pelo portal. Confere no histórico de comentários abaixo.
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-t3">O que precisa mudar?</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {opcoes.map((o) => {
            const ativo = tipos.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => alternar(o.id)}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                  ativo
                    ? 'border-[var(--cal-alteracao)] bg-[var(--cal-alteracao-soft)]'
                    : 'border-[rgba(21,21,33,0.1)] bg-white hover:bg-bgSoft'
                }`}
              >
                <span
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border text-[11px] ${
                    ativo ? 'border-[var(--cal-alteracao)] bg-[var(--cal-alteracao)] text-white' : 'border-[rgba(21,21,33,0.25)] text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">{o.titulo}</span>
                  <span className="block text-[11.5px] text-t3">{o.detalhe}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <label className="block">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-t3">Prazo (17h)</span>
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-[rgba(21,21,33,0.15)] bg-white px-2 font-mono text-[12px] text-ink outline-none focus:border-ink"
          />
        </label>
        <label className="block">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-t3">
            O que mudar (vai escrito na tarefa)
          </span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Ex.: trocar a foto do slide 2 e ajustar o título da capa"
            className="mt-1 w-full resize-y rounded-lg border border-[rgba(21,21,33,0.15)] bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-ink"
          />
        </label>
      </div>

      {erro && (
        <p className="mt-2 rounded-md bg-[var(--prazo-atrasado-soft)] px-2 py-1 text-[12px] text-[var(--prazo-atrasado)]">{erro}</p>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-b-[inherit] border-t border-[rgba(21,21,33,0.08)] bg-white px-5 py-3">
        <p className="text-[11.5px] text-t3">
          {tipos.length === 0
            ? 'Cria "Alteração | …" + "Aprovação | …" no Notion pra cada escolha.'
            : `Vai criar ${tipos.length * 2} tarefas${pedido ? ' e concluir a "Alteração | Post"' : ''}.`}
        </p>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || tipos.length === 0}
          className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {enviando ? 'Criando tarefas…' : 'Solicitar alteração'}
        </button>
      </div>
    </section>
  );
}
