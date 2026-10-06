'use client';

import { useState } from 'react';

/**
 * Gerador de magic link pra dar pra uma IA (ChatGPT, Claude, etc) acessar
 * o portal sem senha. A URL abre uma vez, cria sessão de 30 dias no browser
 * que abrir. Link expira em 7 dias caso não seja usado.
 */
export function GeradorLinkIA({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [rotulo, setRotulo] = useState('ChatGPT');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ url: string; expiresAt: string } | null>(
    null,
  );
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setGerando(true);
    setErro(null);
    setResultado(null);
    setCopiado(false);
    try {
      const res = await fetch('/api/admin/gerar-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setResultado({ url: j.url, expiresAt: j.expiresAt });
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro('não deu pra copiar — copia manual');
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-4">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            Nome ou apelido da IA
          </label>
          <input
            type="text"
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
            placeholder="ChatGPT, Claude, Gemini…"
            className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
          />
          <p className="mt-1 text-[10.5px] text-t3">
            Só pra você identificar quem tá acessando. Aparece na coluna &quot;Pessoa&quot; nos comentários.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            E-mail que a IA vai representar
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ia@lud.digital"
            className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
          />
          <p className="mt-1 text-[10.5px] text-t3">
            Se o e-mail estiver na lista de admins, a IA vê tudo. Se for de um cliente,
            vê só o que aquele cliente vê. Pra visão &quot;Lud.&quot; interna, use um e-mail admin.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          {erro && (
            <span className="text-[11px] font-medium text-[var(--prazo-atrasado)]">
              {erro}
            </span>
          )}
          <button
            type="button"
            onClick={gerar}
            disabled={gerando || !email.includes('@')}
            className="btn-primary text-[12px] disabled:opacity-40"
          >
            {gerando ? 'gerando…' : 'Gerar link'}
          </button>
        </div>
      </div>

      {resultado && (
        <div className="card p-5 space-y-3 border-2 border-[var(--cal-aprovacao)]/30">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--cal-aprovacao)]">
              Link pronto pra {rotulo || 'a IA'}
            </div>
            <span className="text-[10px] text-t3">
              expira {new Date(resultado.expiresAt).toLocaleDateString('pt-BR')}
            </span>
          </div>

          <div className="rounded-lg border border-[rgba(21,21,33,0.13)] bg-bgSoft/40 p-3 font-mono text-[11px] leading-[1.5] text-ink break-all">
            {resultado.url}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copiar}
              className="btn-primary text-[12px]"
            >
              {copiado ? '✓ copiado' : '📋 copiar link'}
            </button>
            <a
              href={resultado.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-2 text-[12px] font-semibold text-ink transition hover:bg-bgSoft"
            >
              testar em nova aba ↗
            </a>
          </div>

          <div className="rounded-lg bg-[var(--cal-aprovacao-soft)]/40 p-3 text-[12px] leading-[1.55] text-t1">
            <div className="mb-1 font-semibold">Como usar com {rotulo || 'a IA'}:</div>
            <ol className="ml-4 list-decimal space-y-1 text-t2">
              <li>
                Copia o link acima e cola no prompt da IA junto com o que você quer que ela veja/faça no portal.
              </li>
              <li>
                Peça pra ela usar a ferramenta de navegação/web pra abrir a URL.
                Depois que abrir uma vez, a sessão dura 30 dias na conversa dela.
              </li>
              <li>
                Se ela abrir num navegador anônimo próprio (Claude/Chrome), a sessão também vale 30 dias naquele browser.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
