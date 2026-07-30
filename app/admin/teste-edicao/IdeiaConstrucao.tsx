'use client';

import { useEffect, useRef, useState } from 'react';

type Rascunho = {
  ideia_texto: string;
  atualizado_em: string;
  publicado_em: string | null;
} | null;

function fmtHa(iso: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso).getTime();
  const diffMs = Date.now() - dt;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} d`;
}

/** Rascunho da Ideia (autosave). Fluxo novo: NÃO publica por post — a
 *  publicação vai em lote pela página de Revisão. Mantido só um link
 *  discreto "publicar só esse agora" pra caso de urgência. */
export function IdeiaConstrucao({
  postId,
  ideiaNotion,
  rascunhoInicial,
}: {
  postId: string;
  ideiaNotion: string;
  rascunhoInicial: Rascunho;
}) {
  const [texto, setTexto] = useState(rascunhoInicial?.ideia_texto ?? ideiaNotion ?? '');
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(rascunhoInicial?.atualizado_em ?? null);
  const [publicadoEm, setPublicadoEm] = useState<string | null>(rascunhoInicial?.publicado_em ?? null);
  const [salvando, setSalvando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoFlash, setSalvoFlash] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const primeiroRenderRef = useRef(true);

  useEffect(() => {
    if (primeiroRenderRef.current) {
      primeiroRenderRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSalvando(true);
      setErro(null);
      try {
        const res = await fetch(`/api/pauta/${postId}/rascunho`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ideia_texto: texto }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
        setAtualizadoEm(data.atualizado_em);
        setSalvoFlash(true);
        setTimeout(() => setSalvoFlash(false), 1500);
      } catch (e: any) {
        setErro(e.message);
      } finally {
        setSalvando(false);
      }
    }, 900);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  async function publicarUrgente() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!confirm('Publicar só ESSA pauta pro cliente agora, sem esperar o lote do mês?')) {
      return;
    }
    setPublicando(true);
    setErro(null);
    try {
      await fetch(`/api/pauta/${postId}/rascunho`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ideia_texto: texto }),
      });
      const res = await fetch(`/api/pauta/${postId}/publicar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setPublicadoEm(data.publicado_em);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setPublicando(false);
    }
  }

  const temTexto = texto.trim().length > 0;
  const pendente =
    temTexto &&
    (!publicadoEm ||
      (atualizadoEm && new Date(atualizadoEm) > new Date(publicadoEm)));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="label mb-0">Ideia do post</div>
        {publicadoEm && !pendente && (
          <span className="entrega-status-pill em-dia">
            Publicado {fmtHa(publicadoEm)}
          </span>
        )}
      </div>

      <div className="mt-3">
        <textarea
          rows={7}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva a ideia do post — o ângulo, o tom, o que o cliente vai ver…"
          className="input min-h-[160px] resize-y text-[13px]"
          disabled={publicando}
        />
        <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-t3">
          <span>
            {salvando
              ? 'Salvando rascunho…'
              : salvoFlash
                ? '✓ Rascunho salvo'
                : atualizadoEm
                  ? `Rascunho salvo ${fmtHa(atualizadoEm)}`
                  : 'Rascunho ainda não salvo'}
          </span>
          <span>autosave</span>
        </div>
      </div>

      {erro && (
        <p className="prazo-pill atrasado mt-3">
          <span className="prazo-dot"></span>{erro}
        </p>
      )}

      {temTexto && pendente && (
        <div className="mt-3 pt-3 border-t border-[rgba(21,21,33,0.06)]">
          <button
            type="button"
            onClick={publicarUrgente}
            disabled={publicando}
            className="text-[11px] font-medium text-mauve hover:text-ink disabled:opacity-50"
          >
            {publicando ? 'Publicando…' : '↑ publicar só esse agora (urgente)'}
          </button>
          <span className="ml-2 text-[10.5px] text-t3">
            — normalmente todos do mês publicam juntos na Revisão
          </span>
        </div>
      )}
    </div>
  );
}
