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

/** Cria/edita a Ideia do post em modo RASCUNHO (Supabase). Cliente só vê
 *  depois que a equipe clica "Publicar pra cliente" — aí escreve no Notion.
 *  Autosave debounced (900ms) mantém o rascunho persistido cross-device. */
export function IdeiaConstrucao({
  postId,
  ideiaNotion,
  rascunhoInicial,
}: {
  postId: string;
  ideiaNotion: string;      // versão que o cliente vê hoje
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

  // Autosave debounced — só salva se texto mudou desde o carregamento
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

  async function publicar() {
    // Se tem edição pendente, salva antes de publicar
    if (timerRef.current) clearTimeout(timerRef.current);
    setPublicando(true);
    setErro(null);
    try {
      // Salva o rascunho atual imediatamente
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
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Ideia do post
        </div>
        <StatusBadge pendente={!!pendente} publicadoEm={publicadoEm} />
      </div>

      <div className="mt-3">
        <label className="label">Rascunho (só a equipe vê)</label>
        <textarea
          rows={7}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva a ideia do post — o ângulo, o tom, o que o cliente vai ver…"
          className="input min-h-[160px] resize-y text-[13px] leading-[1.55]"
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
        <p
          className="mt-2 rounded-lg px-3 py-2 text-[11.5px] font-medium"
          style={{ background: 'rgba(224,49,49,0.08)', color: '#E03131' }}
        >
          {erro}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={publicar}
          disabled={publicando || !temTexto || !pendente}
          className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
          style={{ background: 'var(--ink)' }}
          title={
            !temTexto
              ? 'Escreva algo primeiro'
              : !pendente
                ? 'Nenhuma edição nova pra publicar'
                : 'Escrever essa versão no Notion — cliente passa a ver'
          }
        >
          {publicando ? 'Publicando…' : '↑ Publicar pra cliente'}
        </button>
        <span className="text-[11px] text-t3">
          {pendente
            ? 'Cliente ainda vê a versão anterior.'
            : publicadoEm
              ? 'Cliente vê essa versão.'
              : 'Cliente ainda não recebeu nenhuma versão.'}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({
  pendente,
  publicadoEm,
}: {
  pendente: boolean;
  publicadoEm: string | null;
}) {
  if (pendente) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{
          background: 'var(--prazo-chegando-soft)',
          color: 'var(--prazo-chegando)',
        }}
      >
        Rascunho não publicado
      </span>
    );
  }
  if (publicadoEm) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{
          background: 'var(--prazo-em-dia-soft)',
          color: 'var(--prazo-em-dia)',
        }}
      >
        Publicado {fmtHa(publicadoEm)}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-t3">
      Sem versão publicada
    </span>
  );
}
