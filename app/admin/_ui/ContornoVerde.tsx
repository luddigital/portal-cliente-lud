import type { ReactNode } from 'react';

/**
 * Deixa o botão de lembrete (BotaoLembreteWpp) no estilo do mock: pílula
 * branca com contorno e texto verdes. Só muda o visual do botão que abre o
 * popup; o popup e o envio (sempre pro grupo do cliente) continuam iguais.
 */
export function ContornoVerde({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex [&>div>button]:!rounded-[9px] [&>div>button]:!border [&>div>button]:!border-[#9CCBAE] [&>div>button]:!bg-white [&>div>button]:!px-2.5 [&>div>button]:!py-1 [&>div>button]:!text-[11.5px] [&>div>button]:!font-extrabold [&>div>button]:!text-[#2E7D4F] [&>div>button]:!shadow-none [&>div>button:hover]:!bg-[#EEF7F1]">
      {children}
    </span>
  );
}
