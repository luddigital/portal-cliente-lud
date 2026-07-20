'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { PostCalendario, ProjetoListItem } from '@/lib/notion';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const DIAS_SEMANA = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

type Bucket = 'pronto' | 'programado' | 'publicado' | 'ajuste' | 'outro';

const BUCKET_INFO: Record<Bucket, { label: string; bg: string; fg: string }> = {
  pronto:    { label: 'Aguardando programação', bg: 'var(--prazo-chegando-soft)', fg: 'var(--prazo-chegando)' },
  programado:{ label: 'Programado',              bg: 'var(--cal-agendado-soft)',   fg: 'var(--cal-agendado)'   },
  publicado: { label: 'Publicado',               bg: 'var(--prazo-em-dia-soft)',   fg: 'var(--prazo-em-dia)'   },
  ajuste:    { label: 'Ajuste pendente',         bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)' },
  outro:     { label: 'Em produção',             bg: 'var(--prazo-hoje-soft)',     fg: 'var(--prazo-hoje)'     },
};

const FORMATO_LABELS: Record<PostCalendario['tipo'], string> = {
  post: 'Carrossel',
  reels: 'Reels',
  story: 'Stories',
};

/** Classifica o post em um dos 5 baldes visíveis na página. */
function balde(p: PostCalendario): Bucket {
  if (p.cor === 'publicado') return 'publicado';
  if (p.cor === 'agendado') return 'programado';
  if (p.cor === 'alteracao') return 'ajuste';
  const t = (p.tarefaAtualTitulo ?? '').toLowerCase();
  if (t.includes('programar')) return 'pronto';
  return 'outro';
}

function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim) return 'Sem título';
  if (/^https?:\/\/\S+$/.test(trim) && !trim.includes(' ')) return 'Sem título';
  return trim;
}

function fmtDia(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function fmtDiaLongo(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const s = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${d}/${MES_ABREV[m - 1]} · ${s}`;
}

export function ProgramacaoView({
  projetos,
  projetoIdSelecionado,
  year,
  month,
  posts,
  thumbnails,
  legendas,
}: {
  projetos: ProjetoListItem[];
  projetoIdSelecionado: string;
  year: number;
  month: number;
  posts: PostCalendario[];
  thumbnails: Record<string, string | null>;
  legendas: Record<string, string | null>;
}) {
  const router = useRouter();
  const [postAberto, setPostAberto] = useState<PostCalendario | null>(null);
  const [filtroFmt, setFiltroFmt] = useState<'todos' | 'post' | 'reels' | 'story'>('todos');

  // Buckets
  const cats = useMemo(() => {
    const g: Record<Bucket, PostCalendario[]> = {
      pronto: [], programado: [], publicado: [], ajuste: [], outro: [],
    };
    for (const p of posts) g[balde(p)].push(p);
    // sort each by date asc
    for (const k of Object.keys(g) as Bucket[]) {
      g[k].sort((a, b) => (a.data > b.data ? 1 : -1));
    }
    return g;
  }, [posts]);

  const total = posts.length;
  const publicadosCount = cats.publicado.length;
  const programadosCount = cats.programado.length;
  const prontosCount = cats.pronto.length;
  const encaminhados = publicadosCount + programadosCount + prontosCount;

  const prontosFiltrados = useMemo(() => {
    if (filtroFmt === 'todos') return cats.pronto;
    return cats.pronto.filter((p) => p.tipo === filtroFmt);
  }, [cats.pronto, filtroFmt]);

  const projetoNome = projetos.find((p) => p.id === projetoIdSelecionado)?.nome ?? 'Projeto';

  // Nav de mês / projeto — navegação hard (window.location) porque
  // router.push com searchParams no App Router às vezes não re-renderiza
  // o Server Component. Full nav sempre re-avalia o page.tsx.
  function irPara(deltaMes: number) {
    let novoMes = month + deltaMes;
    let novoAno = year;
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    else if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    const params = new URLSearchParams({
      projetoId: projetoIdSelecionado, year: String(novoAno), month: String(novoMes),
    });
    window.location.href = `/programacao?${params.toString()}`;
  }
  function trocarProjeto(id: string) {
    const params = new URLSearchParams({
      projetoId: id, year: String(year), month: String(month),
    });
    window.location.href = `/programacao?${params.toString()}`;
  }

  // Dia de hoje (só marca ring se o mês/ano em tela é o atual)
  const agora = new Date();
  const hojeMarcado =
    agora.getFullYear() === year && agora.getMonth() + 1 === month
      ? agora.getDate()
      : null;

  // Calendário com posts nos dias
  const primeiro = new Date(year, month - 1, 1);
  const ultimoDia = new Date(year, month, 0).getDate();
  const offset = primeiro.getDay();
  const totalCelulas = Math.ceil((offset + ultimoDia) / 7) * 7;
  const postsPorDia = new Map<number, PostCalendario[]>();
  for (const p of posts) {
    const [, , d] = p.data.split('-').map(Number);
    if (!postsPorDia.has(d)) postsPorDia.set(d, []);
    postsPorDia.get(d)!.push(p);
  }
  const celulas = Array.from({ length: totalCelulas }, (_, i) => {
    const dia = i - offset + 1;
    return dia >= 1 && dia <= ultimoDia ? dia : null;
  });

  // Bar segmentos: publicados / programados / aguardando (dos "encaminhados")
  const barra = total > 0 ? {
    pub: (publicadosCount / total) * 100,
    prg: (programadosCount / total) * 100,
    aguard: (prontosCount / total) * 100,
    resto: ((total - encaminhados) / total) * 100,
  } : { pub: 0, prg: 0, aguard: 0, resto: 0 };

  return (
    <div className="min-h-screen pb-16">
      {/* HEADER */}
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Programação de posts
            </h1>
            <p className="text-[11px] text-t3">
              Do calendário aprovado à publicação.
            </p>
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
              <button type="button" onClick={() => irPara(-1)} className="rounded-full px-3 py-1 text-[12px] text-ink transition hover:bg-white">←</button>
              <span className="min-w-[130px] px-2 text-center text-[12px] font-semibold text-ink">
                {MESES[month - 1]} {year}
              </span>
              <button type="button" onClick={() => irPara(1)} className="rounded-full px-3 py-1 text-[12px] text-ink transition hover:bg-white">→</button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-10">
        {/* CICLO — contexto do processo */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-3 text-[11px] text-t3 shadow-[0_1px_2px_rgba(21,21,33,0.03)]">
          {['Briefing & Copy', 'Curadoria', 'Arte', 'Aprovação cliente', 'Programação & Publicação', 'Análise'].map((s, i) => {
            const atual = i === 4;
            const feito = i < 4;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: atual ? 'var(--cal-agendado)' : feito ? 'var(--prazo-em-dia-soft)' : 'var(--bgSoft)',
                    color: atual ? '#fff' : feito ? 'var(--prazo-em-dia)' : 'var(--t3)',
                  }}
                >
                  {feito ? '✓' : i + 1}
                </span>
                <span className={atual ? 'font-semibold text-ink' : ''}>{s}</span>
                {i < 5 && <span className="ml-1 text-t3">→</span>}
              </div>
            );
          })}
        </div>

        {/* ============ SEÇÃO 1: VISÃO GERAL ============ */}
        <section>
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
              Visão geral do mês
            </h2>
            <span className="rounded-full bg-[var(--cal-aprovacao-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
              Seção 1
            </span>
          </div>
          <p className="mb-4 max-w-prose text-[12px] leading-[1.55] text-t3">
            Quantos posts existem no calendário e em que estágio da publicação estão. Painel que a Gestão de Projetos abre primeiro pra pegar o status do mês num relance.
          </p>

          {/* Tiles */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile cor="var(--t3)"                 label="Total no calendário"    valor={total} />
            <Tile cor="var(--prazo-chegando)"     label="Prontos p/ programar"    valor={prontosCount} />
            <Tile cor="var(--cal-agendado)"       label="Programados"             valor={programadosCount} />
            <Tile cor="var(--prazo-em-dia)"       label="Publicados"              valor={publicadosCount} />
          </div>

          {/* Progress */}
          <div className="mb-4 card p-4">
            <div className="flex items-baseline justify-between text-[12px] text-t2">
              <span>Progresso da publicação</span>
              <span>
                <b className="text-ink">{encaminhados}</b> de {total} encaminhados
                {total > 0 && (
                  <span className="ml-1 text-t3">
                    · {Math.round((encaminhados / total) * 100)}%
                  </span>
                )}
              </span>
            </div>
            <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full bg-bgSoft">
              <div style={{ width: `${barra.pub}%`, background: 'var(--prazo-em-dia)' }} />
              <div style={{ width: `${barra.prg}%`, background: 'var(--cal-agendado)' }} />
              <div style={{ width: `${barra.aguard}%`, background: 'var(--prazo-chegando)' }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-t2">
              <LegendaSwatch cor="var(--prazo-em-dia)" label={`Publicados ${publicadosCount}`} />
              <LegendaSwatch cor="var(--cal-agendado)" label={`Programados ${programadosCount}`} />
              <LegendaSwatch cor="var(--prazo-chegando)" label={`Aguardando ${prontosCount}`} />
            </div>
          </div>

          {/* Calendário do mês com títulos */}
          <div className="card p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-t3">
              {MESES[month - 1]} {year} · datas de publicação
            </h3>
            <div className="grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="px-2 py-1 text-[10px] font-semibold text-t3">{d}</div>
              ))}
              {celulas.map((dia, i) => {
                const doDia = dia ? postsPorDia.get(dia) ?? [] : [];
                const ehHoje = dia === hojeMarcado;
                return (
                  <div
                    key={i}
                    className={`min-h-[96px] rounded-lg border p-1.5 ${
                      dia
                        ? ehHoje
                          ? 'border-transparent bg-white ring-2 ring-inset ring-[var(--cal-agendado)]'
                          : 'border-[rgba(21,21,33,0.06)] bg-white'
                        : 'border-transparent bg-bgSoft/40'
                    }`}
                  >
                    {dia && (
                      <>
                        <div
                          className={`mb-1 text-[11px] font-semibold ${
                            ehHoje ? 'text-[var(--cal-agendado)]' : 'text-t2'
                          }`}
                        >
                          {dia}
                          {ehHoje && <span className="ml-1 text-[9px] font-bold uppercase">hoje</span>}
                        </div>
                        <div className="space-y-1">
                          {doDia.slice(0, 3).map((p) => {
                            const info = BUCKET_INFO[balde(p)];
                            return (
                              <button
                                type="button"
                                key={p.id}
                                onClick={() => setPostAberto(p)}
                                className="block w-full rounded-md px-1.5 py-1 text-left transition hover:opacity-80"
                                style={{ background: info.bg, color: info.fg }}
                                title={`${tituloSeguro(p.titulo)} · ${info.label}`}
                              >
                                <span className="block truncate text-[10px] font-medium leading-tight">
                                  {tituloSeguro(p.titulo)}
                                </span>
                                <span
                                  className="mt-1 inline-block rounded-sm px-1 py-[1px] text-[8px] font-bold uppercase tracking-[0.06em] text-white"
                                  style={{ background: info.fg }}
                                >
                                  {info.label}
                                </span>
                              </button>
                            );
                          })}
                          {doDia.length > 3 && (
                            <div className="px-1 text-[9px] text-t3">
                              +{doDia.length - 3}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-t2">
              <LegendaSwatch cor="var(--prazo-em-dia)" label="Publicado" />
              <LegendaSwatch cor="var(--cal-agendado)" label="Programado" />
              <LegendaSwatch cor="var(--prazo-chegando)" label="Aguardando" />
              <LegendaSwatch cor="var(--prazo-atrasado)" label="Ajuste" />
              <LegendaSwatch cor="var(--prazo-hoje)" label="Em produção" />
            </div>
          </div>
        </section>

        {/* ============ SEÇÃO 2: PRONTOS ============ */}
        <section>
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
              Prontos para programar
            </h2>
            <span className="rounded-full bg-[var(--cal-aprovacao-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
              Seção 2
            </span>
          </div>
          <p className="mb-4 max-w-prose text-[12px] leading-[1.55] text-t3">
            Posts com arte aprovada aguardando agendamento. Botão <b className="text-t2">Programar</b> muda o status pra <b className="text-t2">Agendado</b> no Notion. Cards em ajuste ficam bloqueados.
          </p>

          {/* Filtros */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Filtro ativo={filtroFmt === 'todos'} onClick={() => setFiltroFmt('todos')}>
              Todos ({cats.pronto.length})
            </Filtro>
            <Filtro ativo={filtroFmt === 'reels'} onClick={() => setFiltroFmt('reels')}>
              Reels ({cats.pronto.filter((p) => p.tipo === 'reels').length})
            </Filtro>
            <Filtro ativo={filtroFmt === 'post'} onClick={() => setFiltroFmt('post')}>
              Carrossel ({cats.pronto.filter((p) => p.tipo === 'post').length})
            </Filtro>
            <Filtro ativo={filtroFmt === 'story'} onClick={() => setFiltroFmt('story')}>
              Stories ({cats.pronto.filter((p) => p.tipo === 'story').length})
            </Filtro>
          </div>

          {/* Cards + ajustes juntos (ajuste aparece como card bloqueado) */}
          {prontosFiltrados.length === 0 && cats.ajuste.length === 0 ? (
            <div className="card p-6 text-center text-[13px] text-t3">
              Nenhum post aguardando programação nesse filtro.
            </div>
          ) : (
            <div className="space-y-3">
              {prontosFiltrados.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  thumbnailFileId={thumbnails[p.id] ?? null}
                  legenda={legendas[p.id] ?? null}
                  bucket="pronto"
                  onProgramar={() => setPostAberto(p)}
                />
              ))}
              {filtroFmt === 'todos' && cats.ajuste.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  thumbnailFileId={thumbnails[p.id] ?? null}
                  legenda={legendas[p.id] ?? null}
                  bucket="ajuste"
                />
              ))}
            </div>
          )}
        </section>

        {/* ============ SEÇÃO EM PRODUÇÃO ============ */}
        {cats.outro.length > 0 && (
          <section>
            <div className="mb-1 flex items-baseline gap-2">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
                Em produção
              </h2>
              <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-t3">
                {cats.outro.length}
              </span>
            </div>
            <p className="mb-4 max-w-prose text-[12px] leading-[1.55] text-t3">
              Posts do mês que ainda estão sendo produzidos (briefing, copy, curadoria, arte ou aprovação em andamento). Aparecem aqui até a arte ser aprovada e caírem em <b className="text-t2">Prontos para programar</b>.
            </p>
            <div className="card divide-y divide-[rgba(21,21,33,0.06)] p-0">
              <div className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 bg-bgSoft/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                <span>Post</span>
                <span>Formato</span>
                <span>Data</span>
                <span>Etapa</span>
              </div>
              {cats.outro.map((p) => (
                <div key={p.id} className="grid grid-cols-[1.6fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 text-[13px]">
                  <Link href={`/post/${p.id}`} className="min-w-0 truncate font-semibold text-ink hover:text-mauve">
                    {tituloSeguro(p.titulo)}
                  </Link>
                  <span className="text-t2">{FORMATO_LABELS[p.tipo] ?? 'Post'}</span>
                  <span className="text-t2">{fmtDiaLongo(p.data)}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                    style={{ background: 'var(--bgSoft)', color: 'var(--t2)' }}
                  >
                    {p.etapaLabel || p.tarefaAtualTitulo || 'Em produção'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============ SEÇÃO 3: COMO PROGRAMAR ============ */}
        <section>
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
              Como programar um post
            </h2>
            <span className="rounded-full bg-[var(--cal-aprovacao-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
              Seção 3
            </span>
          </div>
          <p className="mb-4 max-w-prose text-[12px] leading-[1.55] text-t3">
            Passo a passo padrão da Lud. — sempre visível pra quem está aprendendo o processo ou cobrindo alguém.
          </p>
          <div className="card p-5">
            <ol className="space-y-3">
              {[
                <><b className="text-ink">Confirme o status Aprovado.</b> Só programe posts com arte e copy aprovadas pelo cliente. Cards em ajuste ficam bloqueados.</>,
                <><b className="text-ink">Confira data e horário</b> previstos no calendário do mês. Se precisar mudar, ajuste aqui e registre o motivo.</>,
                <><b className="text-ink">Revise a copy final</b> — legenda sem travessão, CTA no fim e de 5 a 12 hashtags.</>,
                <><b className="text-ink">Selecione o canal e formato</b> — Feed, Reels ou Stories. Confirme se a arte está no tamanho certo.</>,
                <><b className="text-ink">Anexe arte + copy aprovadas.</b> O sistema puxa direto do material curado, sem copy-paste manual.</>,
                <><b className="text-ink">Defina data e horário</b> de publicação e confirme. O status muda pra <span style={{ color: 'var(--cal-agendado)' }} className="font-semibold">Programado</span>.</>,
                <><b className="text-ink">No dia, verifique a publicação.</b> Foi ao ar? Marque como <span style={{ color: 'var(--prazo-em-dia)' }} className="font-semibold">Publicado</span> e feche o ciclo.</>,
              ].map((li, i) => (
                <li key={i} className="flex items-start gap-3 border-b border-dashed border-[rgba(21,21,33,0.06)] pb-3 text-[13px] leading-[1.55] text-t2 last:border-b-0 last:pb-0">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: 'var(--cal-aprovacao-soft)', color: 'var(--cal-aprovacao)' }}
                  >
                    {i + 1}
                  </span>
                  <span>{li}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============ SEÇÃO 4: PROGRAMADOS ============ */}
        <section>
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Programados</h2>
            <span className="rounded-full bg-[var(--cal-aprovacao-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
              Seção 4
            </span>
          </div>
          <p className="mb-4 max-w-prose text-[12px] leading-[1.55] text-t3">
            Já agendados, esperando a data chegar. Confere de relance o que vai ao ar e quando.
          </p>
          <PostTabela posts={cats.programado} vazioLabel="Nenhum post agendado neste mês." acaoLabel="Reprogramar" onAcao={(p) => setPostAberto(p)} />
        </section>

        {/* ============ SEÇÃO 5: PUBLICADOS ============ */}
        <section>
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Publicados</h2>
            <span className="rounded-full bg-[var(--cal-aprovacao-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
              Seção 5
            </span>
          </div>
          <p className="mb-4 max-w-prose text-[12px] leading-[1.55] text-t3">
            O que já foi ao ar no mês. Fecha o ciclo da programação e alimenta a próxima <b className="text-t2">Análise de Resultados</b>.
          </p>
          <PostTabela posts={cats.publicado} vazioLabel="Nenhum post publicado neste mês ainda." acaoLabel="Abrir" onAcao={(p) => setPostAberto(p)} />

          {cats.publicado.length > 0 && encaminhados === total && total > 0 && (
            <div
              className="mt-4 rounded-2xl border border-dashed p-4 text-[13px] text-t2"
              style={{ borderColor: 'var(--cal-agendado)', background: 'var(--cal-agendado-soft)' }}
            >
              <b className="text-ink">Encerramento do ciclo →</b> todos os posts do mês estão encaminhados. A partir daqui, os dados alimentam a <Link href="/admin/analise" className="font-semibold text-ink underline">Análise de Resultados</Link>.
            </div>
          )}
        </section>
      </main>

      {postAberto && (
        <PostModal
          post={postAberto}
          thumbnailFileId={thumbnails[postAberto.id] ?? null}
          onClose={() => setPostAberto(null)}
          onProgramado={() => { setPostAberto(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ─────────── COMPONENTES ───────────

function Tile({ cor, label, valor }: { cor: string; label: string; valor: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-t3">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: cor }} />
        {label}
      </div>
      <div className="mt-2 font-mono text-[32px] font-semibold tracking-[-0.03em] text-ink">
        {valor}
      </div>
    </div>
  );
}

function LegendaSwatch({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: cor }} />
      {label}
    </span>
  );
}

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
        ativo
          ? 'border-[var(--cal-aprovacao)] bg-[var(--cal-aprovacao-soft)] text-[var(--cal-aprovacao)]'
          : 'border-[rgba(21,21,33,0.1)] bg-white text-t2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function PostCard({
  post,
  thumbnailFileId,
  legenda,
  bucket,
  onProgramar,
}: {
  post: PostCalendario;
  thumbnailFileId: string | null;
  legenda: string | null;
  bucket: Bucket;
  onProgramar?: () => void;
}) {
  const info = BUCKET_INFO[bucket];
  const bloqueado = bucket === 'ajuste';
  const legendaResumida = legenda ? legenda.trim().slice(0, 240) : '';
  const legendaHashtags = legenda
    ? (legenda.match(/#[\p{L}0-9_]+/gu) ?? []).slice(0, 6).join(' ')
    : '';

  return (
    <div className="card grid gap-4 p-4 sm:grid-cols-[112px_1fr_auto]">
      {/* thumb */}
      <div className="relative aspect-square w-28 overflow-hidden rounded-xl bg-bgSoft">
        {thumbnailFileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/drive/preview/${thumbnailFileId}`} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-t3">
            sem prévia
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-ink/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-white">
          {FORMATO_LABELS[post.tipo] ?? 'Post'}
        </span>
      </div>

      {/* body */}
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
          {tituloSeguro(post.titulo)}
        </h3>
        <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-t3">
          <span>📅 <b className="text-t2">{fmtDiaLongo(post.data)}</b></span>
          {post.projetoNome && <span>🎯 {post.projetoNome}</span>}
          {post.etapaLabel && <span>🔧 {post.etapaLabel}</span>}
        </div>
        {legendaResumida && (
          <div className="mt-2 rounded-lg bg-bgSoft/60 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Legenda
            </span>
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-[12px] leading-[1.55] text-t2">
              {legendaResumida}
              {legenda && legenda.length > 240 && '…'}
            </p>
            {legendaHashtags && (
              <p className="mt-1 truncate text-[11px] text-[var(--cal-aprovacao)]">
                {legendaHashtags}
              </p>
            )}
          </div>
        )}
        {post.tarefaAtualTitulo && (
          <div className="mt-2 rounded-lg bg-bgSoft/60 px-3 py-2 text-[12px] text-t2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">Próximo passo</span>
            <div className="mt-0.5">{post.tarefaAtualTitulo}</div>
          </div>
        )}
      </div>

      {/* side */}
      <div className="flex min-w-[150px] flex-col items-end gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ background: info.bg, color: info.fg }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: info.fg }} />
          {info.label}
        </span>
        {onProgramar && !bloqueado && (
          <button
            type="button"
            onClick={onProgramar}
            className="btn-primary w-full justify-center whitespace-nowrap"
          >
            📅 Programar
          </button>
        )}
        {bloqueado && (
          <button type="button" disabled className="btn-primary w-full cursor-not-allowed justify-center opacity-40">
            Programar
          </button>
        )}
        <Link
          href={`/post/${post.id}`}
          className="w-full rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3 py-1.5 text-center text-[11px] font-medium text-ink transition hover:bg-bgSoft"
        >
          Ver material
        </Link>
      </div>
    </div>
  );
}

function PostTabela({
  posts,
  vazioLabel,
  acaoLabel,
  onAcao,
}: {
  posts: PostCalendario[];
  vazioLabel: string;
  acaoLabel: string;
  onAcao: (p: PostCalendario) => void;
}) {
  if (posts.length === 0) {
    return <div className="card p-6 text-center text-[13px] text-t3">{vazioLabel}</div>;
  }
  return (
    <div className="card divide-y divide-[rgba(21,21,33,0.06)] p-0">
      <div className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 bg-bgSoft/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        <span>Post</span>
        <span>Formato</span>
        <span>Data</span>
        <span></span>
      </div>
      {posts.map((p) => (
        <div key={p.id} className="grid grid-cols-[1.6fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 text-[13px]">
          <Link href={`/post/${p.id}`} className="min-w-0 truncate font-semibold text-ink hover:text-mauve">
            {tituloSeguro(p.titulo)}
          </Link>
          <span className="text-t2">{FORMATO_LABELS[p.tipo] ?? 'Post'}</span>
          <span className="text-t2">{fmtDiaLongo(p.data)}</span>
          <button
            type="button"
            onClick={() => onAcao(p)}
            className="text-[12px] font-semibold text-[var(--cal-aprovacao)] transition hover:opacity-80"
          >
            {acaoLabel} →
          </button>
        </div>
      ))}
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
  const bucket = balde(post);
  const info = BUCKET_INFO[bucket];

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
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {thumbnailFileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/drive/preview/${thumbnailFileId}`} alt="" className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-20 items-center justify-center" style={{ background: info.bg, color: info.fg }}>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]">{info.label}</span>
          </div>
        )}
        <div className="space-y-4 p-5">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{ background: info.bg, color: info.fg }}
            >
              {info.label}
            </span>
            <h3 className="mt-2 text-[16px] font-semibold leading-snug text-ink">
              {tituloSeguro(post.titulo)}
            </h3>
            <div className="mt-2 text-[12px] text-t2">
              {fmtDiaLongo(post.data)}
              {post.projetoNome && ` · ${post.projetoNome}`}
              {post.tarefaAtualTitulo && ` · ${post.tarefaAtualTitulo}`}
            </div>
          </div>

          {erro && (
            <p className="rounded-md bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[11px] text-[var(--prazo-atrasado)]">
              ⚠️ {erro}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {bucket !== 'publicado' && (
              <button
                type="button"
                onClick={programar}
                disabled={loading || feito}
                className="btn-primary flex-1 justify-center whitespace-nowrap"
              >
                {feito ? '✓ Programado' : loading ? 'Programando…' : bucket === 'programado' ? '↻ Reprogramar' : '📅 Programar'}
              </button>
            )}
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
