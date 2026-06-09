export default function ClienteLoading() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-6xl xl:max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[20px] font-bold tracking-[-0.02em] text-ink">
              Lud<span className="font-light text-mauve">.</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Portal do cliente
            </div>
          </div>
          <div className="h-3 w-12 rounded bg-bgSoft animate-pulse" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl xl:max-w-7xl px-6 py-8 space-y-8">
        <div className="h-[120px] rounded-2xl bg-bgSoft animate-pulse" />
        <div className="grid gap-2.5 grid-cols-2 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] rounded-2xl bg-bgSoft animate-pulse" />
          ))}
        </div>
        <div className="h-[300px] rounded-2xl bg-bgSoft animate-pulse" />
      </main>
    </div>
  );
}
