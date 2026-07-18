'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { EntregaItem, PostCalendario, ProjetoListItem } from '@/lib/notion';
import type { ObjetivosSemana } from '@/lib/supabase';
import { classificarProjeto } from '@/lib/projetoServico';

function fmtDataLonga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const COR_STATUS: Record<PostCalendario['cor'], { bg: string; fg: string }> = {
  rascunho: { bg: 'var(--cal-rascunho-soft)', fg: 'var(--cal-rascunho)' },
  aprovacao: { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' },
  alteracao: { bg: 'var(--cal-alteracao-soft)', fg: 'var(--cal-alteracao)' },
  aguardando: { bg: 'var(--cal-aprovacao-soft)', fg: 'var(--cal-aprovacao)' },
  agendado: { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' },
  publicado: { bg: 'var(--prazo-em-dia-soft)', fg: 'var(--prazo-em-dia)' },
};

function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim) return 'Sem título';
  if (/^https?:\/\/\S+$/.test(trim) && !trim.includes(' ')) return 'Sem título';
  return trim;
}

export function GestaoView({
  projetos,
  postsHoje,
  objetivosIniciais,
  entregasAtrasadas,
  entregasSemana,
  podeEditar,
}: {
  projetos: ProjetoListItem[];
  postsHoje: PostCalendario[];
  objetivosIniciais: Record<string, ObjetivosSemana>;
  entregasAtrasadas: EntregaItem[];
  entregasSemana: EntregaItem[];
  podeEditar: boolean;
}) {
  const hoje = new Date();
  const isoHoje = hoje.toISOString().slice(0, 10);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin" className="text-[11px] text-mauve transition hover:text-ink">
              ← Admin
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              Gestão de Projetos
            </h1>
            <p className="text-[11px] text-t3">{fmtDataLonga(isoHoje)}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-[12px]">
            <Link
              href="/programacao"
              className="rounded-full bg-bgSoft px-3 py-1.5 text-ink transition hover:bg-white"
            >
              📅 Programação
            </Link>
            <Link
              href="/admin/analise"
              className="rounded-full bg-bgSoft px-3 py-1.5 text-ink transition hover:bg-white"
            >
              📊 Análise
            </Link>
            <Link
              href="/admin/entrega"
              className="rounded-full bg-bgSoft px-3 py-1.5 text-ink transition hover:bg-white"
            >
              🚚 Entregas
            </Link>
            <Link
              href="/admin/sync"
              className="rounded-full bg-bgSoft px-3 py-1.5 text-ink transition hover:bg-white"
            >
              ↻ Sync
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-8">
        {/* Postagens de hoje */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
              Postagens de hoje
            </h2>
            <span className="text-[11px] text-t3">
              {postsHoje.length} {postsHoje.length === 1 ? 'post' : 'posts'}
            </span>
          </div>
          {postsHoje.length === 0 ? (
            <div className="card p-6 text-center text-[13px] text-t3">
              Nenhum post programado pra hoje.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {postsHoje.map((p) => {
                const cor = COR_STATUS[p.cor];
                return (
                  <Link
                    key={p.id}
                    href={`/post/${p.id}`}
                    className="card group flex items-start gap-3 p-3 transition hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]"
                  >
                    <div
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[16px]"
                      style={{ background: cor.bg, color: cor.fg }}
                    >
                      {p.icon && /^https?:\/\//.test(p.icon) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.icon}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{p.icon ?? '📱'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">
                        {tituloSeguro(p.titulo)}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-t3">
                        {p.projetoNome}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]"
                          style={{ background: cor.bg, color: cor.fg }}
                        >
                          {p.etapaLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Entregas com atraso — o que a equipe precisa destravar agora */}
        {entregasAtrasadas.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--prazo-atrasado)]">
                ⚠️ Entregas com atraso
              </h2>
              <span className="text-[11px] text-t3">
                {entregasAtrasadas.length} {entregasAtrasadas.length === 1 ? 'entrega' : 'entregas'}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {entregasAtrasadas.map((e) => (
                <Link
                  key={e.id}
                  href={`/admin/entrega/${e.id}`}
                  className="card group flex items-start gap-3 p-3 transition hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]"
                >
                  <div
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold"
                    style={{
                      background: 'var(--prazo-atrasado-soft)',
                      color: 'var(--prazo-atrasado)',
                    }}
                  >
                    {e.atrasadas}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">
                      {e.nome}
                    </div>
                    {e.proximaEntregaTexto && (
                      <div className="mt-0.5 truncate text-[11px] text-t3">
                        próxima: {e.proximaEntregaTexto}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-t2">
                      {e.atrasadas} {e.atrasadas === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
                      {e.totalTarefas > 0 && ` · ${e.totalTarefas} tarefas totais`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Entregas dos próximos 7 dias — planning */}
        {entregasSemana.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
                Entregas da semana
              </h2>
              <span className="text-[11px] text-t3">
                {entregasSemana.length} {entregasSemana.length === 1 ? 'entrega' : 'entregas'}
              </span>
            </div>
            <div className="card divide-y divide-[rgba(21,21,33,0.06)] p-0">
              {entregasSemana.map((e) => (
                <Link
                  key={e.id}
                  href={`/admin/entrega/${e.id}`}
                  className="group flex items-center gap-3 p-3 transition hover:bg-bgSoft/60"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bgSoft text-[11px] font-mono font-semibold text-ink"
                    title="Próxima data"
                  >
                    {e.proximaData ?? '—'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">
                      {e.nome}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-t3">
                      {e.proximaEntregaTexto ?? e.frequencia ?? '—'}
                      {e.atrasadas > 0 && (
                        <span
                          className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                          style={{
                            background: 'var(--prazo-atrasado-soft)',
                            color: 'var(--prazo-atrasado)',
                          }}
                        >
                          {e.atrasadas} atrasada{e.atrasadas === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-mauve transition group-hover:text-ink">
                    abrir
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Objetivos da semana — 1 card editável por projeto */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
              Objetivos da semana
            </h2>
            <span className="text-[11px] text-t3">
              {podeEditar ? 'Editável — auto-save' : 'Somente leitura'}
            </span>
          </div>
          {projetos.length === 0 ? (
            <div className="card p-6 text-center text-[13px] text-t3">
              Nenhum projeto de social media ativo.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {projetos.map((p) => (
                <CardObjetivos
                  key={p.id}
                  projeto={p}
                  inicial={objetivosIniciais[p.id]}
                  podeEditar={podeEditar}
                />
              ))}
            </div>
          )}
        </section>

        {/* Projetos ativos — grid enxuto pra navegar */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-t3">
              Projetos ativos
            </h2>
            <span className="text-[11px] text-t3">
              {projetos.length} {projetos.length === 1 ? 'projeto' : 'projetos'}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projetos.map((p) => {
              const servico = classificarProjeto(p.nome);
              return (
                <Link
                  key={p.id}
                  href={`/admin/projetos/${p.id}`}
                  className="card group p-3 transition hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)]"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                    {servico}
                  </div>
                  <div className="mt-1 truncate text-[13px] font-semibold text-ink">
                    {p.nome}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-t3">
                    {p.clienteNome}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Próximas fases */}
        <section className="card p-5">
          <h3 className="text-[13px] font-semibold text-ink">Falta ainda</h3>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-[1.6] text-t2">
            <li>
              <b>Tarefas agregadas por colaborador</b> — quem tá com mais coisa
              travada nessa semana.
            </li>
            <li>
              <b>Reuniões</b> — próximas + histórico do banco de Reuniões do
              Notion.
            </li>
            <li>
              <b>Gráficos de saúde</b> — proporção aprovado / em alteração /
              agendado por projeto, tendência semanal.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function CardObjetivos({
  projeto,
  inicial,
  podeEditar,
}: {
  projeto: ProjetoListItem;
  inicial: ObjetivosSemana;
  podeEditar: boolean;
}) {
  const [texto, setTexto] = useState(inicial.texto);
  const [status, setStatus] = useState<'limpo' | 'salvando' | 'salvo' | 'erro'>('limpo');
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(inicial.atualizadoEm);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiro = useRef(true);

  useEffect(() => {
    if (!podeEditar) return;
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus('limpo');
    debounceRef.current = setTimeout(async () => {
      setStatus('salvando');
      try {
        const r = await fetch('/api/gestao/objetivos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projetoId: projeto.id, texto }),
        });
        if (!r.ok) throw new Error();
        setStatus('salvo');
        setUltimoSalvo(new Date().toISOString());
      } catch {
        setStatus('erro');
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [texto, projeto.id, podeEditar]);

  const servico = classificarProjeto(projeto.nome);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            {servico} · {projeto.clienteNome}
          </div>
          <div className="mt-0.5 truncate text-[14px] font-semibold text-ink">
            {projeto.nome}
          </div>
        </div>
        {podeEditar && (
          <span
            className="shrink-0 text-[10px]"
            style={{
              color:
                status === 'erro'
                  ? 'var(--prazo-atrasado)'
                  : status === 'salvando'
                    ? 'var(--prazo-chegando)'
                    : 'var(--t3)',
            }}
          >
            {status === 'salvando'
              ? '💾 Salvando…'
              : status === 'salvo'
                ? '✓ Salvo'
                : status === 'erro'
                  ? '⚠️ Erro'
                  : ultimoSalvo
                    ? `Salvo às ${new Date(ultimoSalvo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
          </span>
        )}
      </div>
      {podeEditar ? (
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreve o foco da semana, o que precisa acontecer, quem faz o quê…"
          rows={5}
          className="input mt-3 w-full resize-y text-[13px] leading-[1.55]"
        />
      ) : texto ? (
        <p className="mt-3 whitespace-pre-line text-[13px] leading-[1.55] text-t1">
          {texto}
        </p>
      ) : (
        <p className="mt-3 text-[12px] italic text-t3">— em branco —</p>
      )}
    </div>
  );
}
