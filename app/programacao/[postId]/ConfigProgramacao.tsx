'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProgramacaoConfig } from '@/lib/supabase';
import { PostPreview, type PreviewArquivo, type FormatoTipo } from '@/app/post/[id]/PostPreview';

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

const FORMATO_TIPO_MAP: Record<string, FormatoTipo> = {
  post: 'post',
  reels: 'reels',
  story: 'story',
};

export function ConfigProgramacao({
  postId,
  titulo,
  dataPostagem,
  projetoNome,
  formatoTipo,
  legendaOriginal,
  arquivos,
  configInicial,
}: {
  postId: string;
  titulo: string;
  dataPostagem: string;
  projetoNome: string;
  formatoTipo: string;
  legendaOriginal: string;
  arquivos: PreviewArquivo[];
  configInicial: ProgramacaoConfig;
}) {
  const router = useRouter();
  const [data, setData] = useState(configInicial.data || dataPostagem);
  const [horario, setHorario] = useState(configInicial.horario || '10:00');
  const [formato, setFormato] = useState(configInicial.formato || formatoDefault(formatoTipo));
  const [plataformas, setPlataformas] = useState<string[]>(
    configInicial.plataformas.length > 0 ? configInicial.plataformas : ['instagram', 'facebook'],
  );
  const [legenda, setLegenda] = useState(configInicial.legenda || legendaOriginal);
  const [loading, setLoading] = useState<'confirmar' | 'postado' | 'rascunho' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<'confirmar' | 'postado' | 'rascunho' | null>(null);

  const formatoPreview: FormatoTipo = FORMATO_TIPO_MAP[formatoTipo] ?? 'desconhecido';

  function togglePlataforma(id: string, disponivel: boolean) {
    if (!disponivel) return;
    setPlataformas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  async function submit(acao: 'confirmar' | 'postado' | 'rascunho') {
    setLoading(acao);
    setErro(null);
    try {
      const r = await fetch('/api/programar/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId, data, horario, plataformas, formato, legenda, acao }),
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

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Preview completo do post — igual o cliente vê na aprovação */}
        <section className="card p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                Preview
              </div>
              <p className="mt-0.5 text-[11px] text-t3">
                É exatamente o que o cliente viu na aprovação.
              </p>
            </div>
            <Link
              href={`/post/${postId}`}
              className="text-[11px] font-medium text-mauve transition hover:text-ink"
            >
              abrir em página inteira ↗
            </Link>
          </div>
          <PostPreview
            arquivos={arquivos}
            formatoTipo={formatoPreview}
            postId={postId}
            tarefaId={null}
            tarefaTitulo={tituloSeguro(titulo)}
            legenda={null}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Coluna esquerda — data/horário/formato */}
          <div className="space-y-5">
            {/* Data + Horário */}
            <div className="card p-5">
              <div className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  1 · Data e horário
                </div>
                <p className="mt-0.5 text-[11px] text-t3">
                  Clique na data pra abrir o calendário. Horário padrão é 10h (do projeto).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                    Data
                  </label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
                  />
                  {data && data !== dataPostagem && (
                    <p className="mt-1 text-[10px] text-t3">
                      Original: {fmtDataLonga(dataPostagem)}
                    </p>
                  )}
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

          </div>

          {/* Coluna direita — legenda */}
          <div>
            <div className="card p-5 h-full flex flex-col">
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
                className="flex-1 min-h-[240px] w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] leading-[1.55] text-ink"
                placeholder="Ninguém acorda querendo tomar café amargo…"
              />
            </div>
          </div>
        </div>

        {/* Ações */}
        {erro && (
          <p className="rounded-lg bg-[var(--prazo-atrasado-soft)] px-4 py-3 text-[12px] text-[var(--prazo-atrasado)]">
            ⚠️ {erro}
          </p>
        )}

        <div className="card p-5">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Modo teste — Rascunho */}
            <div className="rounded-xl border-2 border-dashed border-[var(--cal-aprovacao)]/40 bg-[var(--cal-aprovacao-soft)]/40 p-4 flex flex-col">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-[var(--cal-aprovacao)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Modo teste
                </span>
                <span className="text-[13px] font-semibold text-ink">Rascunho</span>
              </div>
              <p className="mb-3 flex-1 text-[11px] leading-[1.5] text-t2">
                Salva tudo aqui no portal <b>sem tocar no Notion do cliente</b> e sem publicar em lugar nenhum. Use pra testar à vontade.
              </p>
              <button
                type="button"
                onClick={() => submit('rascunho')}
                disabled={loading !== null || feito !== null}
                className="w-full rounded-full border border-[var(--cal-aprovacao)] bg-white px-5 py-2 text-[13px] font-semibold text-[var(--cal-aprovacao)] transition hover:bg-[var(--cal-aprovacao-soft)] disabled:opacity-40"
              >
                {feito === 'rascunho'
                  ? '✓ Salvo em rascunho'
                  : loading === 'rascunho'
                    ? 'Salvando…'
                    : 'Salvar como rascunho'}
              </button>
            </div>

            {/* Confirmar — Agendado no Notion */}
            <div className="rounded-xl border border-[rgba(21,21,33,0.13)] bg-white p-4 flex flex-col">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Agendar
                </span>
                <span className="text-[13px] font-semibold text-ink">Confirmar</span>
              </div>
              <p className="mb-3 flex-1 text-[11px] leading-[1.5] text-t2">
                Muda o status pra <b>Agendado</b> no Notion do cliente. Use quando o post ainda vai subir (por você ou por scheduler).
              </p>
              <button
                type="button"
                onClick={() => submit('confirmar')}
                disabled={loading !== null || feito !== null}
                className="btn-primary w-full justify-center whitespace-nowrap"
              >
                {feito === 'confirmar'
                  ? '✓ Agendado'
                  : loading === 'confirmar'
                    ? 'Confirmando…'
                    : 'Confirmar programação'}
              </button>
            </div>

            {/* Postar agora — marca Postado no Notion */}
            <div className="rounded-xl border border-[var(--prazo-em-dia)]/30 bg-[var(--prazo-em-dia-soft)]/40 p-4 flex flex-col">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-[var(--prazo-em-dia)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Já foi
                </span>
                <span className="text-[13px] font-semibold text-ink">Postar agora</span>
              </div>
              <p className="mb-3 flex-1 text-[11px] leading-[1.5] text-t2">
                Marca como <b>Postado</b> no Notion. Use quando você já publicou no IG/FB manualmente (ou tá publicando agora). O portal ainda não sobe post por conta própria.
              </p>
              <button
                type="button"
                onClick={() => submit('postado')}
                disabled={loading !== null || feito !== null}
                className="w-full rounded-full bg-[var(--prazo-em-dia)] px-5 py-2 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
              >
                {feito === 'postado'
                  ? '✓ Marcado como postado'
                  : loading === 'postado'
                    ? 'Marcando…'
                    : 'Marcar como postado'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
