'use client';

import { useMemo, useState } from 'react';
import type { EtapaCopyId, PostPipeline, StatusEtapa } from '@/lib/pipelineCopy';

// Metadados leves das 6 etapas (cópia client-side — não importa lib/pipelineCopy,
// que puxa código server-only). Mantém a mesma ordem do método.
const ETAPAS: { id: EtapaCopyId; label: string; descricao: string }[] = [
  { id: 'pesquisa', label: 'Pesquisa', descricao: 'fatos e fontes verificadas' },
  { id: 'dor', label: 'Dor', descricao: 'dor real do público ancorada' },
  { id: 'hook', label: 'Hook', descricao: '3 ganchos pro formato' },
  { id: 'briefing', label: 'Briefing', descricao: 'briefing do post montado' },
  { id: 'copy', label: 'Copy', descricao: 'legenda / roteiro / voice over' },
  { id: 'revisao', label: 'Revisão', descricao: 'revisao-copy + copy-guide' },
];
const ETAPA_IDS = ETAPAS.map((e) => e.id);

type PostLeve = {
  id: string;
  titulo: string;
  formato: string;
  data: string;
  etapaMacro: string;
  cor: string;
};

type Props = {
  projetoId: string;
  clienteNome: string;
  mesLabel: string;
  ano: number;
  mes: number;
  posts: PostLeve[];
  pipelineInicial: Record<string, PostPipeline>;
};

// status da etapa -> cores do design system do portal (globals.css --cal-*)
const STATUS_UI: Record<
  StatusEtapa,
  { cor: string; soft: string; label: string; icon: string }
> = {
  pronto: { cor: 'var(--cal-publicado)', soft: 'var(--cal-publicado-soft)', label: 'pronto', icon: '✓' },
  rascunho: { cor: 'var(--cal-agendado)', soft: 'var(--cal-agendado-soft)', label: 'rascunho', icon: '◐' },
  producao_pedida: { cor: 'var(--cal-aprovacao)', soft: 'var(--cal-aprovacao-soft)', label: 'na fila final', icon: '★' },
  na_fila: { cor: 'var(--cal-rascunho)', soft: 'var(--cal-rascunho-soft)', label: 'na fila', icon: '○' },
};

function classeEstado(pp: PostPipeline): 'pronto' | 'producao' | 'fila' {
  if (pp.etapaAtual >= ETAPA_IDS.length) return 'pronto';
  const algumaAtiva = ETAPA_IDS.some(
    (id) => pp.etapas[id].status === 'rascunho' || pp.etapas[id].status === 'producao_pedida',
  );
  return algumaAtiva ? 'producao' : 'fila';
}

export function PipelineBoard({
  projetoId,
  clienteNome,
  mesLabel,
  ano,
  mes,
  posts,
  pipelineInicial,
}: Props) {
  const [pipeline, setPipeline] = useState(pipelineInicial);
  const [selecionado, setSelecionado] = useState<string | null>(posts[0]?.id ?? null);
  const [carregando, setCarregando] = useState<string | null>(null); // `${postId}:${etapa}:${acao}`
  const [contextoAberto, setContextoAberto] = useState<EtapaCopyId | null>(null);
  const [contextoTexto, setContextoTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const stats = useMemo(() => {
    let prontos = 0, producao = 0, fila = 0, somaProg = 0;
    for (const p of posts) {
      const pp = pipeline[p.id];
      if (!pp) { fila++; continue; }
      somaProg += pp.progresso;
      const c = classeEstado(pp);
      if (c === 'pronto') prontos++;
      else if (c === 'producao') producao++;
      else fila++;
    }
    const media = posts.length ? Math.round(somaProg / posts.length) : 0;
    const nivel = Math.max(1, Math.min(6, Math.round((media / 100) * 6) || 1));
    return { prontos, producao, fila, media, nivel };
  }, [pipeline, posts]);

  async function acao(
    tipo: 'rascunho' | 'contexto' | 'producao_final',
    post: PostLeve,
    etapa: EtapaCopyId,
    contexto?: string,
  ) {
    setErro(null);
    setCarregando(`${post.id}:${etapa}:${tipo}`);
    try {
      const pp = pipeline[post.id];
      const anteriores = ETAPA_IDS
        .slice(0, ETAPA_IDS.indexOf(etapa))
        .map((id) => pp?.etapas[id])
        .filter((e) => e && e.output)
        .map((e) => ({ etapa: e!.etapa, output: e!.output! }));

      const res = await fetch('/api/pipeline/acao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: tipo,
          postId: post.id,
          projetoId,
          etapa,
          contexto,
          ctx: { postTitulo: post.titulo, formato: post.formato, clienteNome, anteriores },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'falhou');
      if (json.pipeline) {
        setPipeline((prev) => ({ ...prev, [post.id]: json.pipeline }));
      }
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setCarregando(null);
      setContextoAberto(null);
      setContextoTexto('');
    }
  }

  const postSel = posts.find((p) => p.id === selecionado) ?? null;
  const ppSel = postSel ? pipeline[postSel.id] : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Cabeçalho gamificado */}
      <div className="rounded-2xl bg-bgSoft p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold text-t1">
              {clienteNome} · pipeline de copy
            </div>
            <div className="text-[13px] text-t2">
              {mesLabel} · {posts.length} {posts.length === 1 ? 'post' : 'posts'}
            </div>
          </div>
          <div className="flex gap-5">
            <Contador n={stats.prontos} label="prontos" cor="var(--cal-publicado)" />
            <Contador n={stats.producao} label="em produção" cor="var(--cal-aprovacao)" />
            <Contador n={stats.fila} label="na fila" cor="var(--cal-rascunho)" />
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[12px] text-t2">
            <span>progresso do lote</span>
            <span className="font-semibold text-t1">nível {stats.nivel} · {stats.media}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${stats.media}%`, background: 'var(--cal-agendado)' }}
            />
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-t2">
        <Legenda cor="var(--cal-publicado)" texto="pronto (produção final)" />
        <Legenda cor="var(--cal-agendado)" texto="rascunho do app" />
        <Legenda cor="var(--cal-aprovacao)" texto="fila da produção final" />
        <Legenda cor="var(--cal-rascunho)" texto="não começou" />
      </div>

      {erro && (
        <div className="mt-3 rounded-lg bg-[var(--cal-alteracao-soft)] px-3 py-2 text-[12px] text-[var(--cal-alteracao)]">
          {erro}
        </div>
      )}

      {posts.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-medium px-4 py-10 text-center text-[13px] text-t2">
          Nenhuma pauta encontrada pra {mesLabel}. As pautas vêm do Notion; confira o mês
          (use <code>?ano={ano}&amp;mes={mes}</code> no link) ou se as pautas já foram criadas.
        </div>
      )}

      {/* Raias */}
      <div className="mt-4 space-y-2">
        {posts.map((post) => {
          const pp = pipeline[post.id] ?? { etapaAtual: 0, progresso: 0, etapas: {} as any };
          const sel = post.id === selecionado;
          const estado = pp.etapas && Object.keys(pp.etapas).length ? classeEstado(pp as PostPipeline) : 'fila';
          const estadoTxt =
            estado === 'pronto'
              ? { t: 'pronto', c: 'var(--cal-publicado)' }
              : estado === 'producao'
                ? { t: `produzindo ${ETAPAS[Math.min(pp.etapaAtual, 5)].label.toLowerCase()}`, c: 'var(--cal-aprovacao)' }
                : { t: 'na fila', c: 'var(--cal-rascunho)' };
          return (
            <button
              key={post.id}
              onClick={() => setSelecionado(post.id)}
              className={`w-full rounded-xl bg-white p-3 text-left transition ${
                sel ? 'ring-2 ring-[var(--cal-agendado)]' : 'border border-DEFAULT hover:border-medium'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-[14px] font-medium text-t1">{post.titulo}</div>
                <span className="shrink-0 rounded-full bg-tagBg px-2 py-0.5 text-[10px] text-t2">
                  {post.formato}
                </span>
              </div>
              {/* trilho das 6 etapas */}
              <div className="mt-2.5 flex items-center gap-1">
                {ETAPA_IDS.map((id, i) => {
                  const st: StatusEtapa = pp.etapas?.[id]?.status ?? 'na_fila';
                  const ativa = i === pp.etapaAtual;
                  return (
                    <div
                      key={id}
                      title={ETAPAS[i].label}
                      className="h-[7px] flex-1 rounded-full"
                      style={{
                        background: STATUS_UI[st].cor,
                        boxShadow: ativa ? `0 0 0 3px ${STATUS_UI[st].soft}` : 'none',
                        opacity: st === 'na_fila' ? 0.35 : 1,
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[12px]">
                <span style={{ color: estadoTxt.c }}>{estadoTxt.t}</span>
                <span className="text-t3">{pp.progresso ?? 0}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detalhe do post selecionado */}
      {postSel && ppSel && (
        <div className="mt-4 rounded-2xl border border-DEFAULT bg-white p-4 sm:p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[15px] font-semibold text-t1">{postSel.titulo}</div>
            <span className="rounded-full bg-[var(--cal-agendado-soft)] px-2.5 py-0.5 text-[11px] text-[var(--cal-agendado)]">
              etapa aberta
            </span>
          </div>
          <p className="mb-2 text-[12px] text-t2">
            as 6 etapas do método · <b className="text-t1">regerar</b> faz um rascunho na hora ·{' '}
            <b className="text-t1">produção final</b> manda pro Claude Code rodar o método completo
          </p>

          <div className="divide-y divide-[rgba(21,21,33,0.06)]">
            {ETAPAS.map((et) => {
              const e = ppSel.etapas[et.id];
              const ui = STATUS_UI[e.status];
              const loadingRasc = carregando === `${postSel.id}:${et.id}:rascunho`;
              const loadingFinal = carregando === `${postSel.id}:${et.id}:producao_final`;
              return (
                <div key={et.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[14px]"
                      style={{ background: ui.soft, color: ui.cor }}
                    >
                      {ui.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-t1">{et.label}</span>
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: ui.cor }}>
                          {ui.label}
                        </span>
                        {e.fonte === 'rascunho_app' && (
                          <span className="text-[10px] text-t3">· rascunho do app</span>
                        )}
                      </div>
                      <div className="text-[12px] text-t2">{et.descricao}</div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() =>
                          setContextoAberto((v) => (v === et.id ? null : et.id))
                        }
                        title="adicionar contexto"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-medium text-[15px] text-t2 transition hover:bg-bgSoft"
                      >
                        +
                      </button>
                      <button
                        onClick={() => acao('rascunho', postSel, et.id, e.contextoExtra ?? undefined)}
                        disabled={loadingRasc}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-medium px-2.5 text-[12px] text-t1 transition hover:bg-bgSoft disabled:opacity-40"
                      >
                        {loadingRasc ? '…' : '↻'} regerar
                      </button>
                      <button
                        onClick={() => acao('producao_final', postSel, et.id)}
                        disabled={loadingFinal}
                        title="rodar o método completo (Claude Code)"
                        className="flex h-8 items-center rounded-lg px-2.5 text-[12px] font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                        style={{ background: 'var(--cal-aprovacao)' }}
                      >
                        {loadingFinal ? '…' : 'produção final'}
                      </button>
                    </div>
                  </div>

                  {contextoAberto === et.id && (
                    <div className="mt-2.5 pl-11">
                      <textarea
                        value={contextoTexto}
                        onChange={(ev) => setContextoTexto(ev.target.value)}
                        placeholder={`contexto pra etapa ${et.label.toLowerCase()} (ex: puxa o feriado, o tom ficou formal demais…)`}
                        rows={2}
                        className="w-full rounded-lg border border-medium bg-bgSoft px-3 py-2 text-[13px] text-t1 outline-none focus:border-[var(--cal-agendado)]"
                      />
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          onClick={() => acao('contexto', postSel, et.id, contextoTexto)}
                          className="rounded-lg border border-medium px-3 py-1 text-[12px] text-t1 hover:bg-bgSoft"
                        >
                          salvar contexto
                        </button>
                        <button
                          onClick={() => acao('rascunho', postSel, et.id, contextoTexto)}
                          className="rounded-lg px-3 py-1 text-[12px] font-medium text-white"
                          style={{ background: 'var(--cal-agendado)' }}
                        >
                          salvar e regerar
                        </button>
                      </div>
                    </div>
                  )}

                  {e.output && (
                    <div className="mt-2 ml-11 whitespace-pre-wrap rounded-lg bg-bgSoft px-3 py-2 text-[12.5px] leading-relaxed text-t1">
                      {e.output}
                    </div>
                  )}
                  {e.contextoExtra && contextoAberto !== et.id && (
                    <div className="mt-1.5 ml-11 text-[11px] text-t3">
                      contexto salvo: {e.contextoExtra}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function Contador({ n, label, cor }: { n: number; label: string; cor: string }) {
  return (
    <div>
      <div className="text-[12px] text-t2">{label}</div>
      <div className="text-[22px] font-semibold" style={{ color: cor }}>{n}</div>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />
      {texto}
    </span>
  );
}
