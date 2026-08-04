'use client';

import { useEffect, useState } from 'react';

type Conta = {
  igUserId: string;
  username: string;
  name: string;
  profilePicture: string | null;
  followersCount: number;
  pageName: string;
};

export function IgTesteView() {
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [erroContas, setErroContas] = useState<string | null>(null);
  const [igUserId, setIgUserId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<
    { ok: true; permalink: string | null } | { ok: false; error: string; etapa?: string } | null
  >(null);

  // Modo "post real": resolve a arte do Drive e publica.
  const [postId, setPostId] = useState('');
  const [midia, setMidia] = useState<
    { formato: string; itens: { fileId: string; nome: string; tipo: string; url: string }[]; legenda: string } | null
  >(null);
  const [carregandoMidia, setCarregandoMidia] = useState(false);
  const [erroMidia, setErroMidia] = useState<string | null>(null);

  // Carrega as contas que o token enxerga (acha o @lud.digital automaticamente).
  useEffect(() => {
    fetch('/api/admin/ig-teste')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setErroContas(j.error); return; }
        setContas(j.contas ?? []);
        const lud = (j.contas ?? []).find((c: Conta) =>
          c.username.toLowerCase().includes('lud'),
        );
        if (lud) setIgUserId(lud.igUserId);
      })
      .catch((e) => setErroContas(String(e)));
  }, []);

  async function publicar() {
    setPublicando(true);
    setResultado(null);
    try {
      const r = await fetch('/api/admin/ig-teste', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ igUserId, imageUrl, caption }),
      });
      const j = await r.json();
      if (!r.ok) {
        setResultado({ ok: false, error: j.error ?? `HTTP ${r.status}`, etapa: j.etapa });
      } else {
        setResultado({ ok: true, permalink: j.permalink ?? null });
      }
    } catch (e: any) {
      setResultado({ ok: false, error: e?.message ?? 'erro de rede' });
    } finally {
      setPublicando(false);
    }
  }

  async function carregarMidia() {
    setCarregandoMidia(true);
    setErroMidia(null);
    setMidia(null);
    try {
      const r = await fetch(`/api/admin/ig-teste?postId=${encodeURIComponent(postId)}`);
      const j = await r.json();
      if (j.erro || j.error) { setErroMidia(j.erro ?? j.error); return; }
      setMidia(j.midia);
    } catch (e: any) {
      setErroMidia(e?.message ?? 'erro');
    } finally {
      setCarregandoMidia(false);
    }
  }

  async function publicarPost() {
    setPublicando(true);
    setResultado(null);
    try {
      const r = await fetch('/api/admin/ig-teste', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ igUserId, postId }),
      });
      const j = await r.json();
      if (!r.ok) setResultado({ ok: false, error: j.error ?? `HTTP ${r.status}`, etapa: j.etapa });
      else setResultado({ ok: true, permalink: j.permalink ?? null });
    } catch (e: any) {
      setResultado({ ok: false, error: e?.message ?? 'erro de rede' });
    } finally {
      setPublicando(false);
    }
  }

  const contaSel = contas?.find((c) => c.igUserId === igUserId);
  const podePublicar = !!igUserId && /^https:\/\/.+/i.test(imageUrl) && !publicando;

  return (
    <div className="space-y-5">
      {/* Contas detectadas */}
      <section className="card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          1 · Conta
        </div>
        {erroContas ? (
          <p className="mt-2 rounded-lg bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] text-[var(--prazo-atrasado)]">
            Não deu pra listar as contas: {erroContas}
            <br />
            <span className="text-t2">
              Provável causa: o token não tem permissão de Instagram/Páginas. Veja o checklist abaixo.
            </span>
          </p>
        ) : contas === null ? (
          <p className="mt-2 text-[12px] text-t3">Detectando contas do token…</p>
        ) : contas.length === 0 ? (
          <p className="mt-2 text-[12px] text-t3">
            O token não enxerga nenhuma conta Instagram. Confira o checklist abaixo.
          </p>
        ) : (
          <select
            value={igUserId}
            onChange={(e) => setIgUserId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
          >
            <option value="">Escolha a conta…</option>
            {contas.map((c) => (
              <option key={c.igUserId} value={c.igUserId}>
                @{c.username} {c.pageName ? `· ${c.pageName}` : ''} (id {c.igUserId})
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Post real (arte do Drive) */}
      <section className="card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          2 · Publicar a arte real de um post
        </div>
        <p className="mt-0.5 text-[11px] text-t3">
          Cola o <b>id ou link</b> de um post (Notion). Puxa a arte do Drive, monta imagem/carrossel/Reels
          e publica na conta escolhida. <b>Só funciona no deploy publicado</b> (a Meta não acessa localhost).
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
            placeholder="id do post ou link do Notion"
            className="flex-1 rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
          />
          <button
            type="button"
            onClick={carregarMidia}
            disabled={!postId.trim() || carregandoMidia}
            className="rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[12px] font-medium text-t2 transition hover:text-ink disabled:opacity-40"
          >
            {carregandoMidia ? 'Carregando…' : 'Carregar arte'}
          </button>
        </div>

        {erroMidia && (
          <p className="mt-2 rounded-lg bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] text-[var(--prazo-atrasado)]">
            {erroMidia}
          </p>
        )}

        {midia && (
          <div className="mt-3 rounded-lg bg-bgSoft/60 p-3">
            <div className="text-[12px] text-t2">
              Formato: <b className="text-ink">{midia.formato}</b> · {midia.itens.length} mídia(s)
            </div>
            {midia.itens[0]?.url.includes('localhost') && (
              <p className="mt-2 rounded-lg bg-[var(--prazo-chegando-soft)] px-3 py-2 text-[11px] text-[var(--prazo-chegando)]">
                ⚠️ A URL da mídia é <b>localhost</b> — a Meta não alcança seu computador. Publicar
                daqui vai falhar. Rode este teste no <b>deploy (Vercel)</b>.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {midia.itens.map((it) => (
                <div key={it.fileId} className="w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={it.nome} className="h-16 w-16 rounded object-cover" />
                  <div className="mt-0.5 truncate text-[9px] text-t3" title={it.nome}>
                    {it.tipo === 'video' ? '🎬 ' : ''}{it.nome}
                  </div>
                </div>
              ))}
            </div>
            {midia.legenda && (
              <p className="mt-2 line-clamp-3 whitespace-pre-line text-[11px] text-t3">{midia.legenda}</p>
            )}
            <button
              type="button"
              onClick={publicarPost}
              disabled={!igUserId || publicando}
              className="btn-primary mt-3 justify-center whitespace-nowrap disabled:opacity-40"
            >
              {publicando ? 'Publicando…' : `Publicar esse post agora${contaSel ? ` no @${contaSel.username}` : ''}`}
            </button>
          </div>
        )}
      </section>

      {/* Imagem */}
      <section className="card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          3 · Ou publicar uma imagem por URL (teste manual)
        </div>
        <p className="mt-0.5 text-[11px] text-t3">
          Precisa ser uma URL pública https:// de um JPEG/PNG (a Meta é que baixa a imagem).
          Pra este primeiro teste, cole uma imagem pública qualquer. Depois ligamos a arte do Drive.
        </p>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…/foto.jpg"
          className="mt-2 w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
        />
      </section>

      {/* Legenda */}
      <section className="card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          4 · Legenda (do teste manual por URL)
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          placeholder="Legenda do post de teste…"
          className="mt-2 w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] leading-[1.55] text-ink"
        />
      </section>

      {/* Publicar */}
      <div className="rounded-xl border-2 border-dashed border-[var(--prazo-atrasado)]/40 bg-[var(--prazo-atrasado-soft)]/40 p-4">
        <p className="mb-3 text-[12px] leading-[1.5] text-t2">
          ⚠️ Isso publica <b>AGORA de verdade</b>
          {contaSel ? <> no <b>@{contaSel.username}</b></> : ' na conta selecionada'}. Não é rascunho.
        </p>
        <button
          type="button"
          onClick={publicar}
          disabled={!podePublicar}
          className="btn-primary justify-center whitespace-nowrap disabled:opacity-40"
        >
          {publicando ? 'Publicando…' : 'Publicar agora no Instagram'}
        </button>
      </div>

      {/* Resultado */}
      {resultado && (
        resultado.ok ? (
          <div className="rounded-xl border border-[var(--prazo-em-dia)]/30 bg-[var(--prazo-em-dia-soft)]/50 p-4 text-[13px] text-t2">
            ✓ Publicado!{' '}
            {resultado.permalink ? (
              <a href={resultado.permalink} target="_blank" rel="noreferrer" className="font-semibold text-ink underline">
                ver no Instagram ↗
              </a>
            ) : (
              'Confere no app do Instagram.'
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-[var(--prazo-atrasado-soft)] p-4 text-[13px] text-[var(--prazo-atrasado)]">
            ⚠️ Falhou{resultado.etapa ? ` (etapa: ${resultado.etapa})` : ''}: {resultado.error}
          </div>
        )
      )}

      {/* Checklist */}
      <details className="rounded-xl border border-[rgba(21,21,33,0.1)] bg-bgSoft/40 p-4 text-[12px] text-t2">
        <summary className="cursor-pointer font-semibold text-ink">
          Checklist do Meta (se der erro de permissão)
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>@lud.digital precisa ser conta <b>Business ou Creator</b>, ligada a uma <b>Página do Facebook</b>.</li>
          <li>O <code>IG_GRAPH_TOKEN</code> (System User do Business Manager) precisa das permissões <b>instagram_content_publish</b>, <b>instagram_basic</b>, <b>pages_read_engagement</b>.</li>
          <li>A Página e a conta IG precisam estar atribuídas ao System User no Business Manager.</li>
        </ol>
      </details>
    </div>
  );
}
