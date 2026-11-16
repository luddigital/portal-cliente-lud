'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DiaGeral, MarcoGeral } from '@/lib/visao-geral';
import { rotas } from '@/lib/rotas';
import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';

function utc(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function textoDias(n: number) {
  if (n < 0) return n === -1 ? 'venceu ontem' : `venceu há ${-n} dias`;
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  return `em ${n} dias`;
}

/**
 * Pra onde vai o card (lib/rotas.ts): uma tarefa só → página da tarefa; várias
 * tarefas iguais juntas → a entrega do projeto (ou o projeto, sem entrega).
 */
const destinoDoCard = (t: { ids: string[]; tarefaId: string; entregaId?: string | null; projetoId: string }) =>
  t.ids.length > 1
    ? t.entregaId
      ? rotas.entregaDoProjeto(t.projetoId, t.entregaId)
      : rotas.projeto(t.projetoId)
    : rotas.tarefa(t.tarefaId);

/** Cliente de um marco = a entrega daquele projeto (sem entrega: a tarefa). */
const destinoDoCliente = (c: { entregaId: string | null; projetoId: string; tarefaId: string }) =>
  c.entregaId ? rotas.entregaDoProjeto(c.projetoId, c.entregaId) : rotas.tarefa(c.tarefaId);

/**
 * Dashboard: "Próximos 30 dias" e "Esta semana" de todos os clientes, no
 * mesmo layout da página do projeto. Check conclui a tarefa no Notion; clicar
 * numa tarefa abre a página dela; num card que junta várias, a entrega do cliente.
 */
export function SemanaEMarcos({ dias, marcos, hojeIso }: { dias: DiaGeral[]; marcos: MarcoGeral[]; hojeIso: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [concluindo, setConcluindo] = useState<Set<string>>(new Set());
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [verTudo, setVerTudo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todas' | 'lud' | 'cliente'>('todas');

  async function concluir(tarefaId: string) {
    if (concluindo.has(tarefaId)) return;
    setErro(null);
    setConcluindo((s) => new Set(s).add(tarefaId));
    try {
      const r = await fetch(`/api/tarefas/${tarefaId}/concluir`, { method: 'POST' });
      if (!r.ok) throw new Error();
      setFeitas((s) => new Set(s).add(tarefaId));
      avisarConcluida(tarefaId);
      startTransition(() => router.refresh());
    } catch {
      setErro('Não consegui concluir essa tarefa no Notion. Tente de novo.');
    } finally {
      setConcluindo((s) => {
        const n = new Set(s);
        n.delete(tarefaId);
        return n;
      });
    }
  }

  const limiteData = new Date(utc(hojeIso) + 30 * 86_400_000).toISOString().slice(0, 10);
  const passaFiltro = (comCliente: boolean) =>
    filtro === 'todas' || (filtro === 'cliente' ? comCliente : !comCliente);
  const marcosVisiveis = marcos.filter((m) => passaFiltro(m.comCliente));
  const totalSemana = dias.reduce((s, d) => s + d.tarefas.filter((t) => passaFiltro(t.comCliente)).length, 0);
  const atrasadasHoje = dias.find((d) => d.hoje)?.tarefas.filter((t) => t.atrasada).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">Todos os clientes</h2>
          <p className="text-[13px] text-t2">
            Tarefas abertas no Notion, de todos os projetos.{' '}
            {atrasadasHoje > 0 && (
              <span className="font-semibold text-[var(--prazo-atrasado)]">
                {atrasadasHoje} {atrasadasHoje === 1 ? 'venceu e está' : 'venceram e estão'} em hoje.
              </span>
            )}
          </p>
        </div>
        <div className="flex rounded-[10px] bg-[#F2F2F4] p-[3px]">
          {(
            [
              ['todas', 'Todas'],
              ['lud', 'Com a Lud.'],
              ['cliente', 'Com o cliente'],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltro(k)}
              className={`rounded-lg px-3.5 py-2 text-[13px] transition ${
                filtro === k ? 'bg-white font-semibold text-ink shadow-sm' : 'text-t2 hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Esta semana ─── */}
      <section className="space-y-4 rounded-[22px] bg-white p-5 sm:p-6">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-t2">Esta semana</div>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">
            O que fazer em cada dia <span className="text-[14px] font-normal text-t2">· {totalSemana} tarefas</span>
          </h2>
          <p className="text-[12px] text-t2">
            O que já venceu aparece em hoje. Tarefas iguais do mesmo cliente ficam juntas: clique pra abrir a entrega dele.
          </p>
        </div>
        {erro && (
          <p className="rounded-md bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] text-[var(--prazo-atrasado)]">{erro}</p>
        )}
        <div className="grid gap-2 overflow-x-auto min-h-fit [grid-template-columns:repeat(7,minmax(150px,1fr))]">
          {dias.map((d) => {
            const abertas = d.tarefas.filter((t) => !feitas.has(t.tarefaId) && passaFiltro(t.comCliente));
            const limite = verTudo === d.iso ? abertas.length : 5;
            return (
              <div
                key={d.iso}
                className={`flex min-h-[200px] flex-col gap-2 rounded-2xl border-2 p-2.5 ${
                  d.hoje ? 'border-[#313D65] bg-white' : d.passado ? 'border-transparent bg-[#F7F7F8]' : 'border-[#EFEFF2] bg-[#FAFAFB]'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-bold text-t2">{d.rotulo}</span>
                  <span className={`text-[18px] font-extrabold ${d.passado ? 'text-t3' : 'text-ink'}`}>{d.num}</span>
                </div>
                {d.hoje && <span className="text-[10px] font-extrabold tracking-[0.06em] text-[#313D65]">HOJE</span>}
                {abertas.slice(0, limite).map((t) => {
                  const href = destinoDoCard(t);
                  const varios = t.ids.length > 1;
                  const corpo = (
                    <>
                      <span className="block truncate text-[10.5px] font-bold text-[#313D65]">{t.rotulo}</span>
                      <span className="block text-[12px] font-semibold leading-tight text-ink">{t.titulo}</span>
                      {varios ? (
                        <span className="mt-0.5 block truncate text-[11px] text-t2" title={t.posts.join(' · ')}>
                          {t.ids.length} posts
                        </span>
                      ) : (
                        t.postTitulo && <span className="mt-0.5 block truncate text-[11px] italic text-t2">“{t.postTitulo}”</span>
                      )}
                      {t.atrasada && t.prazo && (
                        <span className="mt-0.5 block text-[10.5px] font-semibold text-[var(--prazo-atrasado)]">
                          venceu {t.prazo.slice(8, 10)}/{t.prazo.slice(5, 7)}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <div
                      key={t.chave}
                      className={`flex items-start gap-1.5 rounded-[10px] p-2 ${t.atrasada ? 'bg-[var(--prazo-atrasado-soft)]' : 'bg-[#F2F2F4]'}`}
                    >
                      {!varios && (
                        <button
                          type="button"
                          aria-label={`Concluir ${t.titulo}`}
                          title="Concluir no Notion"
                          onClick={() => concluir(t.tarefaId)}
                          disabled={concluindo.has(t.tarefaId)}
                          className="mt-[15px] h-[14px] w-[14px] shrink-0 rounded-[4px] border-[1.5px] border-ink bg-white transition hover:bg-[var(--prazo-em-dia-soft)] disabled:opacity-40"
                        />
                      )}
                      <Link href={href} className="min-w-0 flex-1 text-left">
                        {corpo}
                      </Link>
                    </div>
                  );
                })}
                {abertas.length > limite && (
                  <button
                    type="button"
                    onClick={() => setVerTudo(d.iso)}
                    className="text-left text-[11.5px] font-semibold text-t2 hover:text-ink"
                  >
                    + {abertas.length - limite} {abertas.length - limite === 1 ? 'tarefa' : 'tarefas'}
                  </button>
                )}
                {verTudo === d.iso && abertas.length > 5 && (
                  <button type="button" onClick={() => setVerTudo(null)} className="text-left text-[11.5px] font-semibold text-t2 hover:text-ink">
                    Mostrar menos
                  </button>
                )}
                {abertas.length === 0 && <span className="text-[12px] text-t3">Nada</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Próximos 30 dias ─── */}
      <section className="space-y-4 rounded-[22px] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-t2">Próximos 30 dias</div>
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">
              Marcos até {limiteData.slice(8, 10)}/{limiteData.slice(5, 7)}
            </h2>
            <p className="text-[12px] text-t2">Sem a rotina dos posts (arte, aprovação, envio, programação), que já está na semana.</p>
          </div>
          <div className="flex gap-4 text-[12px] text-t2">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#313D65]" />
              Com a Lud.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-[#313D65] bg-white" />
              Com o cliente
            </span>
          </div>
        </div>
        {marcosVisiveis.length === 0 ? (
          <p className="text-[13px] text-t2">Nenhum marco nos próximos 30 dias.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-0 right-0 top-[9px] h-0.5 bg-[#E6E6EA]" />
            <div className="relative grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
              {marcosVisiveis.slice(0, verTudo === 'marcos' ? marcosVisiveis.length : 8).map((m, idx) => (
                <div key={m.chave} className="flex flex-col gap-3">
                  <span
                    className={`h-5 w-5 rounded-full border-[3px] border-[#313D65] shadow-[0_0_0_4px_#fff] ${
                      m.comCliente ? 'bg-white' : 'bg-[#313D65]'
                    }`}
                  />
                  <div
                    className={`flex min-h-[130px] w-full flex-col gap-1.5 rounded-2xl border bg-white p-3.5 ${
                      idx === 0 ? 'border-[#313D65]' : 'border-[rgba(21,21,33,0.08)]'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[20px] font-extrabold tracking-[-0.02em] text-ink">
                        {m.data.slice(8, 10)}/{m.data.slice(5, 7)}
                      </span>
                      <span className={`text-[12px] font-bold ${m.dias <= 2 ? 'text-[var(--prazo-hoje)]' : 'text-t2'}`}>
                        {textoDias(m.dias)}
                      </span>
                    </span>
                    <span className="text-[14px] font-semibold leading-snug text-ink">{m.titulo}</span>
                    <span className="flex flex-wrap gap-1">
                      {m.clientes.slice(0, verTudo === m.chave ? m.clientes.length : 3).map((c) => {
                        const cls =
                          'max-w-full truncate rounded-full bg-[#F2F2F4] px-2 py-0.5 text-[11px] font-semibold text-[#313D65] transition hover:bg-[#BAC4E6]';
                        return (
                          <Link key={c.projetoId} href={destinoDoCliente(c)} className={cls} title={c.detalhe}>
                            {c.rotulo}
                          </Link>
                        );
                      })}
                      {m.clientes.length > 3 && verTudo !== m.chave && (
                        <button
                          type="button"
                          onClick={() => setVerTudo(m.chave)}
                          className="px-1 text-[11px] font-semibold text-t2 hover:text-ink"
                        >
                          +{m.clientes.length - 3}
                        </button>
                      )}
                    </span>
                    <span
                      className={`mt-auto self-start rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        m.comCliente ? 'bg-[#F1EBE5] text-[#642223]' : 'bg-[#E8EBF5] text-[#313D65]'
                      }`}
                    >
                      {m.comCliente ? 'Com o cliente' : 'Com a Lud.'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {marcosVisiveis.length > 8 && (
              <button
                type="button"
                onClick={() => setVerTudo(verTudo === 'marcos' ? null : 'marcos')}
                className="mt-3 text-[13px] font-semibold text-t2 hover:text-ink"
              >
                {verTudo === 'marcos' ? 'Mostrar menos' : `Ver os ${marcosVisiveis.length} marcos →`}
              </button>
            )}
          </div>
        )}
      </section>

    </div>
  );
}
