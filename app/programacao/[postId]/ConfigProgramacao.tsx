'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProgramacaoConfig } from '@/lib/supabase';

type Plataforma = {
  id: string;
  nome: string;
  sigla: string;
  disponivel: boolean;
};

const PLATAFORMAS: Plataforma[] = [
  { id: 'instagram', nome: 'Instagram',       sigla: 'IG', disponivel: true },
  { id: 'facebook',  nome: 'Facebook',        sigla: 'FB', disponivel: true },
  { id: 'tiktok',    nome: 'TikTok',          sigla: 'TT', disponivel: false },
  { id: 'youtube',   nome: 'YouTube Shorts',  sigla: 'YT', disponivel: false },
  { id: 'threads',   nome: 'Threads',         sigla: 'TH', disponivel: false },
];

const FORMATOS: { id: string; nome: string }[] = [
  { id: 'feed',    nome: 'Feed' },
  { id: 'reels',   nome: 'Reels' },
  { id: 'stories', nome: 'Stories' },
];

function fmtDataLonga(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim) return 'Sem título';
  if (/^https?:\/\/\S+$/.test(trim) && !trim.includes(' ')) return 'Sem título';
  return trim;
}

function formatoDefault(formatoTipo: string): string {
  if (formatoTipo === 'reels') return 'reels';
  if (formatoTipo === 'story') return 'stories';
  return 'feed';
}

export function ConfigProgramacao({
  postId,
  titulo,
  dataPostagem,
  projetoNome,
  formatoTipo,
  legendaOriginal,
  thumbFileId,
  configInicial,
}: {
  postId: string;
  titulo: string;
  dataPostagem: string;
  projetoNome: string;
  formatoTipo: string;
  legendaOriginal: string;
  thumbFileId: string | null;
  configInicial: ProgramacaoConfig;
}) {
  const router = useRouter();
  const [horario, setHorario] = useState(configInicial.horario || '18:00');
  const [formato, setFormato] = useState(configInicial.formato || formatoDefault(formatoTipo));
  const [plataformas, setPlataformas] = useState<string[]>(
    configInicial.plataformas.length > 0 ? configInicial.plataformas : ['instagram', 'facebook'],
  );
  const [legenda, setLegenda] = useState(configInicial.legenda || legendaOriginal);
  const [loading, setLoading] = useState<'confirmar' | 'rascunho' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<'confirmar' | 'rascunho' | null>(null);

  function togglePlataforma(id: string, disponivel: boolean) {
    if (!disponivel) return;
    setPlataformas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  async function submit(acao: 'confirmar' | 'rascunho') {
    setLoading(acao);
    setErro(null);
    try {
      const r = await fetch('/api/programar/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId, horario, plataformas, formato, legenda, acao }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setFeito(acao);
      setTimeout(() => {
        router.push('/programacao');
        router.refresh();
      }, 1000);
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-bgSoft/40 pb-16">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/programacao" className="text-[11px] text-mauve transition hover:text-ink">
              ← Programação
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Configurar programação
            </h1>
            <p className="text-[11px] text-t3">
              {projetoNome} · {tituloSeguro(titulo)}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Coluna principal — form */}
          <div className="space-y-5">
            {/* Data + Horário */}
            <div className="card p-5">
              <div className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  1 · Data e horário
                </div>
                <p className="mt-0.5 text-[11px] text-t3">
                  Data vem do calendário aprovado. Horário fica salvo pra esse post.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                    Data
                  </label>
                  <div className="rounded-lg border border-[rgba(21,21,33,0.13)] bg-bgSoft/60 px-3 py-2 text-[13px] text-ink">
                    {fmtDataLonga(dataPostagem)}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
                  />
                </div>
              </div>
            </div>

            {/* Formato */}
            <div className="card p-5">
              <div className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  2 · Formato do post
                </div>
                <p className="mt-0.5 text-[11px] text-t3">
                  Como esse conteúdo vai subir nas plataformas.
                </p>
              </div>
              <div className="flex gap-2">
                {FORMATOS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormato(f.id)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                      formato === f.id
                        ? 'border-[var(--cal-aprovacao)] bg-[var(--cal-aprovacao-soft)] text-[var(--cal-aprovacao)]'
                        : 'border-[rgba(21,21,33,0.13)] bg-white text-t2 hover:text-ink'
                    }`}
                  >
                    {f.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Plataformas */}
            <div className="card p-5">
              <div className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  3 · Plataformas
                </div>
                <p className="mt-0.5 text-[11px] text-t3">
                  Onde publicar. Instagram e Facebook já estão prontos; as outras chegam depois.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PLATAFORMAS.map((p) => {
                  const ativo = plataformas.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlataforma(p.id, p.disponivel)}
                      disabled={!p.disponivel}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                        !p.disponivel
                          ? 'cursor-not-allowed border-[rgba(21,21,33,0.06)] bg-bgSoft/40 opacity-60'
                          : ativo
                            ? 'border-[var(--cal-aprovacao)] bg-[var(--cal-aprovacao-soft)]'
                            : 'border-[rgba(21,21,33,0.13)] bg-white hover:border-[rgba(21,21,33,0.25)]'
                      }`}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-[0.06em]"
                        style={{
                          background: ativo && p.disponivel ? 'var(--cal-aprovacao)' : 'var(--bgSoft)',
                          color: ativo && p.disponivel ? '#fff' : 'var(--t2)',
                        }}
                      >
                        {p.sigla}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink">
                          {p.nome}
                        </div>
                        <div className="text-[10px] text-t3">
                          {!p.disponivel
                            ? 'em breve'
                            : ativo
                              ? '✓ vai publicar'
                              : 'clique pra ativar'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legenda */}
            <div className="card p-5">
              <div className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  4 · Legenda
                </div>
                <p className="mt-0.5 text-[11px] text-t3">
                  Pré-carregada do post. Ajuste se precisar.
                </p>
              </div>
              <textarea
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                rows={10}
                className="w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] leading-[1.55] text-ink"
                placeholder="Ninguém acorda querendo tomar café amargo…"
              />
            </div>

            {/* Ações */}
            {erro && (
              <p className="rounded-lg bg-[var(--prazo-atrasado-soft)] px-4 py-3 text-[12px] text-[var(--prazo-atrasado)]">
                ⚠️ {erro}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => submit('confirmar')}
                disabled={loading !== null || feito !== null}
                className="btn-primary flex-1 justify-center whitespace-nowrap"
              >
                {feito === 'confirmar'
                  ? '✓ Programado'
                  : loading === 'confirmar'
                    ? 'Confirmando…'
                    : 'Confirmar programação'}
              </button>
              <button
                type="button"
                onClick={() => submit('rascunho')}
                disabled={loading !== null || feito !== null}
                className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-5 py-2 text-[13px] font-medium text-ink transition hover:bg-bgSoft disabled:opacity-40"
              >
                {feito === 'rascunho'
                  ? '✓ Salvo'
                  : loading === 'rascunho'
                    ? 'Salvando…'
                    : 'Deixar em rascunho'}
              </button>
            </div>
            <p className="text-[11px] text-t3">
              <b>Confirmar</b> muda o status pra Agendado no Notion.{' '}
              <b>Rascunho</b> só salva o que você preencheu aqui, sem publicar nem mudar status.
            </p>
          </div>

          {/* Sidebar — preview */}
          <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
            <div className="card overflow-hidden p-0">
              {thumbFileId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/drive/preview/${thumbFileId}`}
                  alt=""
                  className="aspect-[4/5] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] w-full items-center justify-center bg-bgSoft text-[11px] text-t3">
                  sem prévia
                </div>
              )}
              <div className="p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                  Preview
                </div>
                <div className="mt-1 truncate text-[13px] font-semibold text-ink">
                  {tituloSeguro(titulo)}
                </div>
              </div>
            </div>
            <Link
              href={`/post/${postId}`}
              className="block rounded-lg border border-[rgba(21,21,33,0.13)] bg-white p-3 text-center text-[12px] font-medium text-ink transition hover:bg-bgSoft"
            >
              Ver material completo →
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
