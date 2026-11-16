/** Esqueleto das páginas internas (trilha + título + blocos), enquanto o Notion responde. */
export function EsqueletoPagina({ blocos = 3, numeros = false }: { blocos?: number; numeros?: boolean }) {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8 lg:max-w-7xl">
      <div className="h-4 w-64 animate-pulse rounded bg-bgSoft" />
      <div className="h-9 w-1/2 animate-pulse rounded bg-bgSoft" />
      {numeros && (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-[18px] bg-bgSoft" />
          ))}
        </div>
      )}
      {Array.from({ length: blocos }).map((_, i) => (
        <div key={i} className="h-[160px] animate-pulse rounded-[20px] bg-bgSoft" />
      ))}
    </main>
  );
}
