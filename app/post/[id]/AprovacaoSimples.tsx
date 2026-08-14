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
  labelComentario,
  placeholderComentario,
  esconderTextarea = false,
  comentarioExterno,
  semCardWrapper = false,
  respostasObrigatorias = false,
  mensagemBloqueio,
}: {
  tarefaId: string;
  tarefaTitulo: string;
  voltarPara?: string;
  aprovacaoColaborativa?: boolean;
  /** Sobrescreve o label do textarea (padrão: "Comentário (opcional)"). */
  labelComentario?: string;
  /** Sobrescreve o placeholder do textarea. */
  placeholderComentario?: string;
  /** Não renderiza o textarea local (o texto vem de fora via comentarioExterno). */
  esconderTextarea?: boolean;
  /** Comentário controlado externamente (usado com esconderTextarea=true). */
  comentarioExterno?: string;
  /** Não usa o wrapper .card externo — pra quando renderizado dentro de outro card. */
  semCardWrapper?: boolean;
  /** Quando true, Aprovar/Pedir alteração ficam bloqueados sem comentarioExterno.
   *  Usado quando o post tem perguntas do briefing pra garantir que o cliente
   *  responda antes de continuar. */
  respostasObrigatorias?: boolean;
  /** Texto do aviso mostrado quando o botão fica bloqueado. */
  mensagemBloqueio?: string;
}) {
  const router = useRouter();
  const [comentario, setComentario] = useState('');
  const [pedidoAlteracao, setPedidoAlteracao] = useState('');
  const [preparandoAlteracao, setPreparandoAlteracao] = useState(false);
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

  // Comentário efetivo: se veio de fora (esconderTextarea), usa o externo;
  // senão usa o que o próprio componente segura.
  const comentarioEfetivo = (comentarioExterno ?? comentario).trim();
  const temComentario = comentarioEfetivo !== '';
  // Se respostas são obrigatórias e o cliente não escreveu nada, bloqueia
  // Aprovar/Pedir alteração até ele responder.
  const bloqueadoPorRespostas =
    respostasObrigatorias && !temComentario && !preparandoAlteracao;

  async function aprovar() {
    if (bloqueadoPorRespostas) {
      setError(
        mensagemBloqueio ??
          'Responde as perguntas do bloco Informações antes de aprovar.',
      );
      return;
    }
    setLoading(true);
    setError(null);
    setModo('aprovando');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/aprovar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentarioEfetivo || undefined }),
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
    // Modo "esconderTextarea" (bloco 3 da etapa pauta): primeiro clique abre
    // o textarea inline; segundo clique envia. Assim o cliente tem onde
    // escrever o que precisa mudar sem duplicar textarea na tela.
    if (esconderTextarea && !preparandoAlteracao) {
      setPreparandoAlteracao(true);
      setError(null);
      return;
    }

    // Texto do pedido de alteração — vem do textarea local, seja o normal
    // ou o "inline" que aparece com esconderTextarea+preparandoAlteracao.
    const textoAlteracao = esconderTextarea
      ? pedidoAlteracao.trim()
      : comentarioEfetivo;

    if (textoAlteracao.length < 3) {
      setError('Conta o que precisa ajustar antes de pedir alteração.');
      return;
    }

    // Se veio resposta do bloco 1 (comentarioExterno) + pedido de alteração,
    // combina os dois — a equipe recebe as duas informações no comentário.
    const partes: string[] = [];
    if (esconderTextarea && comentarioExterno && comentarioExterno.trim()) {
      partes.push(`Suas respostas: ${comentarioExterno.trim()}`);
      partes.push('');
    }
    partes.push(
      esconderTextarea
        ? `O que precisa mudar: ${textoAlteracao}`
        : textoAlteracao,
    );
    const comentarioFinal = partes.join('\n');

    setLoading(true);
    setError(null);
    setModo('pedindoAlteracao');
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/alterar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentarioFinal }),
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
    if (comentarioEfetivo.length < 2) {
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
        body: JSON.stringify({ comentario: comentarioEfetivo }),
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
    <div
      className={
        semCardWrapper
          ? 'space-y-4'
          : 'card space-y-4 border border-[rgba(21,21,33,0.08)] bg-white p-5 sm:p-6'
      }
    >
      {!esconderTextarea && (
        <div>
          <label className="label">
            {labelComentario ??
              (aprovacaoColaborativa ? 'Comentário da equipe' : 'Comentário (opcional)')}
          </label>
          <textarea
            rows={aprovacaoColaborativa ? 6 : 4}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={
              placeholderComentario ??
              (aprovacaoColaborativa
                ? 'Escreve seu feedback aqui. Vários da equipe podem comentar — só Aprovar/Reprovar fecham o post.'
                : 'Algum recado pra equipe?')
            }
            className="input resize-y text-[13px]"
            disabled={loading || !!done}
          />
        </div>
      )}
      {esconderTextarea && temComentario && !done && !preparandoAlteracao && (
        <p className="text-[11px] italic text-t3">
          Vamos enviar sua resposta acima junto com a aprovação.
        </p>
      )}

      {bloqueadoPorRespostas && !done && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]"
          style={{
            background: 'var(--prazo-chegando-soft)',
            borderColor: 'rgba(199,161,46,0.35)',
            color: '#7A5A00',
          }}
        >
          <span aria-hidden className="mt-0.5">📝</span>
          <div>
            <b>Precisamos das suas respostas antes de continuar.</b>{' '}
            {mensagemBloqueio ??
              'Responde as perguntas do bloco Informações — assim a equipe consegue seguir com o que você quer.'}
          </div>
        </div>
      )}

      {esconderTextarea && preparandoAlteracao && !done && (
        <div>
          <label className="label">O que precisa mudar?</label>
          <textarea
            rows={4}
            autoFocus
            value={pedidoAlteracao}
            onChange={(e) => setPedidoAlteracao(e.target.value)}
            placeholder="Conta o que você quer que a gente ajuste no tema/pauta."
            className="input resize-y text-[13px]"
            disabled={loading}
          />
          {temComentario && (
            <p className="mt-1.5 text-[11px] italic text-t3">
              Suas respostas do bloco Informações vão junto.
            </p>
          )}
        </div>
      )}

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
          {/* Comentar (só faz sentido quando tem texto no bloco 1 ou no textarea local) */}
          {!(esconderTextarea && preparandoAlteracao) && (
            <button
              type="button"
              onClick={comentarSemEncerrar}
              disabled={loading || !temComentario}
              className="btn-primary w-full justify-center whitespace-nowrap"
            >
              {modo === 'comentando' ? 'Enviando…' : '💬 Enviar comentário'}
            </button>
          )}

          {!(esconderTextarea && preparandoAlteracao) && (
            <div className="relative pt-1">
              <div className="absolute inset-x-0 top-1/2 h-px bg-[rgba(21,21,33,0.08)]" />
              <div className="relative mx-auto inline-flex w-full justify-center">
                <span className="bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
                  Quando o feedback estiver final
                </span>
              </div>
            </div>
          )}

          {esconderTextarea && preparandoAlteracao ? (
            // Fluxo em 2 passos: textarea "O que precisa mudar?" já expandido acima.
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,auto]">
              <button
                type="button"
                onClick={pedirAlteracao}
                disabled={loading || pedidoAlteracao.trim().length < 3}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--prazo-hoje)' }}
              >
                {modo === 'pedindoAlteracao'
                  ? 'Enviando…'
                  : '✏️ Enviar pedido de alteração'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreparandoAlteracao(false);
                  setPedidoAlteracao('');
                  setError(null);
                }}
                disabled={loading}
                className="btn-ghost whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={aprovar}
                disabled={loading || bloqueadoPorRespostas}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--prazo-em-dia)' }}
              >
                {modo === 'aprovando' ? 'Aprovando…' : '✓ Aprovar'}
              </button>
              <button
                type="button"
                onClick={pedirAlteracao}
                disabled={
                  loading ||
                  bloqueadoPorRespostas ||
                  (!esconderTextarea && !temComentario)
                }
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
          )}
        </div>
      ) : (
        // ===== MODO INDIVIDUAL (padrão) =====
        <div className="space-y-2.5">
          {!(esconderTextarea && preparandoAlteracao) && (
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
          )}

          {esconderTextarea && preparandoAlteracao ? (
            // Fluxo em 2 passos: textarea "O que precisa mudar?" já expandido acima,
            // aqui só os botões Enviar / Cancelar.
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,auto]">
              <button
                type="button"
                onClick={pedirAlteracao}
                disabled={loading || pedidoAlteracao.trim().length < 3}
                className="btn-primary w-full justify-center whitespace-nowrap"
                style={{ background: 'var(--prazo-hoje)' }}
              >
                {modo === 'pedindoAlteracao'
                  ? 'Enviando…'
                  : '✏️ Enviar pedido de alteração'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreparandoAlteracao(false);
                  setPedidoAlteracao('');
                  setError(null);
                }}
                disabled={loading}
                className="btn-ghost whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={aprovar}
                disabled={loading || bloqueadoPorRespostas}
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
                disabled={loading || bloqueadoPorRespostas}
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
          )}
        </div>
      )}
    </div>
  );
}
