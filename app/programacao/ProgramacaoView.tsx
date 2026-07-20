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
  pronto:    { label: 'Programar',               bg: 'var(--prazo-chegando-soft)', fg: 'var(--prazo-chegando)' },
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

/** Remove emojis, símbolos e espaços do começo/fim da string.
 *  A fórmula Status Geral do Notion vem com prefixo tipo "✅ Postado" —
 *  a gente quer só o texto. */
function semEmoji(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{So}\p{Sk}️‍]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Label específico pra chip/pill do post — reflete o Status Geral do
 *  Notion (que aparece nos chips coloridos do calendário lá) ou a tarefa
 *  atual como fallback. Mantém a cor do balde pra agrupar visualmente. */
function labelChip(p: PostCalendario, bucket: Bucket): string {
  const sg = semEmoji(p.statusGeral ?? '');
  if (sg) return sg;
  const t = semEmoji(p.tarefaAtualTitulo ?? '');
  if (t) return t;
  return BUCKET_INFO[bucket].label;
}

/** Cor específica por Status Geral do Notion. Diferentes estágios ganham
 *  cores distintas mesmo caindo no mesmo balde (ex: "Postado" e "Conferir
 *  Postagem" caem em publicado, mas visualmente se distinguem). Fallback:
 *  cor do balde. */
function coresChip(p: PostCalendario, bucket: Bucket): { bg: string; fg: string } {
  const sg = (p.statusGeral ?? '').trim().toLowerCase();
  if (sg.includes('postado')) return { bg: 'var(--prazo-em-dia-soft)', fg: 'var(--prazo-em-dia)' };
  if (sg.includes('conferir postagem')) return { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' };
  if (sg === 'programar') return { bg: 'var(--prazo-chegando-soft)', fg: 'var(--prazo-chegando)' };
  if (sg.includes('aprova')) return { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' };
  if (sg.includes('altera')) return { bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)' };
  if (sg.includes('arte')) return { bg: '#EFE9F5', fg: '#7A5AA6' };
  if (sg.includes('copy') || sg.includes('briefing')) return { bg: '#E7ECF3', fg: '#4A6280' };
  if (sg.includes('curador')) return { bg: '#F5EEE1', fg: '#8A6E3E' };
  if (sg.includes('material') || sg.includes('info')) return { bg: '#EEEEEE', fg: '#5A5A5A' };
  return BUCKET_INFO[bucket];
}

/** Classifica o post em um dos 5 baldes visíveis na página.
 *
 *  Prioridade: statusGeral (fórmula do Notion — o que aparece na tag verde
 *  do calendário lá) tem precedência sobre `p.cor`, que vem da etapa
 *  derivada de tarefas. Assim o balde bate com o que a equipe vê no Notion,
 *  mesmo quando a etapa interna (producao/etc) discorda. */
function balde(p: PostCalendario): Bucket {
  const sg = (p.statusGeral ?? '').trim().toLowerCase();
  const t = (p.tarefaAtualTitulo ?? '').toLowerCase();

  // 1. Status Geral do Notion tem precedência
  if (sg.includes('postado')) return 'publicado';
  if (sg.includes('conferir postagem')) return 'publicado';
  if (sg === 'programar' || t.includes('programar')) return 'pronto';
  if (sg.includes('altera')) return 'ajuste';

  // 2. Fallback pela cor derivada da etapa
  if (p.cor === 'publicado') return 'publicado';
  if (p.cor === 'agendado') return 'programado';
  if (p.cor === 'alteracao') return 'ajuste';
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
  const [mostrarComoProgramar, setMostrarComoProgramar] = useState(false);

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

  // Área de programação = prontos + em ajuste (bloqueados). Sem filtros.
  const areaProgramacao = useMemo(
    () => [...cats.pronto, ...cats.ajuste].sort((a, b) => (a.data > b.data ? 1 : -1)),
    [cats.pronto, cats.ajuste],
  );

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
            <Tile cor="var(--prazo-chegando)"     label="Programar"               valor={prontosCount} />
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
              <LegendaSwatch cor="var(--prazo-chegando)" label={`Programar ${prontosCount}`} />
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
                            const b = balde(p);
                            const cores = coresChip(p, b);
                            const label = labelChip(p, b);
                            return (
                              <button
                                type="button"
                                key={p.id}
                                onClick={() => setPostAberto(p)}
                                className="block w-full rounded-md px-1.5 py-1 text-left transition hover:opacity-80"
                                style={{ background: cores.bg, color: cores.fg }}
                                title={`${tituloSeguro(p.titulo)} · ${label}`}
                              >
                                <span className="block truncate text-[10px] font-medium leading-tight">
                                  {tituloSeguro(p.titulo)}
                                </span>
                                <span
                                  className="mt-1 inline-block max-w-full truncate rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-[0.06em] text-white"
                                  style={{ background: cores.fg }}
                                >
                                  {label}
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
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-t2">
              <LegendaSwatch cor="var(--prazo-em-dia)" label="Postado" />
              <LegendaSwatch cor="var(--cal-agendado)" label="Conferir Postagem" />
              <LegendaSwatch cor="var(--prazo-chegando)" label="Programar" />
              <LegendaSwatch cor="var(--cal-aprovacao)" label="Em Aprovação" />
              <LegendaSwatch cor="var(--prazo-atrasado)" label="Em Alteração" />
              <LegendaSwatch cor="#7A5AA6" label="Arte" />
              <LegendaSwatch cor="#4A6280" label="Copy / Briefing" />
              <LegendaSwatch cor="#8A6E3E" label="Curadoria" />
              <LegendaSwatch cor="#5A5A5A" label="Material / Info" />
              <LegendaSwatch cor="var(--prazo-hoje)" label="Em produção (outros)" />
            </div>
          </div>
        </section>

        {/* ============ ÁREA DE PROGRAMAÇÃO ============ */}
        <section>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
                Área de programação
              </h2>
              <span className="rounded-full bg-[var(--cal-aprovacao-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
                Seção 2
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMostrarComoProgramar(true)}
              className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3 py-1 text-[11px] font-medium text-t2 transition hover:text-ink"
            >
              Como programar
            </button>
          </div>
          <p className="mb-4 max-w-prose text-[12px] leading-[1.55] text-t3">
            Posts com arte aprovada aguardando agendamento. Clique em <b className="text-t2">Programar</b> pra abrir a página de configuração (horário, plataformas, legenda). Cards em ajuste ficam bloqueados.
          </p>

          {areaProgramacao.length === 0 ? (
            <div className="card p-6 text-center text-[13px] text-t3">
              Nenhum post pronto pra programar neste mês.
            </div>
          ) : (
            <div className="card divide-y divide-[rgba(21,21,33,0.06)] p-0">
              <div className="grid grid-cols-[1fr_1.5fr_0.8fr_1fr_auto] gap-3 bg-bgSoft/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                <span>Etapa</span>
                <span>Post</span>
                <span>Formato</span>
                <span>Data</span>
                <span>Ação</span>
              </div>
              {areaProgramacao.map((p) => {
                const b = balde(p);
                const cores = coresChip(p, b);
                const bloqueado = b === 'ajuste';
                const label = labelChip(p, b);
                return (
                  <div key={p.id} className="grid grid-cols-[1fr_1.5fr_0.8fr_1fr_auto] items-center gap-3 px-4 py-3 text-[13px]">
                    <span
                      className="max-w-full truncate justify-self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                      style={{ background: cores.bg, color: cores.fg }}
                      title={label}
                    >
                      {label}
                    </span>
                    <Link href={`/post/${p.id}`} className="min-w-0 truncate font-semibold text-ink hover:text-mauve">
                      {tituloSeguro(p.titulo)}
                    </Link>
                    <span className="text-t2">{FORMATO_LABELS[p.tipo] ?? 'Post'}</span>
                    <span className="text-t2">{fmtDiaLongo(p.data)}</span>
                    {bloqueado ? (
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-full bg-bgSoft px-3 py-1 text-[11px] font-semibold text-t3"
                        title="Post em alteração — não dá pra programar até resolver"
                      >
                        Bloqueado
                      </button>
                    ) : (
                      <Link
                        href={`/programacao/${p.id}`}
                        className="rounded-full bg-[var(--cal-aprovacao)] px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90"
                      >
                        Programar →
                      </Link>
                    )}
                  </div>
                );
              })}
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
              <div className="grid grid-cols-[1fr_1.6fr_1fr_1fr] gap-3 bg-bgSoft/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                <span>Etapa</span>
                <span>Post</span>
                <span>Formato</span>
                <span>Data</span>
              </div>
              {cats.outro.map((p) => {
                const b = balde(p);
                const cores = coresChip(p, b);
                const label = labelChip(p, b);
                return (
                <div key={p.id} className="grid grid-cols-[1fr_1.6fr_1fr_1fr] items-center gap-3 px-4 py-3 text-[13px]">
                  <span
                    className="max-w-full truncate justify-self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                    style={{ background: cores.bg, color: cores.fg }}
                    title={label}
                  >
                    {label}
                  </span>
                  <Link href={`/post/${p.id}`} className="min-w-0 truncate font-semibold text-ink hover:text-mauve">
                    {tituloSeguro(p.titulo)}
                  </Link>
                  <span className="text-t2">{FORMATO_LABELS[p.tipo] ?? 'Post'}</span>
                  <span className="text-t2">{fmtDiaLongo(p.data)}</span>
                </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ============ PROGRAMADOS (visual cinza — já foi) ============ */}
        <section className="opacity-75 transition hover:opacity-100">
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-t2">Programados</h2>
            <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-t3">
              histórico
            </span>
          </div>
          <p className="mb-3 max-w-prose text-[11px] leading-[1.55] text-t3">
            Já agendados, esperando a data chegar.
          </p>
          <PostTabelaCinza
            posts={cats.programado}
            vazioLabel="Nenhum post agendado neste mês."
            acaoLabel="Reprogramar"
            onAcao={(p) => setPostAberto(p)}
          />
        </section>

        {/* ============ PUBLICADOS (visual cinza — já foi) ============ */}
        <section className="opacity-75 transition hover:opacity-100">
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-t2">Publicados</h2>
            <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-t3">
              já foi
            </span>
          </div>
          <p className="mb-3 max-w-prose text-[11px] leading-[1.55] text-t3">
            Fechou o ciclo — alimenta a próxima <b className="text-t2">Análise de Resultados</b>.
          </p>
          <PostTabelaCinza
            posts={cats.publicado}
            vazioLabel="Nenhum post publicado neste mês ainda."
            acaoLabel="Abrir"
            onAcao={(p) => setPostAberto(p)}
          />

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

      {mostrarComoProgramar && (
        <ComoProgramarModal onClose={() => setMostrarComoProgramar(false)} />
      )}
    </div>
  );
}

function ComoProgramarModal({ onClose }: { onClose: () => void }) {
  const passos: React.ReactNode[] = [
    <><b className="text-ink">Confirme o status Aprovado.</b> Só programe posts com arte e copy aprovadas pelo cliente. Cards em ajuste ficam bloqueados.</>,
    <><b className="text-ink">Confira data e horário</b> previstos no calendário do mês. Se precisar mudar, ajuste na página de programação e registre o motivo.</>,
    <><b className="text-ink">Revise a copy final</b> — legenda sem travessão, CTA no fim e de 5 a 12 hashtags.</>,
    <><b className="text-ink">Selecione o canal e formato</b> — Feed, Reels ou Stories. Confirme se a arte está no tamanho certo.</>,
    <><b className="text-ink">Anexe arte + copy aprovadas.</b> O sistema puxa direto do material curado, sem copy-paste manual.</>,
    <><b className="text-ink">Defina horário</b> e confirme. O status muda pra <span style={{ color: 'var(--cal-agendado)' }} className="font-semibold">Programado</span>.</>,
    <><b className="text-ink">No dia, verifique a publicação.</b> Foi ao ar? Marque como <span style={{ color: 'var(--prazo-em-dia)' }} className="font-semibold">Publicado</span> e feche o ciclo.</>,
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgba(21,21,33,0.06)] px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Educação
            </div>
            <h3 className="text-[16px] font-semibold text-ink">Como programar um post</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-t3 transition hover:bg-bgSoft hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <p className="mb-4 text-[12px] text-t3">
            Passo a passo padrão da Lud. — use quando estiver aprendendo ou cobrindo alguém.
          </p>
          <ol className="space-y-3">
            {passos.map((li, i) => (
              <li
                key={i}
                className="flex items-start gap-3 border-b border-dashed border-[rgba(21,21,33,0.06)] pb-3 text-[13px] leading-[1.55] text-t2 last:border-b-0 last:pb-0"
              >
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
      </div>
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
          <span><b className="text-t2">{fmtDiaLongo(post.data)}</b></span>
          {post.projetoNome && <span>{post.projetoNome}</span>}
          {post.etapaLabel && <span>{post.etapaLabel}</span>}
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

/** Versão cinza/apagada da PostTabela — pra Programados e Publicados
 *  (indicam "já foi"). Menor destaque visual que a área ativa em cima. */
function PostTabelaCinza({
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
    return (
      <div className="rounded-2xl border border-[rgba(21,21,33,0.06)] bg-bgSoft/30 p-5 text-center text-[12px] text-t3">
        {vazioLabel}
      </div>
    );
  }
  return (
    <div className="divide-y divide-[rgba(21,21,33,0.04)] rounded-2xl border border-[rgba(21,21,33,0.06)] bg-bgSoft/30 p-0">
      <div className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        <span>Post</span>
        <span>Formato</span>
        <span>Data</span>
        <span></span>
      </div>
      {posts.map((p) => (
        <div key={p.id} className="grid grid-cols-[1.6fr_1fr_1fr_auto] items-center gap-3 px-4 py-2.5 text-[12.5px]">
          <Link href={`/post/${p.id}`} className="min-w-0 truncate text-t2 hover:text-ink">
            {tituloSeguro(p.titulo)}
          </Link>
          <span className="text-t3">{FORMATO_LABELS[p.tipo] ?? 'Post'}</span>
          <span className="text-t3">{fmtDiaLongo(p.data)}</span>
          <button
            type="button"
            onClick={() => onAcao(p)}
            className="text-[11px] font-medium text-t3 transition hover:text-ink"
          >
            {acaoLabel}
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
}: {
  post: PostCalendario;
  thumbnailFileId: string | null;
  onClose: () => void;
  onProgramado: () => void;
}) {
  const bucket = balde(post);
  const info = BUCKET_INFO[bucket];

  const chipLabel = labelChip(post, bucket);

  // Label do botão conforme estado:
  // - publicado    → Reagendar (mudar data/hora de algo que já foi)
  // - programado   → Reprogramar
  // - pronto/outro → Programar
  // - ajuste       → botão desabilitado
  const acao = (() => {
    if (bucket === 'publicado') return { label: '↻ Reagendar', ativo: true };
    if (bucket === 'programado') return { label: '↻ Reprogramar', ativo: true };
    if (bucket === 'ajuste') return { label: 'Em alteração', ativo: false };
    return { label: 'Programar', ativo: true };
  })();

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
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]">{chipLabel}</span>
          </div>
        )}
        <div className="space-y-4 p-5">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{ background: info.bg, color: info.fg }}
            >
              {chipLabel}
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

          <div className="flex flex-wrap gap-2">
            {acao.ativo ? (
              <Link
                href={`/programacao/${post.id}`}
                className="btn-primary flex-1 justify-center whitespace-nowrap"
              >
                {acao.label}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="btn-primary flex-1 cursor-not-allowed justify-center whitespace-nowrap opacity-40"
              >
                {acao.label}
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
