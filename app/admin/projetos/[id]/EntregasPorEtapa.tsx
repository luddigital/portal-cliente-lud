'use client';

import { useEffect, useState } from 'react';
import { ddmm, textoProxima, type ResumoEtapa } from '@/lib/etapas-projeto';
import { ModalMensagem, type GrupoWpp, type ItemPendenciaUi } from './PendenciasCliente';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';
import { ChipData } from '@/app/_components/ChipData';

function diasAte(hoje: string, iso: string): number {
  const d = (s: string) => {
    const [y, m, dd] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((d(iso) - d(hoje)) / 86_400_000);
}

/**
 * Aba Entregas: uma seção por etapa (Pauta, Materiais, Arte…) com a data
 * limite, o status e, nas etapas do cliente, o botão de mensagem da entrega.
 * Embaixo de cada etapa, os posts que estão nela agora.
 */
export function EntregasPorEtapa({
  projetoId,
  clienteNome,
  etapas,
  itensCliente,
  gruposWpp,
  textos,
  hojeIso,
}: {
  projetoId: string;
  clienteNome: string;
  etapas: ResumoEtapa[];
  /** Tarefas já liberadas pro cliente (as que podem entrar na mensagem). */
  itensCliente: ItemPendenciaUi[];
  gruposWpp: GrupoWpp[];
  textos: Record<string, string>;
  hojeIso: string;
}) {
  const [modal, setModal] = useState<{ titulo: string; itens: ItemPendenciaUi[] } | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string } | null>(null);

  useEffect(() => {
    if (!enviadoPara) return;
    const t = setTimeout(() => setEnviadoPara(null), 8000);
    return () => clearTimeout(t);
  }, [enviadoPara]);

  const comPosts = etapas.filter((e) => e.posts.length > 0);
  const vistoPorTarefa = new Map(itensCliente.map((i) => [i.tarefaId, i]));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Entregas</h2>
          <p className="mt-0.5 text-[12px] text-t3">
            Cada post aparece na etapa em que está agora, com o prazo da tarefa atual.
          </p>
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

      {enviadoPara && (
        <div role="status" className="rounded-xl bg-bgSoft px-4 py-2.5 text-[12px] text-ink">
          Mensagem enviada no grupo <span className="font-semibold">{enviadoPara}</span>.
        </div>
      )}

      {comPosts.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.12)] px-4 py-6 text-center text-[12.5px] text-t3">
          Nenhuma entrega em andamento.
        </p>
      )}

      {comPosts.map((e) => {
        const doCliente = e.posts.filter((p) => p.doCliente);
        const liberados = doCliente
          .map((p) => vistoPorTarefa.get(p.tarefa.id))
          .filter((i): i is ItemPendenciaUi => !!i);
        return (
          <div
            key={e.etapa}
            id={`etapa-${e.etapa}`}
            className={`scroll-mt-6 overflow-hidden rounded-2xl border bg-white ${
              e.atrasadas > 0 ? 'border-[rgba(110,42,44,0.25)]' : 'border-[rgba(21,21,33,0.08)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(21,21,33,0.06)] px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{e.nome}</h3>
                  <span className="text-[12px] text-t3">
                    {e.posts.length} {e.posts.length === 1 ? 'post' : 'posts'}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px]">
                  {e.atrasadas > 0 && (
                    <span className="font-semibold text-[var(--prazo-atrasado)]">
                      {e.atrasadas} {e.atrasadas === 1 ? 'atrasado' : 'atrasados'} · venceu{' '}
                      {ddmm(e.ultimoAtraso!)}
                    </span>
                  )}
                  {e.proxima && (
                    <span className="text-t2">
                      Data limite: {ddmm(e.proxima)} ({textoProxima(e.diasProxima)})
                    </span>
                  )}
                </div>
              </div>
              {doCliente.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModal({ titulo: e.nome, itens: liberados })}
                  disabled={liberados.length === 0}
                  title={
                    liberados.length === 0
                      ? 'Essas tarefas ainda não estão liberadas no portal do cliente'
                      : 'Uma mensagem só, com todos os posts dessa entrega'
                  }
                  className="rounded-full border border-[rgba(21,21,33,0.12)] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-bgSoft disabled:opacity-40"
                >
                  📱 Mensagem da entrega{liberados.length > 1 ? ` (${liberados.length})` : ''}
                </button>
              )}
            </div>
            <ul className="divide-y divide-[rgba(21,21,33,0.05)]">
              {e.posts.map((p) => {
                const v = vistoPorTarefa.get(p.tarefa.id)?.visto;
                return (
                  <li key={p.postId}>
                    <button
                      type="button"
                      onClick={() => setPrevia({ postId: p.postId, tarefaId: p.tarefa.id })}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-bgSoft/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-ink">{p.postTitulo}</div>
                        <div className="mt-0.5 truncate text-[11px] text-t3">
                          {p.tarefa.titulo}
                          {p.doCliente ? ' · com o cliente' : p.tarefa.pessoa ? ` · ${p.tarefa.pessoa}` : ''}
                          {p.postData ? ` · post em ${ddmm(p.postData)}` : ''}
                        </div>
                      </div>
                      {p.doCliente && (
                        <span className={`shrink-0 text-[11px] ${v ? 'font-semibold text-ink' : 'text-t3'}`}>
                          {v ? '👁 visto' : 'não visto'}
                        </span>
                      )}
                      <ChipData prazo={p.tarefa.prazo} hoje={hojeIso} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {previa && (
        <PreviaPostModal
          postId={previa.postId}
          tarefaId={previa.tarefaId}
          fechar={() => setPrevia(null)}
        />
      )}

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
    </section>
  );
}
