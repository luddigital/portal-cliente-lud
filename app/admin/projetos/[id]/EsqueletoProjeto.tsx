/** Blocos cinza nos tamanhos da página do projeto (capa, caixinhas, conteúdo + lateral). */
export function EsqueletoProjeto() {
  const b = 'animate-pulse bg-[#F4F4F5]';
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 py-7 sm:px-8">
      <div className={`h-4 w-40 rounded ${b}`} />
      <div className="flex flex-col rounded-[22px] border border-[#E9E9EB] bg-white">
        <div className={`h-[170px] rounded-t-[22px] sm:h-[200px] ${b}`} />
        <div className="flex items-end gap-4 px-5 pb-5">
          <div className="-mt-12 h-[88px] w-[88px] rounded-full border-[5px] border-white bg-[#E9E9EB]" />
          <div className={`h-8 w-64 rounded-[10px] ${b}`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-[132px] rounded-[18px] ${b}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex flex-col gap-[18px]">
          <div className={`h-[160px] rounded-[20px] ${b}`} />
          <div className={`h-[260px] rounded-[20px] ${b}`} />
          <div className={`h-[300px] rounded-[20px] ${b}`} />
        </div>
        <div className="flex flex-col gap-[18px]">
          <div className={`h-[420px] rounded-[20px] ${b}`} />
          <div className={`h-[150px] rounded-[20px] ${b}`} />
        </div>
      </div>
    </main>
  );
}
