'use client';

import { useState } from 'react';

/** Duas entregas que andam juntas numa página só (ex.: Materiais + Aprovação dos materiais). As duas ficam montadas. */
export function AbasDaEntrega({ abas, inicial = 0 }: { abas: { rotulo: string; conteudo: React.ReactNode }[]; inicial?: number }) {
  const [aba, setAba] = useState(inicial);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-[#EDEDEF]">
        {abas.map((a, k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[14.5px] ${aba === k ? 'border-[#111113] font-bold text-[#111113]' : 'border-transparent text-[#636369] hover:text-[#111113]'}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {abas.map((a, k) => (
        <div key={k} className={aba === k ? 'flex flex-col gap-4' : 'hidden'}>
          {a.conteudo}
        </div>
      ))}
    </div>
  );
}
