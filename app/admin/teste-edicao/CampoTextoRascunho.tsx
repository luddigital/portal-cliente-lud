'use client';

import { useEffect, useRef, useState } from 'react';

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

/** Campo de texto simples com autosave no rascunho_pauta. Usado pros
 *  campos Informações que precisamos, Materiais que precisamos etc. — sem
 *  botão de publicar individual (publicação vai em lote pela Revisão). */
export function CampoTextoRascunho({
  postId,
  campo,
  label,
  placeholder,
  valorInicial,
  atualizadoEmInicial,
}: {
  postId: string;
  campo: 'informacoes_texto' | 'materiais_texto' | 'referencias_texto';
  label: string;
  placeholder: string;
  valorInicial: string;
  atualizadoEmInicial: string | null;
}) {
  const [texto, setTexto] = useState(valorInicial);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(atualizadoEmInicial);
  const [salvando, setSalvando] = useState(false);
  const [salvoFlash, setSalvoFlash] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
          body: JSON.stringify({ [campo]: texto }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? `Erro ${res.status}`);
        setAtualizadoEm(d.atualizado_em);
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

  return (
    <div className="card p-5">
      <div className="label mb-2">{label}</div>
      <textarea
        rows={5}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className="input min-h-[100px] resize-y text-[13px]"
      />
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-t3">
        <span>
          {salvando
            ? 'Salvando…'
            : salvoFlash
              ? '✓ Rascunho salvo'
              : atualizadoEm
                ? `Rascunho salvo ${fmtHa(atualizadoEm)}`
                : 'Rascunho ainda não salvo'}
        </span>
        <span>autosave</span>
      </div>
      {erro && (
        <p className="prazo-pill atrasado mt-3">
          <span className="prazo-dot"></span>{erro}
        </p>
      )}
    </div>
  );
}
