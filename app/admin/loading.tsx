export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10 space-y-10">
      {/* Banner do dia */}
      <div className="h-[120px] rounded-2xl bg-bgSoft animate-pulse" />

      {/* Calendário da semana */}
      <div className="space-y-3">
        <div className="h-5 w-48 rounded bg-bgSoft animate-pulse" />
        <div className="h-[220px] rounded-2xl bg-bgSoft animate-pulse" />
      </div>

      {/* Entregas */}
      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-bgSoft animate-pulse" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[58px] rounded-xl border border-[rgba(21,21,33,0.06)] bg-bgSoft animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Projetos */}
      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-bgSoft animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[120px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
