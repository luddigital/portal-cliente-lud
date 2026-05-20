export function CardsSkeleton() {
  return (
    <div className="grid gap-2.5 grid-cols-2 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[180px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4 sm:p-6"
        >
          <div className="h-4 w-24 rounded bg-bgSoft animate-pulse" />
          <div className="mt-4 h-9 w-12 rounded bg-bgSoft animate-pulse" />
          <div className="mt-3 h-3 w-32 rounded bg-bgSoft animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 rounded-full bg-bgSoft animate-pulse" />
        <div className="h-5 w-32 rounded bg-bgSoft animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-bgSoft animate-pulse" />
      </div>
      <div className="rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-[rgba(21,21,33,0.06)]">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[60px] sm:min-h-[88px] bg-white p-2">
              <div className="h-3 w-4 rounded bg-bgSoft animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="hub-banner">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-7 w-44 rounded bg-bgSoft animate-pulse" />
        <div className="h-4 w-72 rounded bg-bgSoft animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-white px-3 py-2.5 sm:px-4 sm:py-3 sm:min-w-[110px]"
          >
            <div className="h-6 w-8 mx-auto rounded bg-bgSoft animate-pulse" />
            <div className="mt-2 h-2 w-16 mx-auto rounded bg-bgSoft animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
