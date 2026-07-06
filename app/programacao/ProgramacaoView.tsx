'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

function ehHoje(dia: number, mes: number, ano: number): boolean {
  const h = new Date();
  return (
    dia === h.getDate() && mes === h.getMonth() + 1 && ano === h.getFullYear()
  );
}

export function ProgramacaoView({
  projetos,
  projetoIdSelecionado,
  year,
  month,
  posts,
}: {
  projetos: ProjetoListItem[];
  projetoIdSelecionado: string;
  year: number;
  month: number;
  posts: PostCalendario[];
}) {
  const router = useRouter();

  function irPara(deltaMes: number) {
    let novoMes = month + deltaMes;
    let novoAno = year;
    if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    } else if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    }
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

  // Monta o grid do calendário: começa com nulls até o dia da semana do dia 1
  const primeiro = new Date(year, month - 1, 1);
  const ultimoDia = new Date(year, month, 0).getDate();
  const offset = primeiro.getDay(); // 0=domingo
  const totalCelulas = Math.ceil((offset + ultimoDia) / 7) * 7;
  const celulas: (number | null)[] = Array.from({ length: totalCelulas }, (_, i) => {
    const dia = i - offset + 1;
    return dia >= 1 && dia <= ultimoDia ? dia : null;
  });

  // Agrupa posts por dia
  const postsPorDia = new Map<number, PostCalendario[]>();
  for (const p of posts) {
    const [_, __, d] = p.data.split('-').map(Number);
    if (!postsPorDia.has(d)) postsPorDia.set(d, []);
    postsPorDia.get(d)!.push(p);
  }

  // Preview grid IG: TODOS os posts do mês com data, ordenados desc (mais recentes em cima)
  const postsPreview = [...posts].sort((a, b) => (a.data < b.data ? 1 : -1));

  const projetoNome = projetos.find((p) => p.id === projetoIdSelecionado)?.nome ?? 'Projeto';

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
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
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 rounded-full bg-bgSoft p-1">
              <button
                type="button"
                onClick={() => irPara(-1)}
                className="rounded-full px-3 py-1 text-[12px] text-ink transition hover:bg-white"
              >
                ←
              </button>
              <span className="min-w-[130px] px-2 text-center text-[12px] font-semibold text-ink">
                {MESES[month - 1]} {year}
              </span>
              <button
                type="button"
                onClick={() => irPara(1)}
                className="rounded-full px-3 py-1 text-[12px] text-ink transition hover:bg-white"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_clamp(280px,26%,360px)] lg:items-start">
          {/* Calendário mensal */}
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
                  <div
                    key={d}
                    className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {celulas.map((dia, i) => {
                  const postsDoDia = dia ? postsPorDia.get(dia) ?? [] : [];
                  const hoje = dia ? ehHoje(dia, month, year) : false;
                  return (
                    <div
                      key={i}
                      className={`min-h-[104px] border-b border-r border-[rgba(21,21,33,0.06)] p-1.5 last:border-r-0 ${
                        dia ? 'bg-white' : 'bg-bgSoft/20'
                      } ${hoje ? 'ring-1 ring-inset ring-[var(--cal-agendado)]' : ''}`}
                    >
                      {dia && (
                        <>
                          <div className="mb-1 flex items-baseline justify-between px-1">
                            <span
                              className={`text-[11px] font-semibold ${
                                hoje ? 'text-[var(--cal-agendado)]' : 'text-t2'
                              }`}
                            >
                              {dia}
                            </span>
                            {postsDoDia.length > 0 && (
                              <span className="text-[9px] text-t3">
                                {postsDoDia.length}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {postsDoDia.map((p) => {
                              const cor = COR_STATUS[p.cor];
                              return (
                                <Link
                                  key={p.id}
                                  href={`/post/${p.id}`}
                                  className="block rounded-md px-1.5 py-1 text-[10.5px] font-medium leading-tight transition hover:opacity-80"
                                  style={{
                                    background: cor.bg,
                                    color: cor.fg,
                                  }}
                                  title={`${p.titulo} · ${p.etapaLabel}`}
                                >
                                  <div className="flex items-center gap-1">
                                    {p.icon && (
                                      <span aria-hidden className="shrink-0 text-[11px]">
                                        {p.icon}
                                      </span>
                                    )}
                                    <span className="truncate">{p.titulo}</span>
                                  </div>
                                </Link>
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

            {/* Legenda das cores */}
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

          {/* Preview do grid IG */}
          <aside>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold text-ink">Preview do feed</h2>
              <span className="text-[11px] text-t3">como vai ficar</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-3">
              {postsPreview.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-t3">
                  Nenhum post agendado neste mês.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-0.5">
                  {postsPreview.map((p) => {
                    const cor = COR_STATUS[p.cor];
                    return (
                      <Link
                        key={p.id}
                        href={`/post/${p.id}`}
                        className="group relative block aspect-square overflow-hidden bg-bgSoft transition hover:opacity-80"
                        title={`${p.titulo} · ${p.data}`}
                      >
                        <div
                          className="flex h-full items-center justify-center px-1 text-center"
                          style={{ background: cor.bg }}
                        >
                          <span
                            className="line-clamp-3 text-[9px] font-semibold"
                            style={{ color: cor.fg }}
                          >
                            {p.titulo}
                          </span>
                        </div>
                        {/* Data no canto */}
                        <span className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 py-0.5 font-mono text-[8px] text-white">
                          {p.data.split('-')[2]}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-[10px] text-t3">
                Ordenado do post mais recente (topo) pro mais antigo. A cor reflete
                o status atual — vai mudando conforme o post avança.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
