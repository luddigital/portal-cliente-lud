/** Placeholder das seções do LudHub que ainda serão construídas. */
export function EmConstrucao({
  titulo,
  fase,
}: {
  titulo: string;
  fase: string;
}) {
  return (
    <main className="mx-auto max-w-4xl lg:max-w-7xl px-6 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink">
        {titulo}
      </h1>
      <div className="mt-6 rounded-2xl border border-dashed border-[rgba(21,21,33,0.16)] bg-white p-12 text-center">
        <div className="text-[28px]">🚧</div>
        <div className="mt-2 text-[15px] font-semibold text-ink">
          Em construção
        </div>
        <p className="mt-1 text-[13px] text-t2">
          Essa seção chega na <b>{fase}</b> do LudHub.
        </p>
      </div>
    </main>
  );
}
