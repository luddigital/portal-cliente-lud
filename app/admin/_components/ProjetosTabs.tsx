'use client';

import { useState, type ReactNode } from 'react';

export type ItemProjeto = {
  id: string;
  servico: string;
  card: ReactNode;
};

const ORDEM_PREFERIDA: Record<string, number> = {
  Instagram: 1,
  TikTok: 2,
  Stories: 3,
  'Tráfego Pago': 4,
  Site: 5,
  'Landing Page': 6,
  'E-book': 7,
  Mentoria: 8,
  Consultoria: 9,
  Grupos: 10,
  'Identidade visual': 11,
  Interno: 90,
  Outros: 99,
};

export function ProjetosTabs({ itens }: { itens: ItemProjeto[] }) {
  // Agrupa contagem por serviço
  const contagem = new Map<string, number>();
  for (const it of itens) {
    contagem.set(it.servico, (contagem.get(it.servico) ?? 0) + 1);
  }
  const servicos = [...contagem.keys()].sort((a, b) => {
    const oa = ORDEM_PREFERIDA[a] ?? 50;
    const ob = ORDEM_PREFERIDA[b] ?? 50;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b, 'pt-BR');
  });

  const [ativo, setAtivo] = useState<string>('todos');

  const filtrados =
    ativo === 'todos' ? itens : itens.filter((it) => it.servico === ativo);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabBtn
          ativo={ativo === 'todos'}
          onClick={() => setAtivo('todos')}
          label="Todos"
          count={itens.length}
        />
        {servicos.map((s) => (
          <TabBtn
            key={s}
            ativo={ativo === s}
            onClick={() => setAtivo(s)}
            label={s}
            count={contagem.get(s) ?? 0}
          />
        ))}
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <p className="text-[13px] text-t3">
          Nenhum projeto nesse serviço.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((it) => (
            <div key={it.id}>{it.card}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  ativo,
  onClick,
  label,
  count,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition ${
        ativo
          ? 'bg-ink font-semibold text-white'
          : 'bg-bgSoft text-t2 hover:bg-[rgba(21,21,33,0.08)] hover:text-ink'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
          ativo ? 'bg-white/20 text-white' : 'bg-white/80 text-t3'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
