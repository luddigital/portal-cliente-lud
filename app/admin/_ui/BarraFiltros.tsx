'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Barra de filtros e ordenação, igual em todas as páginas (proposta "Filtros e ordenação" do canvas).
 * Peças, sempre nesta ordem: Tudo | ● Liberadas · Período · Pessoa · Cliente · Etapa · Formato … ↕ Ordenar · Propriedades.
 * Cada página liga só as peças que fazem sentido nela.
 */

export type Ordem = 'data' | 'data-desc' | 'prazo' | 'status' | 'cliente' | 'pessoa' | 'atualizacao' | 'formato';
export type Agrupar = 'nada' | 'pessoa' | 'cliente' | 'etapa';

export const NOME_ORDEM: Record<Ordem, { rot: string; dica: string }> = {
  data: { rot: 'Data', dica: 'mais antiga primeiro' },
  'data-desc': { rot: 'Data', dica: 'mais nova primeiro' },
  prazo: { rot: 'Prazo', dica: 'atrasados primeiro' },
  status: { rot: 'Status', dica: 'na ordem das etapas' },
  cliente: { rot: 'Cliente', dica: 'A a Z' },
  pessoa: { rot: 'Pessoa', dica: 'A a Z' },
  atualizacao: { rot: 'Última atualização', dica: 'mais recente primeiro' },
  formato: { rot: 'Formato', dica: 'Reels, Carrossel, Stories' },
};
const NOME_AGRUPAR: Record<Agrupar, string> = { nada: 'Nada', pessoa: 'Pessoa', cliente: 'Cliente', etapa: 'Etapa' };

/** Estado guardado no navegador (por página), pra a escolha não sumir ao voltar. */
export function useGuardado<T>(chave: string, padrao: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(padrao);
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(`lud-barra-${chave}`);
      if (s != null) setV(JSON.parse(s) as T);
    } catch {
      /* sem storage */
    }
  }, [chave]);
  const set = (n: T) => {
    setV(n);
    try {
      window.localStorage.setItem(`lud-barra-${chave}`, JSON.stringify(n));
    } catch {
      /* sem storage */
    }
  };
  return [v, set];
}

/** Campos que a ordenação lê de cada item. */
export type CamposOrdem = {
  data?: string | null;
  status?: number | null;
  cliente?: string | null;
  pessoa?: string | null;
  atualizacao?: string | null;
  formato?: string | null;
};

const vazioNoFim = (a: string | null | undefined, b: string | null | undefined, f: (x: string, y: string) => number) =>
  !a && !b ? 0 : !a ? 1 : !b ? -1 : f(a, b);
const az = (x: string, y: string) => x.localeCompare(y, 'pt-BR');

export function ordenarPor<T>(lista: T[], ordem: Ordem, campos: (t: T) => CamposOrdem): T[] {
  const c = new Map(lista.map((t) => [t, campos(t)] as const));
  const cmpData = (a: CamposOrdem, b: CamposOrdem) => vazioNoFim(a.data, b.data, az);
  return [...lista].sort((x, y) => {
    const a = c.get(x)!;
    const b = c.get(y)!;
    switch (ordem) {
      case 'data':
      case 'prazo':
        return cmpData(a, b);
      case 'data-desc':
        return vazioNoFim(a.data, b.data, (p, q) => az(q, p));
      case 'status':
        return (a.status ?? 999) - (b.status ?? 999) || cmpData(a, b);
      case 'cliente':
        return vazioNoFim(a.cliente, b.cliente, az) || cmpData(a, b);
      case 'pessoa':
        return vazioNoFim(a.pessoa, b.pessoa, az) || cmpData(a, b);
      case 'atualizacao':
        return vazioNoFim(a.atualizacao, b.atualizacao, (p, q) => az(q, p)) || cmpData(a, b);
      case 'formato':
        return vazioNoFim(a.formato, b.formato, az) || cmpData(a, b);
    }
  });
}

export type OpcaoMenu = { v: string; rot: string; n?: number; icone?: ReactNode };

const PILULA = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[12.5px] font-semibold';
const PILULA_OFF = 'border-[#E2E2E5] bg-white text-[#46464B] hover:bg-[#F4F4F5]';
const PILULA_ON = 'border-[#111113] bg-[#111113] text-white';
const CAIXA = 'absolute top-[calc(100%+6px)] z-30 flex max-h-[340px] flex-col overflow-y-auto rounded-[12px] border border-[#E9E9EB] bg-white p-1 shadow-[0_8px_24px_rgba(17,17,19,0.12)]';
const fechar = (el: HTMLElement) => (el.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');

/** Menu de escolha única ("Pessoa ▾", "Cliente ▾"…). valor null = todos. */
export function MenuFiltro({ rot, opcoes, valor, set, todos = 'Todos' }: { rot: string; opcoes: OpcaoMenu[]; valor: string | null; set: (v: string | null) => void; todos?: string }) {
  const sel = opcoes.find((o) => o.v === valor);
  return (
    <details className="relative">
      <summary className={`${PILULA} cursor-pointer list-none [&::-webkit-details-marker]:hidden ${sel ? PILULA_ON : PILULA_OFF}`}>
        {sel ? sel.rot : rot} <span className={`text-[10px] ${sel ? 'text-white/70' : 'text-[#8A8A90]'}`}>▾</span>
      </summary>
      <div className={`${CAIXA} left-0 w-[230px]`}>
        {[{ v: '', rot: todos } as OpcaoMenu, ...opcoes].map((o) => {
          const ativo = (o.v || null) === valor;
          return (
            <button
              key={o.v || '__todos'}
              type="button"
              onClick={(e) => {
                set(o.v || null);
                fechar(e.currentTarget);
              }}
              className={`flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] hover:bg-[#F4F4F5] ${ativo ? 'font-bold' : ''}`}
            >
              {o.icone}
              <span className="flex-1 truncate">{o.rot}</span>
              {o.n != null && <span className="text-[11.5px] text-[#8A8A90]">{o.n}</span>}
              {ativo && <span className="text-[12px]">✓</span>}
            </button>
          );
        })}
      </div>
    </details>
  );
}

/** "↕ Ordenar: Data ▾" com as opções da página e, se tiver, o Agrupar embaixo. */
export function MenuOrdenar({
  opcoes,
  valor,
  set,
  agrupar,
}: {
  opcoes: Ordem[];
  valor: Ordem;
  set: (o: Ordem) => void;
  agrupar?: { opcoes: Agrupar[]; valor: Agrupar; set: (a: Agrupar) => void };
}) {
  return (
    <details className="relative">
      <summary className={`${PILULA} ${PILULA_OFF} cursor-pointer list-none border-[#111113] [&::-webkit-details-marker]:hidden`}>
        ↕ Ordenar: <b className="text-[#111113]">{NOME_ORDEM[valor].rot}</b> <span className="text-[10px] text-[#8A8A90]">▾</span>
      </summary>
      <div className={`${CAIXA} right-0 w-[240px]`}>
        <span className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-extrabold tracking-[0.08em] text-[#8A8A90]">ORDENAR POR</span>
        {opcoes.map((o) => (
          <button
            key={o}
            type="button"
            onClick={(e) => {
              set(o);
              fechar(e.currentTarget);
            }}
            className={`flex items-start gap-2 rounded-[8px] px-2.5 py-1.5 text-left hover:bg-[#F4F4F5] ${valor === o ? 'bg-[#F4F4F5]' : ''}`}
          >
            <span className="w-3 pt-[1px] text-[12px]">{valor === o ? '✓' : ''}</span>
            <span className="flex flex-col">
              <span className="text-[13px] font-semibold text-[#111113]">{NOME_ORDEM[o].rot}</span>
              <span className="text-[11.5px] text-[#8A8A90]">{NOME_ORDEM[o].dica}</span>
            </span>
          </button>
        ))}
        {agrupar && (
          <>
            <span className="mt-1 border-t border-[#F0F0F2] px-2.5 pb-1 pt-2 text-[10.5px] font-extrabold tracking-[0.08em] text-[#8A8A90]">AGRUPAR</span>
            <div className="mx-2 mb-1.5 flex rounded-[10px] bg-[#F4F4F5] p-[3px]">
              {agrupar.opcoes.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => agrupar.set(a)}
                  className={`flex-1 rounded-[8px] px-2 py-1 text-[12px] font-bold ${agrupar.valor === a ? 'bg-white text-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-[#636369]'}`}
                >
                  {NOME_AGRUPAR[a]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

/** "Tudo | ● Liberadas": esconde o que ainda está travado (🔒, esperando a etapa anterior). */
export function AlternarLiberadas({ valor, set }: { valor: boolean; set: (v: boolean) => void }) {
  return (
    <span className="inline-flex rounded-full border border-[#E2E2E5] bg-[#F4F4F5] p-[2px]" title="Liberadas: só o que dá pra fazer agora. Some o que está travado 🔒 esperando a etapa anterior.">
      {[false, true].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => set(v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-[3px] text-[12.5px] font-bold ${valor === v ? 'bg-white text-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-[#636369]'}`}
        >
          {v && <span className="h-2 w-2 rounded-full bg-[#2E7D4F]" />}
          {v ? 'Liberadas' : 'Tudo'}
        </button>
      ))}
    </span>
  );
}

/** Pílulas de período com a contagem (Atrasados · Esta semana · Próxima · Depois). */
export function PilulasPeriodo({ opcoes, valor, set }: { opcoes: { v: string; rot: string; n: number; cor?: string }[]; valor: string; set: (v: string) => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {opcoes.map((o) => {
        const ativo = valor === o.v;
        return (
          <button key={o.v} type="button" onClick={() => set(o.v)} className={`${PILULA} ${ativo ? PILULA_ON : PILULA_OFF}`}>
            {o.cor && <span className="h-2 w-2 rounded-full" style={{ background: o.cor }} />}
            {o.rot}
            <span className={`text-[11.5px] ${ativo ? 'text-white/70' : 'text-[#8A8A90]'}`}>{o.n}</span>
          </button>
        );
      })}
    </span>
  );
}

/** A barra: esquerda (filtros) e direita (Ordenar, Propriedades). */
export function BarraFiltros({ esquerda, direita }: { esquerda: ReactNode; direita?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#EDEDEF] bg-white px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">{esquerda}</div>
      {direita && <div className="flex items-center gap-1.5">{direita}</div>}
    </div>
  );
}

/** Separador fininho entre grupos de peças. */
export const Divisor = () => <span className="mx-0.5 h-5 w-px bg-[#E9E9EB]" />;
