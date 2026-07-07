'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PostCalendario, ProjetoListItem } from '@/lib/notion';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const COR_STATUS: Record<PostCalendario['cor'], { bg: string; fg: string; label: string }> = {
  rascunho: { bg: 'var(--cal-rascunho-soft)', fg: 'var(--cal-rascunho)', label: 'Rascunho' },
  aprovacao: { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)', label: 'Aprovação' },
  alteracao: { bg: 'var(--cal-alteracao-soft)', fg: 'var(--cal-alteracao)', label: 'Alteração' },
  aguardando: { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)', label: 'Aguardando' },
  agendado: { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)', label: 'Agendado' },
  publicado: { bg: 'var(--prazo-em-dia-soft)', fg: 'var(--prazo-em-dia)', label: 'Publicado' },
};

/** Título de post que veio como URL (s3, drive, etc) → "Sem título". */
function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim) return 'Sem título';
  // Detecta URLs sem espaço no meio
  if (/^https?:\/\/\S+$/.test(trim) && !trim.includes(' ')) return 'Sem título';
  return trim;
}

function ehHoje(dia: number, mes: number, ano: number): boolean {
  const h = new Date();
  return dia === h.getDate() && mes === h.getMonth() + 1 && ano === h.getFullYear();
}

export function ProgramacaoView({
  projetos,
  projetoIdSelecionado,
  year,
  month,
  posts,
  thumbnails,
}: {
  projetos: ProjetoListItem[];
  projetoIdSelecionado: string;
  year: number;
  month: number;
  posts: PostCalendario[];
  thumbnails: Record<string, string | null>;
}) {
  const router = useRouter();
  const [postAberto, setPostAberto] = useState<PostCalendario | null>(null);

  function irPara(deltaMes: number) {
    let novoMes = month + deltaMes;
    let novoAno = year;
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    else if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    const params = new URLSearchParams({
      projetoId: projetoIdSelecionado,
      year: String(novoAno),
      month: String(novoMes),
    });
    router.push(`/programacao?${params.toString()}`);
  }

  function trocarProjeto(id: string) {
    const params = new URLSearchParams({
      projetoId: id,
      year: String(year),
      month: String(month),
    });
    router.push(`/programacao?${params.toString()}`);
  }

  const primeiro = new Date(year, month - 1, 1);
  const ultimoDia = new Date(year, month, 0).getDate();
  const offset = primeiro.getDay();
  const totalCelulas = Math.ceil((offset + ultimoDia) / 7) * 7;
  const celulas: (number | null)[] = Array.from({ length: totalCelulas }, (_, i) => {
    const dia = i - offset + 1;
    return dia >= 1 && dia <= ultimoDia ? dia : null;
  });

  const postsPorDia = new Map<number, PostCalendario[]>();
  for (const p of posts) {
    const [, , d] = p.data.split('-').map(Number);
    if (!postsPorDia.has(d)) postsPorDia.set(d, []);
    postsPorDia.get(d)!.push(p);
  }

  const postsPreview = [...posts].sort((a, b) => (a.data < b.data ? 1 : -1));
  const projetoNome = projetos.find((p) => p.id === projetoIdSelecionado)?.nome ?? 'Projeto';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Programação de posts
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={projetoIdSelecionado}
              onChange={(e) => trocarProjeto(e.target.value)}
              className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3 py-1.5 text-[12px] text-ink"
            >
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 rounded-full bg-bgSoft p-1">
              <button
                type="button"
                onClick={() => irPara(-1)}
                className="rounded-full px-3 py-1 text-[12px] text-ink transition hover:bg-white"
              >←</button>
              <span className="min-w-[130px] px-2 text-center text-[12px] font-semibold text-ink">
                {MESES[month - 1]} {year}
              </span>
              <button
                type="button"
                onClick={() => irPara(1)}
                className="rounded-full px-3 py-1 text-[12px] text-ink transition hover:bg-white"
              >→</button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_clamp(320px,26%,400px)] xl:items-start">
          {/* Calendário mensal (ocupa a página quase inteira) */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold text-ink">
                {projetoNome} · {MESES[month - 1]}
              </h2>
              <span className="text-[11px] text-t3">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'} no mês
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
              <div className="grid grid-cols-7 border-b border-[rgba(21,21,33,0.06)] bg-bgSoft/60">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {celulas.map((dia, i) => {
                  const postsDoDia = dia ? postsPorDia.get(dia) ?? [] : [];
                  const hoje = dia ? ehHoje(dia, month, year) : false;
                  return (
                    <div
                      key={i}
                      className={`min-h-[128px] border-b border-r border-[rgba(21,21,33,0.06)] p-1.5 last:border-r-0 ${dia ? 'bg-white' : 'bg-bgSoft/20'} ${hoje ? 'ring-1 ring-inset ring-[var(--cal-agendado)]' : ''}`}
                    >
                      {dia && (
                        <>
                          <div className="mb-1 flex items-baseline justify-between px-1">
                            <span className={`text-[11px] font-semibold ${hoje ? 'text-[var(--cal-agendado)]' : 'text-t2'}`}>{dia}</span>
                            {postsDoDia.length > 0 && (
                              <span className="text-[9px] text-t3">{postsDoDia.length}</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {postsDoDia.map((p) => {
                              const cor = COR_STATUS[p.cor];
                              return (
                                <button
                                  type="button"
                                  key={p.id}
                                  onClick={() => setPostAberto(p)}
                                  className="block w-full rounded-md px-1.5 py-1 text-left text-[10.5px] font-medium leading-tight transition hover:opacity-80"
                                  style={{ background: cor.bg, color: cor.fg }}
                                  title={`${tituloSeguro(p.titulo)} · ${p.etapaLabel}`}
                                >
                                  <div className="flex items-center gap-1">
                                    {p.icon && (
                                      <span aria-hidden className="shrink-0 text-[11px]">{p.icon}</span>
                                    )}
                                    <span className="truncate">{tituloSeguro(p.titulo)}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
              {(['rascunho', 'aprovacao', 'alteracao', 'aguardando', 'agendado', 'publicado'] as const).map((k) => {
                const c = COR_STATUS[k];
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold uppercase tracking-[0.06em]"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
                    {c.label}
                  </span>
                );
              })}
            </div>
          </section>

          {/* Preview do grid IG com thumbnails reais */}
          <aside>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold text-ink">Preview do feed</h2>
              <span className="text-[11px] text-t3">como vai ficar</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-2">
              {postsPreview.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-t3">Nenhum post agendado neste mês.</p>
              ) : (
                <div className="grid grid-cols-3 gap-0.5">
                  {postsPreview.map((p) => {
                    const cor = COR_STATUS[p.cor];
                    const fileId = thumbnails[p.id];
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPostAberto(p)}
                        className="group relative aspect-square overflow-hidden bg-bgSoft transition hover:opacity-90"
                        title={`${tituloSeguro(p.titulo)} · ${p.data}`}
                      >
                        {fileId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/drive/preview/${fileId}`}
                            alt={tituloSeguro(p.titulo)}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="flex h-full items-center justify-center px-1 text-center"
                            style={{ background: cor.bg }}
                          >
                            <span className="line-clamp-3 text-[9px] font-semibold" style={{ color: cor.fg }}>
                              {tituloSeguro(p.titulo)}
                            </span>
                          </div>
                        )}
                        {/* Ring de status na borda */}
                        <span
                          className="pointer-events-none absolute inset-0 ring-2 ring-inset"
                          style={{ '--tw-ring-color': cor.fg } as React.CSSProperties}
                        />
                        {/* Data + status no topo */}
                        <span className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white">
                          {p.data.split('-')[2]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 px-1 text-[10px] text-t3">
                Do topo (mais recente) pro fundo. Borda colorida = status. Sem thumb = ainda sem imagem no Drive.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {postAberto && (
        <PostModal
          post={postAberto}
          thumbnailFileId={thumbnails[postAberto.id] ?? null}
          onClose={() => setPostAberto(null)}
          onProgramado={() => {
            setPostAberto(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PostModal({
  post,
  thumbnailFileId,
  onClose,
  onProgramado,
}: {
  post: PostCalendario;
  thumbnailFileId: string | null;
  onClose: () => void;
  onProgramado: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cor = COR_STATUS[post.cor];

  async function programar() {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch('/api/programar/post', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId: post.id, status: 'Agendado' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setFeito(true);
      setTimeout(onProgramado, 900);
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview da imagem */}
        {thumbnailFileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/drive/preview/${thumbnailFileId}`}
            alt=""
            className="h-56 w-full object-cover"
          />
        ) : (
          <div
            className="flex h-24 items-center justify-center"
            style={{ background: cor.bg, color: cor.fg }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em]">
              {cor.label}
            </span>
          </div>
        )}

        <div className="space-y-4 p-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              {post.etapaLabel}
            </div>
            <h3 className="mt-1 text-[16px] font-semibold leading-snug text-ink">
              {tituloSeguro(post.titulo)}
            </h3>
            <div className="mt-2 text-[12px] text-t2">
              {(() => {
                const [y, m, d] = post.data.split('-');
                return `${d}/${m}/${y}`;
              })()}
              {post.tarefaAtualTitulo && ` · ${post.tarefaAtualTitulo}`}
            </div>
          </div>

          {erro && (
            <p className="rounded-md bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[11px] text-[var(--prazo-atrasado)]">
              ⚠️ {erro}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={programar}
              disabled={loading || feito}
              className="btn-primary flex-1 justify-center whitespace-nowrap"
            >
              {feito
                ? '✓ Programado'
                : loading
                  ? 'Programando…'
                  : '📅 Programar'}
            </button>
            <Link
              href={`/post/${post.id}`}
              className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-2 text-[12px] font-medium text-ink transition hover:bg-bgSoft"
            >
              Abrir post →
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-bgSoft px-4 py-2 text-[12px] text-t2 transition hover:bg-white hover:text-ink"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
