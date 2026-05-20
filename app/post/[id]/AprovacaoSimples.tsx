'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Modo = 'idle' | 'aprovando' | 'pedindoAlteracao';

/**
 * Caixa de aprovação simples: usada em fluxos sem preview/carrossel
 * (ex: Aprovação de Pauta). Mesma lógica dinâmica de botões do PostPreview.
 */
export function AprovacaoSimples({
  tarefaId,
  tarefaTitulo,
  voltarPara = '/',
}: {
  tarefaId: string;
  tarefaTitulo: string;
  voltarPara?: string;
}) {
  const router = useRouter();
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<Modo>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'aprovado' | 'alteracao' | null>(null);

  // Persiste o rascunho — se o cliente sai e volta, o comentário continua aqui.
  const storageKey = `lud:coment:${tarefaId}`;
  const rascunhoCarregado = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.comentario === 'string') setComentario(parsed.comentario);
      }
    } catch {
      /* ignora rascunho corrompido */
    }
    rascunhoCarregado.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!rascunhoCarregado.current) return;
    try {
      if (comentario.trim() === '') {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify({ comentario }));
      }
    } catch {
      /* localStorage indisponível */
    }
  }, [storageKey, comentario]);

  function limparRascunho() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ok */
    }
  }

  const temComentario = comentario.trim() !== '';

  async function aprovar() {
    setLoading(true);
    setError(null);
    setModo('aprovando');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/aprovar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      limparRascunho();
      setDone('aprovado');
      setTimeout(() => router.push(voltarPara), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setModo('idle');
    }
  }

  async function pedirAlteracao() {
    if (comentario.trim().length < 3) {
      setError('Conta o que precisa ajustar antes de pedir alteração.');
      return;
    }
    setLoading(true);
    setError(null);
    setModo('pedindoAlteracao');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/alterar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      limparRascunho();
      setDone('alteracao');
      setTimeout(() => router.push(voltarPara), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setModo('idle');
    }
  }

  return (
    <div className="card sticky bottom-2 sm:bottom-6 z-20 space-y-3 border border-[rgba(21,21,33,0.08)] bg-white p-4 sm:p-5 shadow-[0_4px_20px_rgba(21,21,33,0.06)]">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Comentário (opcional)
        </label>
        <textarea
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Algum recado pra equipe?"
          className="input mt-1 resize-y text-[13px]"
          disabled={loading || !!done}
        />
      </div>

      {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}

      {done ? (
        <div className="text-center">
          <div className="text-[14px] font-semibold text-ink">
            {done === 'aprovado' ? '✅ Aprovado pelo cliente' : '🔁 Alteração solicitada'}
          </div>
          <p className="mt-1 text-[12px] text-mauve">
            {done === 'aprovado'
              ? 'A gente segue daqui.'
              : 'A gente vai ajustar e te avisa quando estiver pronto.'}
          </p>
          <p className="mt-2 text-[11px] text-t3">
            {voltarPara === '/' ? 'Voltando pro dashboard…' : 'Voltando pra etapa…'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div
            className="rounded-lg px-3 py-2 text-[12px] leading-snug"
            style={{
              background: temComentario
                ? 'var(--prazo-hoje-soft)'
                : 'var(--prazo-em-dia-soft)',
              color: temComentario ? 'var(--prazo-hoje)' : 'var(--prazo-em-dia)',
            }}
          >
            {temComentario ? (
              <>
                Você adicionou um comentário. Clique em{' '}
                <b>Enviar pedido de alteração</b> pra mandar pra equipe ajustar.
              </>
            ) : (
              <>
                Tudo certo com a pauta? Clique em <b>Aprovar</b> pra liberar a
                produção.
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={aprovar}
              disabled={loading}
              className={`${temComentario ? 'btn-ghost' : 'btn-primary'} w-full justify-center whitespace-nowrap`}
              style={
                temComentario ? undefined : { background: 'var(--prazo-em-dia)' }
              }
            >
              {modo === 'aprovando' ? 'Aprovando…' : '✓ Aprovar'}
            </button>
            <button
              type="button"
              onClick={pedirAlteracao}
              disabled={loading}
              className={`${temComentario ? 'btn-primary' : 'btn-ghost'} w-full justify-center whitespace-nowrap`}
              style={
                temComentario ? { background: 'var(--prazo-hoje)' } : undefined
              }
            >
              {modo === 'pedindoAlteracao'
                ? 'Enviando…'
                : temComentario
                  ? '✏️ Enviar alteração'
                  : 'Pedir alteração'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
