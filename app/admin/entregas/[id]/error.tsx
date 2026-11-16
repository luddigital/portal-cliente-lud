'use client';

/** Quando o Notion não responde a tempo: aviso claro e "Tentar de novo", em vez de "não achei". */
export default function ErroEntrega({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-7 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#F3C4BE] bg-[#FBE3E0] px-5 py-4 text-[#7E211C]">
        <span className="text-[14px] font-bold">O Notion demorou pra responder e a entrega não carregou.</span>
        <button type="button" onClick={reset} className="rounded-full border border-[#7E211C] bg-white px-4 py-1.5 text-[13px] font-extrabold">
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
