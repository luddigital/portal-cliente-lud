'use client';

import { useEffect, useRef, useState } from 'react';
import type { IgAnalytics, IgMediaItem } from '@/lib/instagram';
import type { RelatorioNotas } from '@/lib/supabase';
import { GraficoLinha } from '@/app/_components/GraficoLinha';
import { GraficoBarras } from '@/app/_components/GraficoBarras';

/**
 * Relatório imprimível. Cada <Slide> vira 1 página A4 paisagem no print
 * via @media print. Botão "Baixar PDF" no canto chama window.print().
 */

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(Math.abs(n) >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString('pt-BR');
}

function fmtDataLonga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtMesAno(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
}

function deltaPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

function DeltaPill({ atual, anterior }: { atual: number; anterior: number }) {
  const pct = deltaPct(atual, anterior);
  if (pct === null) return null;
  const positivo = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: positivo ? 'var(--prazo-em-dia-soft)' : 'var(--prazo-atrasado-soft)',
        color: positivo ? 'var(--prazo-em-dia)' : 'var(--prazo-atrasado)',
      }}
    >
      {positivo ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Slide({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`slide relative mx-auto my-6 flex w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ${className}`}
      style={{ minHeight: '720px', padding: '56px 64px' }}
    >
      {children}
    </section>
  );
}

function SlideHeader({
  projetoNome,
  periodoLabel,
}: {
  projetoNome: string;
  periodoLabel: string;
}) {
  return (
    <div className="mb-8 flex items-baseline justify-between border-b border-[rgba(21,21,33,0.08)] pb-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-t3">
        Social Media Report · {projetoNome}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-t3">
        {periodoLabel}
      </div>
    </div>
  );
}

export function Relatorio({
  analytics,
  projetoNome,
  projetoId,
  inicio,
  fim,
  notasIniciais,
  editavel,
}: {
  analytics: IgAnalytics;
  projetoNome: string;
  projetoId: string;
  inicio: string;
  fim: string;
  notasIniciais: RelatorioNotas;
  editavel: boolean;
}) {
  const a = analytics;
  const periodoLabel = fmtMesAno(a.period.until);
  const novosSeguidores = a.atual.novosSeguidores;
  const seguidoresAnt = a.account.followersCount - novosSeguidores;

  const postsTop = a.topMedia.slice(0, 4);

  return (
    <div className="bg-bgSoft/50 pb-24">
      {/* Barra fixa de ação — escondida no print */}
      <div className="action-bar sticky top-0 z-20 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-3">
          <a href="/analise" className="text-[12px] text-mauve transition hover:text-ink">
            ← Voltar pra análise
          </a>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-t3">
              {fmtDataLonga(a.period.since)} → {fmtDataLonga(a.period.until)}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-[12px]"
            >
              ↓ Baixar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-6">
        {/* === SLIDE 1: CAPA === */}
        <Slide className="capa items-center justify-center text-center">
          <div className="my-auto">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-t3">
              Social Media Report
            </div>
            <h1
              className="mt-4 text-[56px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink"
              style={{ fontFamily: 'inherit' }}
            >
              {projetoNome}
            </h1>
            <div className="mt-4 text-[20px] font-medium text-t2">
              {periodoLabel}
            </div>
            <div className="mt-12 text-[12px] text-t3">
              {fmtDataLonga(a.period.since)} → {fmtDataLonga(a.period.until)}
            </div>
          </div>
          <div className="absolute bottom-6 right-6 text-[20px] font-bold text-ink">
            Lud<span className="font-light text-mauve">.</span>
          </div>
        </Slide>

        {/* === SLIDE 2: VISÃO GERAL DE KPIs === */}
        <Slide>
          <SlideHeader projetoNome={projetoNome} periodoLabel={periodoLabel} />
          <h2 className="text-[32px] font-semibold tracking-[-0.02em] text-ink">
            Visão geral
          </h2>
          <p className="mt-1 text-[13px] text-t2">
            Como o perfil performou no período selecionado.
          </p>

          {/* Mega card: seguidores totais */}
          <div
            className="mt-8 rounded-2xl px-8 py-7"
            style={{ background: 'var(--bgSoft)' }}
          >
            <div className="flex items-center justify-between gap-6">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-t3">
                  Total de seguidores
                </div>
                <div className="mt-2 font-mono text-[64px] font-semibold leading-none tracking-[-0.04em] text-ink">
                  {a.account.followersCount.toLocaleString('pt-BR')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-t3">
                  Novos no período
                </div>
                <div className="mt-2 inline-flex items-center gap-2">
                  <span
                    className="font-mono text-[28px] font-semibold"
                    style={{
                      color:
                        novosSeguidores >= 0
                          ? 'var(--prazo-em-dia)'
                          : 'var(--prazo-atrasado)',
                    }}
                  >
                    {novosSeguidores >= 0 ? '+' : ''}
                    {novosSeguidores.toLocaleString('pt-BR')}
                  </span>
                  {seguidoresAnt > 0 && (
                    <DeltaPill
                      atual={a.account.followersCount}
                      anterior={seguidoresAnt}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPIs em grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi
              label="Contas alcançadas"
              valor={a.atual.reach}
              anterior={a.anterior.reach}
            />
            <Kpi
              label="Interações"
              valor={a.atual.interactions}
              anterior={a.anterior.interactions}
            />
            <Kpi
              label="Contas engajadas"
              valor={a.atual.engagedAccounts}
              anterior={a.anterior.engagedAccounts}
            />
            <Kpi
              label="Visitas ao perfil"
              valor={a.atual.profileViews}
              anterior={a.anterior.profileViews}
            />
            <Kpi
              label="Taxa de engajamento"
              valor={Number((a.taxaEngajamento * 100).toFixed(2))}
              anterior={0}
              sufixo="%"
              semDelta
            />
            <Kpi
              label="Posts no período"
              valor={a.topMedia.length}
              anterior={0}
              semDelta
            />
          </div>
        </Slide>

        {/* === SLIDE 3: SEGUIDORES NO TEMPO === */}
        {a.serieSeguidores.length > 0 && (
          <Slide>
            <SlideHeader projetoNome={projetoNome} periodoLabel={periodoLabel} />
            <h2 className="text-[32px] font-semibold tracking-[-0.02em] text-ink">
              Seguidores no período
            </h2>
            <p className="mt-1 text-[13px] text-t2">
              Quantos entraram (verde) e saíram (vermelho) por dia.
            </p>
            <div className="mt-6">
              <GraficoBarras
                dados={a.serieSeguidores}
                label="Entradas e saídas diárias"
              />
            </div>
          </Slide>
        )}

        {/* === SLIDE 4: ALCANCE === */}
        {a.serieAlcance.length > 0 && (
          <Slide>
            <SlideHeader projetoNome={projetoNome} periodoLabel={periodoLabel} />
            <h2 className="text-[32px] font-semibold tracking-[-0.02em] text-ink">
              Alcance
            </h2>
            <p className="mt-1 text-[13px] text-t2">
              Contas únicas alcançadas pelos posts a cada dia.
            </p>
            <div className="mt-6">
              <GraficoLinha dados={a.serieAlcance} label="Alcance diário" />
            </div>
          </Slide>
        )}

        {/* === SLIDE 5: ENGAJAMENTO === */}
        {a.serieEngajamento.length > 0 && (
          <Slide>
            <SlideHeader projetoNome={projetoNome} periodoLabel={periodoLabel} />
            <h2 className="text-[32px] font-semibold tracking-[-0.02em] text-ink">
              Engajamento
            </h2>
            <p className="mt-1 text-[13px] text-t2">
              Contas que interagiram (clique, like, save, comentário) por dia.
            </p>
            <div className="mt-6">
              <GraficoLinha
                dados={a.serieEngajamento}
                label="Contas engajadas por dia"
              />
            </div>
          </Slide>
        )}

        {/* === SLIDES 6+: MELHORES POSTS (1 por slide) === */}
        {postsTop.map((post, i) => (
          <Slide key={post.id} className="post-slide">
            <SlideHeader projetoNome={projetoNome} periodoLabel={periodoLabel} />
            <div className="mb-2 flex items-center gap-3">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  background: 'var(--cal-agendado-soft)',
                  color: 'var(--cal-agendado)',
                }}
              >
                Top {i + 1}
              </span>
              <span className="text-[12px] text-t3">
                {fmtDataLonga(post.timestamp.slice(0, 10))}
              </span>
            </div>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">
              Melhor conteúdo · #{i + 1}
            </h2>
            <PostBlock post={post} />
          </Slide>
        ))}

        {/* === SLIDE FINAL: APRENDIZADOS (editável pela equipe Lud.) === */}
        <NotasSlide
          projetoNome={projetoNome}
          periodoLabel={periodoLabel}
          projetoId={projetoId}
          inicio={inicio}
          fim={fim}
          notasIniciais={notasIniciais}
          editavel={editavel}
        />
      </div>

      {/* CSS print — cada .slide vira 1 página A4 paisagem */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          html,
          body {
            background: white !important;
          }
          .action-bar {
            display: none !important;
          }
          .slide {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            page-break-after: always;
            break-after: page;
            padding: 16mm 18mm !important;
          }
          .slide:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}

function Kpi({
  label,
  valor,
  anterior,
  sufixo = '',
  semDelta = false,
}: {
  label: string;
  valor: number;
  anterior: number;
  sufixo?: string;
  semDelta?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-bgSoft px-4 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-t3">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[24px] font-semibold tracking-[-0.02em] text-ink">
          {fmtNum(valor)}
          {sufixo}
        </span>
        {!semDelta && <DeltaPill atual={valor} anterior={anterior} />}
      </div>
    </div>
  );
}

function PostBlock({ post }: { post: IgMediaItem }) {
  const captionResumida = (post.caption || '').slice(0, 240).trim();
  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-[280px,1fr]">
      <div
        className="overflow-hidden rounded-xl bg-bgSoft"
        style={{ aspectRatio: '4/5' }}
      >
        {post.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-t3">
            sem prévia
          </div>
        )}
      </div>
      <div>
        {captionResumida && (
          <p className="line-clamp-5 text-[13px] leading-[1.55] text-t1">
            {captionResumida}
            {post.caption.length > 240 && '…'}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniMetrica label="Alcance" valor={post.reach} />
          <MiniMetrica label="Interações" valor={post.interactions} />
          <MiniMetrica label="Curtidas" valor={post.likes} />
          <MiniMetrica label="Comentários" valor={post.comments} />
        </div>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-[11px] text-mauve underline-offset-2 hover:underline"
          >
            Ver post no Instagram →
          </a>
        )}
      </div>
    </div>
  );
}

function MiniMetrica({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-xl bg-bgSoft px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-t3">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[20px] font-semibold text-ink">
        {fmtNum(valor)}
      </div>
    </div>
  );
}

function NotasSlide({
  projetoNome,
  periodoLabel,
  projetoId,
  inicio,
  fim,
  notasIniciais,
  editavel,
}: {
  projetoNome: string;
  periodoLabel: string;
  projetoId: string;
  inicio: string;
  fim: string;
  notasIniciais: RelatorioNotas;
  editavel: boolean;
}) {
  const [funcionou, setFuncionou] = useState(notasIniciais.funcionou);
  const [naoFuncionou, setNaoFuncionou] = useState(notasIniciais.naoFuncionou);
  const [plano, setPlano] = useState(notasIniciais.plano);
  const [statusSalvar, setStatusSalvar] = useState<'limpo' | 'salvando' | 'salvo' | 'erro'>('limpo');
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(
    notasIniciais.atualizadoEm,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiroRender = useRef(true);

  // Auto-save com debounce de 800ms após a última digitada
  useEffect(() => {
    if (!editavel) return;
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatusSalvar('limpo');
    debounceRef.current = setTimeout(async () => {
      setStatusSalvar('salvando');
      try {
        const r = await fetch('/api/relatorio/notas', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projetoId,
            inicio,
            fim,
            funcionou,
            naoFuncionou,
            plano,
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${r.status}`);
        }
        setStatusSalvar('salvo');
        setUltimoSalvo(new Date().toISOString());
      } catch {
        setStatusSalvar('erro');
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [funcionou, naoFuncionou, plano, projetoId, inicio, fim, editavel]);

  const labelSalvar =
    statusSalvar === 'salvando'
      ? 'Salvando…'
      : statusSalvar === 'salvo'
        ? '✓ Salvo'
        : statusSalvar === 'erro'
          ? '⚠️ Erro ao salvar'
          : ultimoSalvo
            ? `Salvo às ${new Date(ultimoSalvo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
            : '';

  return (
    <Slide>
      <SlideHeader projetoNome={projetoNome} periodoLabel={periodoLabel} />
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[32px] font-semibold tracking-[-0.02em] text-ink">
          Aprendizados & próximos passos
        </h2>
        {editavel && (
          <span
            className="action-bar text-[11px]"
            style={{
              color:
                statusSalvar === 'erro'
                  ? 'var(--prazo-atrasado)'
                  : statusSalvar === 'salvando'
                    ? 'var(--prazo-chegando)'
                    : 'var(--t3)',
            }}
          >
            {labelSalvar}
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-t2">
        {editavel
          ? 'Equipe Lud. — escreve aqui o que vai entregar. Salva sozinho enquanto você digita.'
          : 'O que funcionou, o que não funcionou e o plano pro próximo mês.'}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <BlocoEditavel
          titulo="✅ O que funcionou"
          valor={funcionou}
          onChange={setFuncionou}
          editavel={editavel}
          placeholder="O que deu certo no período…"
        />
        <BlocoEditavel
          titulo="⚠️ O que não funcionou"
          valor={naoFuncionou}
          onChange={setNaoFuncionou}
          editavel={editavel}
          placeholder="O que não engajou ou não converteu…"
        />
      </div>
      <div className="mt-4">
        <BlocoEditavel
          titulo="🎯 Plano pro próximo mês"
          valor={plano}
          onChange={setPlano}
          editavel={editavel}
          placeholder="Próximos formatos, temas e testes…"
          alto
        />
      </div>
      <div className="mt-auto pt-10 text-center text-[11px] text-t3">
        Relatório gerado pela{' '}
        <span className="font-semibold text-ink">
          Lud<span className="font-light text-mauve">.</span>
        </span>{' '}
        · {fmtDataLonga(new Date().toISOString().slice(0, 10))}
      </div>
    </Slide>
  );
}

function BlocoEditavel({
  titulo,
  valor,
  onChange,
  editavel,
  placeholder,
  alto = false,
}: {
  titulo: string;
  valor: string;
  onChange: (v: string) => void;
  editavel: boolean;
  placeholder: string;
  alto?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-[rgba(21,21,33,0.1)] bg-white p-4"
      style={{ minHeight: alto ? 180 : 130 }}
    >
      <div className="text-[12px] font-semibold text-ink">{titulo}</div>
      {editavel ? (
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1.5 w-full resize-none border-0 bg-transparent text-[12px] leading-[1.55] text-t1 placeholder:text-t3 placeholder:italic focus:outline-none"
          rows={alto ? 8 : 5}
        />
      ) : valor ? (
        <p className="mt-1.5 whitespace-pre-line text-[12px] leading-[1.55] text-t1">
          {valor}
        </p>
      ) : (
        <p className="mt-1.5 text-[12px] italic text-t3">— em branco —</p>
      )}
    </div>
  );
}
