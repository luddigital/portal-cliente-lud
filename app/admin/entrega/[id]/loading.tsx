export default function EntregaLoading() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-4xl lg:max-w-7xl items-center justify-between px-6 py-4">
          <div className="h-4 w-20 rounded bg-bgSoft animate-pulse" />
          <div className="h-3 w-16 rounded bg-bgSoft animate-pulse" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-6">
        <div className="h-7 w-3 rounded bg-bgSoft animate-pulse" />
        <div className="h-9 w-1/2 rounded bg-bgSoft animate-pulse" />
        <div className="h-[100px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[140px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
