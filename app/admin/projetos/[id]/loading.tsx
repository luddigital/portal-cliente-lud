export default function ProjetoAdminLoading() {
  return (
    <div className="pb-14">
      <div
        className="h-44 w-full"
        style={{
          background:
            'linear-gradient(135deg, #BAC4E6 0%, #8485A3 55%, #313D65 100%)',
        }}
      />
      <div className="mx-auto -mt-16 max-w-7xl px-6">
        <div className="h-[120px] rounded-2xl bg-white" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[160px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse"
              />
            ))}
          </div>
          <div className="h-[200px] rounded-2xl border border-[rgba(21,21,33,0.08)] bg-bgSoft animate-pulse" />
        </div>
      </div>
    </div>
  );
}
