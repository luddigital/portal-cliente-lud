'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rotas } from '@/lib/rotas';
import type { CardEntrega, DiaSemana, Marco } from '@/lib/visao-projeto';
import { EntregasPorQuem } from '../../_components/EntregasPorQuem';
import { ModalMensagem, type GrupoWpp, type ItemPendenciaUi } from './PendenciasCliente';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';
import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';

const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function utc(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function dias(de: string, ate: string) {
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}
function textoDias(n: number) {
  if (n < 0) return n === -1 ? 'venceu ontem' : `venceu há ${-n} dias`;
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  return `em ${n} dias`;
}

/**
 * Parte interativa da página do projeto: próximo passo, próximos 30 dias,
 * esta semana (com check que conclui a tarefa no Notion) e entregas
 * pendentes (opção E). Clicar num post abre o popup de prévia.
 */
export function VisaoProjeto({
  projetoId,
  clienteNome,
  rotuloCliente,
  cards,
  marcos,
  semana,
  itensCliente,
  gruposWpp,
  textos,
  hojeIso,
}: {
  projetoId: string;
  clienteNome: string;
  rotuloCliente: string;
  cards: CardEntrega[];
  marcos: Marco[];
  semana: DiaSemana[];
  itensCliente: ItemPendenciaUi[];
  gruposWpp: GrupoWpp[];
  textos: Record<string, string>;
  hojeIso: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [previa, setPrevia] = useState<{ postId: string; tarefaId?: string } | null>(null);
  const [modal, setModal] = useState<{ titulo: string; itens: ItemPendenciaUi[] } | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState<Set<string>>(new Set());
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [erroTarefa, setErroTarefa] = useState<string | null>(null);
  const [verTudo, setVerTudo] = useState<string | null>(null);

  useEffect(() => {
    if (!enviadoPara) return;
    const t = setTimeout(() => setEnviadoPara(null), 8000);
    return () => clearTimeout(t);
  }, [enviadoPara]);

  const liberadoPorTarefa = new Map(itensCliente.map((i) => [i.tarefaId, i]));

  /**
   * Pra onde vai cada clique (lib/rotas.ts): várias tarefas iguais juntas =
   * a entrega desse projeto; uma tarefa só = a página da tarefa. Sem entrega
   * no Notion, as tarefas do projeto.
   */
  const destino = (itens: { tarefaId: string; entregaId?: string | null }[]) => {
    const entregaId = itens.find((i) => i.entregaId)?.entregaId;
    if (itens.length === 1) return rotas.tarefa(itens[0].tarefaId);
    return entregaId ? rotas.entregaDoProjeto(projetoId, entregaId) : `${rotas.tarefas()}?projeto=${projetoId}`;
  };
  // Card de entrega = a entrega desse projeto (mesmo com um post só: o card fala da entrega).
  const destinoDoCard = (c: CardEntrega) => {
    const entregaId = c.itens.find((i) => i.entregaId)?.entregaId;
    return entregaId ? rotas.entregaDoProjeto(projetoId, entregaId) : destino(c.itens);
  };
  const cardsComLink = useMemo(
    () => cards.map((c) => ({ ...c, href: destinoDoCard(c) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, projetoId],
  );

  function abrirCard(c: CardEntrega) {
    router.push(destinoDoCard(c));
  }
  function acaoCard(c: CardEntrega) {
    if (c.comCliente) {
      const itens = c.itens.map((i) => liberadoPorTarefa.get(i.tarefaId)).filter((x): x is ItemPendenciaUi => !!x);
      setModal({ titulo: c.titulo, itens: itens.length ? itens : itensCliente });
      return;
    }
    abrirCard(c);
  }

  async function concluir(tarefaId: string) {
    if (concluindo.has(tarefaId)) return;
    setErroTarefa(null);
    setConcluindo((s) => new Set(s).add(tarefaId));
    try {
      const r = await fetch(`/api/tarefas/${tarefaId}/concluir`, { method: 'POST' });
      if (!r.ok) throw new Error();
      setFeitas((s) => new Set(s).add(tarefaId));
      avisarConcluida(tarefaId);
      startTransition(() => router.refresh());
    } catch {
      setErroTarefa('Não consegui concluir essa tarefa no Notion. Tente de novo.');
    } finally {
      setConcluindo((s) => {
        const n = new Set(s);
        n.delete(tarefaId);
        return n;
      });
    }
  }

  const proximo = cards[0] ?? null;
  const proxPrazo = proximo?.itens[0]?.prazo ?? null;

  return (
    <div className="space-y-5">
      {enviadoPara && (
        <div role="status" className="rounded-xl bg-[var(--prazo-em-dia-soft)] px-4 py-2.5 text-[13px] text-ink">
          Mensagem enviada no grupo <span className="font-semibold">{enviadoPara}</span>.
        </div>
      )}

      {/* ─── Próximo passo ─── */}
      {proximo && (
        <section className="flex flex-wrap items-center justify-between gap-5 rounded-[22px] bg-[#313D65] p-6 text-white">
          <div className="flex items-center gap-5">
            <span className="flex h-[84px] w-[84px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-white leading-none text-[#313D65]">
              {proxPrazo ? (
                <>
                  <span className="text-[30px] font-extrabold">{proxPrazo.slice(8, 10)}</span>
                  <span className="mt-1 text-[11px] font-bold">
                    {MES_CURTO[Number(proxPrazo.slice(5, 7)) - 1]} · {SEMANA_LONGA[new Date(utc(proxPrazo)).getUTCDay()].slice(0, 3).toUpperCase()}
                  </span>
                </>
              ) : (
                <span className="text-[12px] font-bold">SEM DATA</span>
              )}
            </span>
            <div className="min-w-0 space-y-1.5">
              <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#BAC4E6]">
                Próximo passo{proxPrazo ? ` · ${textoDias(dias(hojeIso, proxPrazo))}` : ''} ·{' '}
                {proximo.comCliente ? rotuloCliente.toLowerCase() : 'com a Lud.'}
              </div>
              <div className="text-[24px] font-semibold leading-tight tracking-[-0.01em]">{proximo.titulo}</div>
              <div className="flex flex-wrap gap-2">
                {proximo.itens.slice(0, 3).map((i) => (
                  <button
                    key={i.tarefaId}
                    type="button"
                    onClick={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.tarefaId })}
                    className="max-w-[260px] truncate rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-semibold italic transition hover:bg-white/25"
                  >
                    “{i.postTitulo}”
                  </button>
                ))}
                {proximo.itens.length > 3 && (
                  <span className="px-1 py-1 text-[12.5px] text-[#BAC4E6]">e mais {proximo.itens.length - 3}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => abrirCard(proximo)}
              className="rounded-xl bg-white px-4 py-3 text-[14px] font-bold text-[#313D65] transition hover:opacity-90"
            >
              Abrir entrega
            </button>
            {proximo.comCliente && (
              <button type="button" onClick={() => acaoCard(proximo)} className="btn-enviar !rounded-xl !px-4 !py-3 !text-[14px]">
                Lembrar no grupo
              </button>
            )}
          </div>
        </section>
      )}

      {/* ─── Próximos 30 dias ─── */}
      <section className="space-y-4 rounded-[22px] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-t2">Próximos 30 dias</div>
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">
              Marcos até {(() => {
                const d = new Date(utc(hojeIso) + 30 * 86_400_000).toISOString().slice(0, 10);
                return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
              })()}
            </h2>
          </div>
          <div className="flex gap-4 text-[12px] text-t2">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#313D65]" />
              Com a Lud.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-[#313D65] bg-white" />
              {rotuloCliente}
            </span>
          </div>
        </div>
        {marcos.length === 0 ? (
          <p className="text-[13px] text-t2">Nenhuma tarefa com prazo nos próximos 30 dias.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-0 right-0 top-[9px] h-0.5 bg-[#E6E6EA]" />
            <div className="relative grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
              {marcos.slice(0, verTudo === 'marcos' ? marcos.length : 6).map((m, idx) => (
                <button
                  key={m.chave}
                  type="button"
                  // Marco com várias tarefas = a entrega; com uma só = a tarefa.
                  onClick={() => router.push(destino(m.itens))}
                  className="flex flex-col gap-3 text-left"
                >
                  <span
                    className={`h-5 w-5 rounded-full border-[3px] border-[#313D65] shadow-[0_0_0_4px_#fff] ${
                      m.comCliente ? 'bg-white' : 'bg-[#313D65]'
                    }`}
                  />
                  <span
                    className={`flex min-h-[120px] w-full flex-col gap-1.5 rounded-2xl border bg-white p-3.5 transition hover:shadow-sm ${
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
                    <span className="line-clamp-2 text-[12px] italic text-t2">{m.detalhe}</span>
                    <span
                      className={`mt-auto self-start rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        m.comCliente ? 'bg-[#F1EBE5] text-[#642223]' : 'bg-[#E8EBF5] text-[#313D65]'
                      }`}
                    >
                      {m.comCliente ? rotuloCliente : 'Com a Lud.'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {marcos.length > 6 && (
              <button
                type="button"
                onClick={() => setVerTudo(verTudo === 'marcos' ? null : 'marcos')}
                className="mt-3 text-[13px] font-semibold text-t2 hover:text-ink"
              >
                {verTudo === 'marcos' ? 'Mostrar menos' : `Ver os ${marcos.length} marcos →`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ─── Esta semana ─── */}
      <section className="space-y-4 rounded-[22px] bg-white p-5 sm:p-6">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-t2">Esta semana</div>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">O que fazer em cada dia</h2>
          <p className="text-[12px] text-t2">
            Tarefas do projeto no Notion, pelo prazo. O que já venceu aparece em hoje. Tarefas iguais ficam juntas: clique
            pra abrir a entrega do cliente.
          </p>
        </div>
        {erroTarefa && (
          <p className="rounded-md bg-[var(--prazo-atrasado-soft)] px-3 py-2 text-[12px] text-[var(--prazo-atrasado)]">{erroTarefa}</p>
        )}
        <div className="grid gap-2 overflow-x-auto min-h-fit [grid-template-columns:repeat(7,minmax(130px,1fr))]">
          {semana.map((d) => {
            const abertas = d.tarefas.filter((t) => !feitas.has(t.tarefaId));
            const limite = verTudo === d.iso ? abertas.length : 4;
            return (
              <div
                key={d.iso}
                className={`flex min-h-[180px] flex-col gap-2 rounded-2xl border-2 p-2.5 ${
                  d.hoje ? 'border-[#313D65] bg-white' : d.passado ? 'border-transparent bg-[#F7F7F8]' : 'border-[#EFEFF2] bg-[#FAFAFB]'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-bold text-t2">{d.rotulo}</span>
                  <span className={`text-[18px] font-extrabold ${d.passado ? 'text-t3' : 'text-ink'}`}>{d.num}</span>
                </div>
                {d.hoje && <span className="text-[10px] font-extrabold tracking-[0.06em] text-[#313D65]">HOJE</span>}
                {abertas.slice(0, limite).map((t) => {
                  const varios = t.ids.length > 1;
                  const href = varios
                    ? destino(t.ids.map((id) => ({ tarefaId: id, entregaId: t.entregaId })))
                    : rotas.tarefa(t.tarefaId);
                  const corpo = (
                    <>
                      <span className="block text-[12px] font-semibold leading-tight text-ink">{t.titulo}</span>
                      {varios ? (
                        <span className="mt-0.5 block truncate text-[11px] text-t2" title={t.posts.join(' · ')}>
                          {t.ids.length} posts
                        </span>
                      ) : (
                        t.postTitulo && (
                          <span className="mt-0.5 block truncate text-[11px] italic text-t2">“{t.postTitulo}”</span>
                        )
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
                      key={t.tarefaId}
                      className={`flex items-start gap-1.5 rounded-[10px] p-2 ${t.atrasada ? 'bg-[var(--prazo-atrasado-soft)]' : 'bg-[#F2F2F4]'}`}
                    >
                      {!varios && (
                        <button
                          type="button"
                          aria-label={`Concluir ${t.titulo}`}
                          title="Concluir no Notion"
                          onClick={() => concluir(t.tarefaId)}
                          disabled={concluindo.has(t.tarefaId)}
                          className="mt-px h-[14px] w-[14px] shrink-0 rounded-[4px] border-[1.5px] border-ink bg-white transition hover:bg-[var(--prazo-em-dia-soft)] disabled:opacity-40"
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
                {abertas.length === 0 && <span className="text-[12px] text-t3">Nada</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Entregas pendentes (opção E) ─── */}
      <section id="entregas" className="space-y-3 pt-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">Entregas pendentes</h2>
            <p className="text-[13px] text-t2">Direto do Notion. Cada card é a tarefa em que os posts estão agora.</p>
          </div>
          <button
            type="button"
            onClick={() => setModal({ titulo: 'Mensagem geral', itens: itensCliente })}
            disabled={itensCliente.length === 0}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-30"
          >
            Mensagem geral ao cliente
          </button>
        </div>
        <EntregasPorQuem cards={cardsComLink} rotuloCliente={rotuloCliente} onAbrir={abrirCard} onAcao={acaoCard} />
      </section>

      {previa && <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />}
      {modal && (
        <ModalMensagem
          projetoId={projetoId}
          clienteNome={clienteNome}
          gruposWpp={gruposWpp}
          titulo={modal.titulo}
          itens={modal.itens}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setModal(null)}
          aoEnviar={(nomeGrupo) => {
            setModal(null);
            setEnviadoPara(nomeGrupo ?? gruposWpp[0]?.nome ?? 'do cliente');
          }}
        />
      )}
    </div>
  );
}
