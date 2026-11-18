/** Aparece na hora em que você clica, enquanto a página busca os dados. */
export default function Carregando() {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="h-4 w-40 animate-pulse rounded-full bg-[#ECECEE]" />
      <div className="h-9 w-72 animate-pulse rounded-[10px] bg-[#ECECEE]" />
      <div className="mt-2 h-10 w-64 animate-pulse rounded-[12px] bg-[#F0F0F1]" />
      <div className="h-[420px] animate-pulse rounded-[20px] border border-[#E9E9EB] bg-white" />
    </div>
  );
}
