'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  GRUPOS_PENDENCIA,
  montarMensagemPendencias,
  type ItemPendencia,
} from '@/lib/pendencias-cliente';

export type ItemPendenciaUi = ItemPendencia & {
  /** null = o cliente ainda não abriu o post no portal. */
  visto: { ultima: string; total: number } | null;
};

// Chips P&B (DESIGN_SYSTEM.md › Superfícies "fantasma").
const CHIP = 'shrink-0 rounded px-1.5 py-[1px] text-[10px] font-medium';
const CHIP_SOLIDO = 'bg-[#37352F] text-white';
const CHIP_MEDIO = 'bg-[#E9E9E7] text-[#37352F]';
const CHIP_CLARO = 'bg-[#F4F4F2] text-[#37352F]';
const CHIP_OUTLINE = 'border border-[rgba(0,0,0,0.14)] bg-white text-[#787774]';

const BTN_PRIMARIO =
  'rounded-md bg-[#37352F] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2E2C28] disabled:cursor-not-allowed disabled:opacity-40';
const BTN_SECUNDARIO =
  'rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#787774] transition-colors hover:border-[rgba(0,0,0,0.14)] hover:bg-[rgba(55,53,47,0.05)] hover:text-[#37352F] disabled:cursor-not-allowed disabled:opacity-40';

function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function diffDias(deIso: string, ateIso: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(ateIso) - t(deIso)) / 86_400_000);
}

function prazoChip(prazo: string | null, hojeIso: string): { texto: string; cls: string } {
  if (!prazo) return { texto: 'sem prazo', cls: CHIP_OUTLINE };
  const d = diffDias(hojeIso, prazo);
  if (d < 0) {
    const n = Math.abs(d);
    return { texto: n === 1 ? 'atrasado 1 dia' : `atrasado ${n} dias`, cls: CHIP_SOLIDO };
  }
  if (d === 0) return { texto: 'hoje', cls: CHIP_MEDIO };
  if (d === 1) return { texto: 'amanhã', cls: CHIP_MEDIO };
  if (d <= 7) return { texto: `em ${d} dias`, cls: CHIP_CLARO };
  return { texto: ddmm(prazo), cls: CHIP_OUTLINE };
}

function textoVisto(v: { ultima: string }, hojeIso: string): string {
  const dia = new Date(v.ultima).toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
  const d = diffDias(dia, hojeIso);
  if (d <= 0) return 'visto hoje';
  if (d === 1) return 'visto ontem';
  return `visto ${ddmm(dia)}`;
}

function porPrazo(a: ItemPendenciaUi, b: ItemPendenciaUi): number {
  return (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999');
}

export type GrupoWpp = { id: string; nome: string; apelido: string | null };

export function PendenciasCliente({
  projetoId,
  clienteNome,
  gruposWpp,
  itens,
  textos,
  hojeIso,
}: {
  projetoId: string;
  clienteNome: string;
  /** Grupos ativos do projeto, principal primeiro. Vazio = sem grupo vinculado. */
  gruposWpp: GrupoWpp[];
  itens: ItemPendenciaUi[];
  textos: Record<string, string>;
  hojeIso: string;
}) {
  /** 'todos' = mensagem geral; senão, id da entrega (grupo). */
  const [aberto, setAberto] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  useEffect(() => {
    if (!enviadoPara) return;
    const t = setTimeout(() => setEnviadoPara(null), 8000);
    return () => clearTimeout(t);
  }, [enviadoPara]);

  const grupos = useMemo(
    () =>
      GRUPOS_PENDENCIA.map((g) => ({
        ...g,
        itens: itens.filter((i) => i.grupo === g.id).sort(porPrazo),
      })).filter((g) => g.itens.length > 0),
    [itens],
  );

  const total = itens.length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#37352F]">
            Pendências com o cliente
          </h2>
          <p className="mt-0.5 text-[12px] text-[#787774]">
            {total === 0
              ? 'Nada esperando o cliente agora.'
              : `${total} ${total === 1 ? 'item esperando' : 'itens esperando'} ${clienteNome}, separados por entrega.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto('todos')}
          disabled={total === 0}
          className={BTN_PRIMARIO}
        >
          Enviar mensagem ao cliente
        </button>
      </div>

      {enviadoPara && (
        <div
          role="status"
          className="rounded-md border border-[rgba(0,0,0,0.09)] bg-[#F4F4F2] px-3 py-2 text-[12px] text-[#37352F]"
        >
          Mensagem enviada no grupo <span className="font-semibold">{enviadoPara}</span>.
        </div>
      )}

      {grupos.map((g) => (
        <div
          key={g.id}
          className="overflow-hidden rounded-md border border-[rgba(0,0,0,0.09)] bg-white"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[rgba(0,0,0,0.09)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[#37352F]">
                {g.label}
              </h3>
              <span className={`${CHIP} ${CHIP_OUTLINE}`}>{g.itens.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setAberto(g.id)}
              className={BTN_SECUNDARIO}
              title={`Uma mensagem só, com ${g.itens.length === 1 ? 'esse item' : `os ${g.itens.length} itens`} de "${g.label}"`}
            >
              {g.itens.length === 1 ? 'Avisar no WhatsApp' : `Avisar os ${g.itens.length} juntos`}
            </button>
          </div>
          <ul className="divide-y divide-[rgba(0,0,0,0.09)]">
            {g.itens.map((i) => {
              const chip = prazoChip(i.prazo, hojeIso);
              return (
                <li
                  key={i.tarefaId}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[rgba(55,53,47,0.05)]"
                >
                  <Link
                    href={`/post/${i.postId}?tarefa=${i.tarefaId}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="truncate text-[13px] text-[#37352F]">{i.postTitulo}</div>
                    <div className="mt-0.5 truncate text-[11px] text-[#787774]">
                      {i.tarefaTitulo}
                      {i.postData ? ` · post em ${ddmm(i.postData)}` : ''}
                    </div>
                  </Link>
                  <span
                    className={`shrink-0 text-[11px] ${i.visto ? 'font-medium text-[#37352F]' : 'text-[rgba(55,53,47,0.45)]'}`}
                    title={
                      i.visto
                        ? `Cliente abriu ${i.visto.total}x no portal`
                        : 'Cliente ainda não abriu no portal (contagem desde 06/10)'
                    }
                  >
                    {i.visto ? textoVisto(i.visto, hojeIso) : 'não visto'}
                  </span>
                  <span className={`${CHIP} ${chip.cls}`} title={i.prazo ?? undefined}>
                    {chip.texto}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {aberto && (
        <ModalMensagem
          projetoId={projetoId}
          clienteNome={clienteNome}
          gruposWpp={gruposWpp}
          titulo={
            aberto === 'todos'
              ? 'Mensagem geral'
              : GRUPOS_PENDENCIA.find((g) => g.id === aberto)?.label ?? 'Mensagem'
          }
          itens={aberto === 'todos' ? itens : itens.filter((i) => i.grupo === aberto)}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setAberto(null)}
          aoEnviar={(nomeGrupo) => {
            setAberto(null);
            setEnviadoPara(nomeGrupo ?? gruposWpp[0]?.nome ?? 'do cliente');
          }}
        />
      )}
    </section>
  );
}

export function ModalMensagem({
  projetoId,
  clienteNome,
  gruposWpp,
  titulo,
  itens,
  textos,
  hojeIso,
  fechar,
  aoEnviar,
}: {
  projetoId: string;
  clienteNome: string;
  gruposWpp: GrupoWpp[];
  titulo: string;
  itens: ItemPendenciaUi[];
  textos: Record<string, string>;
  hojeIso: string;
  fechar: () => void;
  aoEnviar: (grupoNome: string | null) => void;
}) {
  const [grupoId, setGrupoId] = useState<string | null>(gruposWpp[0]?.id ?? null);
  const grupoAtual = gruposWpp.find((g) => g.id === grupoId) ?? null;
  const grupoNome = grupoAtual?.nome ?? null;
  const apelido = grupoAtual?.apelido || clienteNome;
  const [sel, setSel] = useState<Set<string>>(() => new Set(itens.map((i) => i.tarefaId)));
  const selecionados = useMemo(() => itens.filter((i) => sel.has(i.tarefaId)), [itens, sel]);
  const gerado = useMemo(
    () => montarMensagemPendencias({ apelido, itens: selecionados, textos, hoje: hojeIso }),
    [apelido, selecionados, textos, hojeIso],
  );
  const [texto, setTexto] = useState(gerado);
  const [manual, setManual] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Enquanto o texto não foi editado à mão, acompanha a seleção.
  useEffect(() => {
    if (!manual) setTexto(gerado);
  }, [gerado, manual]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) fechar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fechar, enviando]);

  const grupos = useMemo(
    () =>
      GRUPOS_PENDENCIA.map((g) => ({
        ...g,
        itens: itens.filter((i) => i.grupo === g.id).sort(porPrazo),
      })).filter((g) => g.itens.length > 0),
    [itens],
  );

  function alternar(id: string) {
    setSel((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const todos = sel.size === itens.length;
  const textoDesatualizado = manual && texto !== gerado;

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/projetos/${projetoId}/mensagem-cliente`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mensagem: texto,
          grupoId,
          postIds: [...new Set(selecionados.map((i) => i.postId))],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      aoEnviar(j.grupoNome ?? grupoNome);
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao enviar a mensagem.');
      setEnviando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro('Não consegui copiar. Selecione o texto e copie à mão.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={() => !enviando && fechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-mensagem-cliente"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[rgba(0,0,0,0.09)] bg-white text-left shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(0,0,0,0.09)] px-5 py-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#787774]">
              {titulo}
            </div>
            <h3
              id="titulo-mensagem-cliente"
              className="mt-0.5 truncate text-[14px] font-semibold tracking-[-0.01em] text-[#37352F]"
            >
              {clienteNome}
            </h3>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-[#787774] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:text-[#37352F]"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {gruposWpp.length > 1 ? (
            <label className="flex flex-wrap items-center gap-2 rounded-md bg-[#F4F4F2] px-3 py-2 text-[12px] text-[#787774]">
              Vai pro grupo
              <select
                value={grupoId ?? ''}
                onChange={(e) => {
                  setGrupoId(e.target.value);
                  setManual(false);
                }}
                disabled={enviando}
                className="rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-2 py-1 text-[12px] font-semibold text-[#37352F]"
              >
                {gruposWpp.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                    {g.apelido ? ` (${g.apelido})` : ''}
                  </option>
                ))}
              </select>
              Nunca no privado.
            </label>
          ) : grupoNome ? (
            <div className="rounded-md bg-[#F4F4F2] px-3 py-2 text-[12px] text-[#787774]">
              Vai pro grupo <span className="font-semibold text-[#37352F]">{grupoNome}</span>.
              Nunca no privado.
            </div>
          ) : (
            <div className="rounded-md border border-[#37352F] px-3 py-2 text-[12px] text-[#37352F]">
              Esse projeto não tem grupo do WhatsApp vinculado, então o envio fica desligado.{' '}
              <Link href="/admin/whatsapp" className="font-medium underline">
                Vincular grupo
              </Link>
              . Você ainda pode copiar o texto.
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#787774]">
                O que entra na mensagem
              </div>
              <button
                type="button"
                onClick={() =>
                  setSel(todos ? new Set() : new Set(itens.map((i) => i.tarefaId)))
                }
                className="text-[11px] text-[#787774] underline transition-colors hover:text-[#37352F]"
              >
                {todos ? 'desmarcar tudo' : 'marcar tudo'}
              </button>
            </div>
            <div className="space-y-3">
              {grupos.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 text-[12px] font-semibold text-[#37352F]">{g.label}</div>
                  <ul className="space-y-0.5">
                    {g.itens.map((i) => {
                      const chip = prazoChip(i.prazo, hojeIso);
                      return (
                        <li key={i.tarefaId}>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-[rgba(55,53,47,0.05)]">
                            <input
                              type="checkbox"
                              checked={sel.has(i.tarefaId)}
                              onChange={() => alternar(i.tarefaId)}
                              disabled={enviando}
                              className="h-3.5 w-3.5 shrink-0 accent-[#37352F]"
                            />
                            <span className="min-w-0 flex-1 truncate text-[13px] text-[#37352F]">
                              {i.postTitulo}
                            </span>
                            <span className={`${CHIP} ${chip.cls}`}>{chip.texto}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#787774]">
                Texto
              </div>
              {textoDesatualizado && (
                <button
                  type="button"
                  onClick={() => setManual(false)}
                  disabled={enviando}
                  className="text-[11px] text-[#787774] underline transition-colors hover:text-[#37352F]"
                >
                  refazer texto com a seleção
                </button>
              )}
            </div>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setManual(true);
              }}
              rows={14}
              disabled={enviando}
              placeholder="Marque ao menos um item pra montar a mensagem."
              className="w-full resize-y rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-3 py-2 text-[13px] leading-[1.55] text-[#37352F] transition-colors placeholder:text-[rgba(55,53,47,0.45)] focus:border-[#37352F] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[#787774]">*texto* fica em negrito no WhatsApp.</p>
          </div>

          {erro && (
            <p
              role="alert"
              className="rounded-md border border-[#37352F] px-3 py-2 text-[12px] text-[#37352F]"
            >
              {erro}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[rgba(0,0,0,0.09)] px-5 py-3">
          <button
            type="button"
            onClick={copiar}
            disabled={!texto.trim() || enviando}
            className={BTN_SECUNDARIO}
          >
            {copiado ? 'Copiado' : 'Copiar texto'}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={fechar} disabled={enviando} className={BTN_SECUNDARIO}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || !grupoNome || !texto.trim() || selecionados.length === 0}
              className={BTN_PRIMARIO}
            >
              {enviando ? 'Enviando…' : 'Enviar no grupo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
