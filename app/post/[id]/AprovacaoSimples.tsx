'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Modo = 'idle' | 'aprovando' | 'pedindoAlteracao' | 'comentando';

/**
 * Caixa de aprovação simples: usada em fluxos sem preview/carrossel
 * (ex: Aprovação de Tema). Mesma lógica dinâmica de botões do PostPreview.
 *
 * Quando `aprovacaoColaborativa` é true (cliente com time grande tipo TKRA),
 * adiciona um botão extra "Comentar" que só anexa o comentário no post sem
 * encerrar a tarefa — Aprovar/Reprovar continuam fechando.
 */
export function AprovacaoSimples({
  tarefaId,
  tarefaTitulo,
  voltarPara = '/',
  aprovacaoColaborativa = false,
}: {
  tarefaId: string;
  tarefaTitulo: string;
  voltarPara?: string;
  aprovacaoColaborativa?: boolean;
}) {
  const router = useRouter();
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<Modo>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'aprovado' | 'alteracao' | 'comentado' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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

  async function comentarSemEncerrar() {
    if (comentario.trim().length < 2) {
      setError('Escreve algo antes de comentar.');
      return;
    }
    setLoading(true);
    setError(null);
    setModo('comentando');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/comentar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      limparRascunho();
      setComentario('');
      setAviso('Comentário enviado. O post continua aberto pros outros opinarem.');
      setTimeout(() => setAviso(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setModo('idle');
    }
  }

  return (
    <div className="card sticky bottom-2 sm:bottom-6 z-20 space-y-4 border border-[rgba(21,21,33,0.08)] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(21,21,33,0.06)]">
      <div>
        <label className="label">
          {aprovacaoColaborativa ? 'Comentário da equipe' : 'Comentário (opcional)'}
        </label>
        <textarea
          rows={aprovacaoColaborativa ? 6 : 4}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder={
            aprovacaoColaborativa
              ? 'Escreve seu feedback aqui. Vários da equipe podem comentar — só Aprovar/Reprovar fecham o post.'
              : 'Algum recado pra equipe?'
          }
          className="input resize-y text-[13px]"
          disabled={loading || !!done}
        />
      </div>

      {error && <p className="text-[12px] font-medium text-hubRed">{error}</p>}
      {aviso && (
        <p className="rounded-md bg-[var(--prazo-em-dia-soft)] px-3 py-2 text-[12px] text-[var(--prazo-em-dia)]">
          {aviso}
        </p>
      )}

      {done ? (
        <div className="text-center">
          <div className="text-[14px] font-semibold text-ink">
            {done === 'aprovado'
              ? '✅ Aprovado pelo cliente'
              : done === 'alteracao'
                ? '🔁 Alteração solicitada'
                : '💬 Comentário registrado'}
          </div>
          <p className="mt-1 text-[12px] text-mauve">
            {done === 'aprovado'
              ? 'A gente segue daqui.'
              : done === 'alteracao'
                ? 'A gente vai ajustar e te avisa quando estiver pronto.'
                : 'Seu comentário foi anexado ao post.'}
          </p>
          <p className="mt-2 text-[11px] text-t3">
            {voltarPara === '/' ? 'Voltando pro dashboard…' : 'Voltando pra etapa…'}
          </p>
        </div>
      ) : aprovacaoColaborativa ? (
        // ===== MODO COLABORATIVO =====
        <div className="space-y-5">
          {/* Bloco 1: comentar */}
          <button
            type="button"
            onClick={comentarSemEncerrar}
            disabled={loading || !temComentario}
            className="btn-primary w-full justify-center whitespace-nowrap"
          >
            {modo === 'comentando' ? 'Enviando…' : '💬 Enviar comentário'}
          </button>

          {/* Separador com rótulo */}
          <div className="relative pt-1">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[rgba(21,21,33,0.08)]" />
            <div className="relative mx-auto inline-flex w-full justify-center">
              <span className="bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
                Quando o feedback estiver final
              </span>
            </div>
          </div>

          {/* Bloco 2: encerrar */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={aprovar}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--prazo-em-dia)' }}
            >
              {modo === 'aprovando' ? 'Aprovando…' : '✓ Aprovar'}
            </button>
            <button
              type="button"
              onClick={pedirAlteracao}
              disabled={loading || !temComentario}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[rgba(21,21,33,0.1)] px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'var(--prazo-hoje-soft)',
                color: 'var(--prazo-hoje)',
                borderColor: 'var(--prazo-hoje)',
              }}
            >
              {modo === 'pedindoAlteracao' ? 'Enviando…' : '✏️ Reprovar'}
            </button>
          </div>
        </div>
      ) : (
        // ===== MODO INDIVIDUAL (padrão) =====
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
                Tudo certo com o tema? Clique em <b>Aprovar</b> pra liberar a
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
