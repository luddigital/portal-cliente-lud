export default function PostLoading() {
  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl lg:max-w-6xl items-center justify-between px-6 py-4">
          <div className="h-4 w-20 rounded bg-bgSoft animate-pulse" />
          <div className="h-3 w-32 rounded bg-bgSoft animate-pulse" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl lg:max-w-6xl px-6 py-8 space-y-6">
        {/* Pills do topo */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-7 w-28 rounded-full bg-bgSoft animate-pulse" />
          <div className="h-7 w-24 rounded-full bg-bgSoft animate-pulse" />
        </div>

        {/* Título */}
        <div className="h-8 w-2/3 rounded bg-bgSoft animate-pulse" />

        {/* Info boxes */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="h-12 rounded-2xl bg-bgSoft animate-pulse" />
          <div className="h-12 rounded-2xl bg-bgSoft animate-pulse" />
        </div>

        {/* Preview */}
        <div className="h-[400px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse" />

        {/* Caixa de ação */}
        <div className="h-[180px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse" />
      </main>
    </div>
  );
}
