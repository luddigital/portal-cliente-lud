'use client';

import { useEffect, useState } from 'react';

/**
 * Colunas das tabelas internas, como as "propriedades" de uma visão do Notion:
 * todas as tabelas usam a MESMA ordem (ORDEM_PADRAO) e cada visão escolhe o que mostrar.
 * A escolha fica guardada no navegador de quem usa (só admin).
 */

export type Coluna = 'data' | 'tarefa' | 'status' | 'post' | 'projeto' | 'pessoa' | 'sinal' | 'acao';

// Tarefa e Status lado a lado: a tag da tarefa e a do que está segurando ficam juntas.
export const ORDEM_PADRAO: Coluna[] = ['data', 'tarefa', 'status', 'post', 'projeto', 'pessoa', 'sinal', 'acao'];

export const NOME_COLUNA: Record<Coluna, string> = {
  data: 'Data',
  tarefa: 'Tarefa',
  status: 'Status',
  post: 'Post',
  projeto: 'Projeto',
  pessoa: 'Resp.',
  sinal: 'Sinal',
  acao: 'Ação',
};

export function usePropriedades(chave: string, padrao: Coluna[]) {
  const [visiveis, setVisiveis] = useState<Coluna[]>(padrao);
  useEffect(() => {
    try {
      const v = JSON.parse(window.localStorage.getItem(`lud-props-v2-${chave}`) ?? 'null');
      if (Array.isArray(v)) setVisiveis(v.filter((c): c is Coluna => ORDEM_PADRAO.includes(c)));
    } catch {
      /* sem storage */
    }
  }, [chave]);
  const alternar = (c: Coluna) =>
    setVisiveis((atual) => {
      const nova = atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c];
      try {
        window.localStorage.setItem(`lud-props-v2-${chave}`, JSON.stringify(nova));
      } catch {
        /* sem storage */
      }
      return nova;
    });
  const restaurar = () => {
    setVisiveis(padrao);
    try {
      window.localStorage.removeItem(`lud-props-v2-${chave}`);
    } catch {
      /* sem storage */
    }
  };
  // Sempre na ordem padrão, seja qual for a ordem em que foram ligadas.
  const colunas = ORDEM_PADRAO.filter((c) => visiveis.includes(c));
  return { colunas, alternar, restaurar, tem: (c: Coluna) => colunas.includes(c) };
}

/** Botão "Propriedades" com os interruptores de cada coluna (igual ao olhinho do Notion). */
export function MenuPropriedades({
  disponiveis,
  colunas,
  alternar,
  restaurar,
}: {
  disponiveis: Coluna[];
  colunas: Coluna[];
  alternar: (c: Coluna) => void;
  restaurar: () => void;
}) {
  return (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-[#E2E2E5] bg-white px-3 py-1 text-[12.5px] font-semibold text-[#46464B] hover:bg-[#F4F4F5] [&::-webkit-details-marker]:hidden">
        ⚙︎ Propriedades <span className="text-[10px] text-[#8A8A90]">▾</span>
      </summary>
      <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-[220px] flex-col rounded-[12px] border border-[#E9E9EB] bg-white p-1 shadow-[0_8px_24px_rgba(17,17,19,0.12)]">
        <span className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-[#8A8A90]">Mostrar na tabela</span>
        {ORDEM_PADRAO.filter((c) => disponiveis.includes(c)).map((c) => {
          const on = colunas.includes(c);
          return (
            <button key={c} type="button" onClick={() => alternar(c)} className="flex items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[13px] hover:bg-[#F4F4F5]">
              <span className={on ? 'text-[#111113]' : 'text-[#A1A1A8]'}>{NOME_COLUNA[c]}</span>
              <span className={`relative h-[16px] w-[28px] rounded-full transition ${on ? 'bg-[#111113]' : 'bg-[#D6D6D9]'}`}>
                <span className={`absolute top-[2px] h-3 w-3 rounded-full bg-white transition-all ${on ? 'left-[14px]' : 'left-[2px]'}`} />
              </span>
            </button>
          );
        })}
        <button type="button" onClick={restaurar} className="mt-1 border-t border-[#F0F0F2] px-2.5 py-1.5 text-left text-[12px] font-semibold text-[#636369] hover:text-[#111113]">
          Voltar ao padrão
        </button>
      </div>
    </details>
  );
}
