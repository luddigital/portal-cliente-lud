export function EtapaBanner({
  saudacao,
  projeto,
  pendencias,
  postsNoMes,
  mesLabel,
}: {
  saudacao: string;
  projeto?: string;
  pendencias: number;
  postsNoMes?: number;
  mesLabel?: string;
}) {
  return (
    <div className="hub-banner">
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-[-0.03em] text-ink">
          {saudacao}
        </h1>
        <p className="mt-1 text-[13px] sm:text-[14px] text-t2">
          {projeto ? (
            <>
              Essa é a sua central da Lud. para o projeto <b>{projeto}</b>.
            </>
          ) : (
            <>Essa é a sua central da Lud.</>
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch sm:gap-3">
        <Stat label="pendência" labelPlural="pendências" value={pendencias} />
        {typeof postsNoMes === 'number' && (
          <Stat
            label={mesLabel ? `post em ${mesLabel}` : 'post no mês'}
            labelPlural={mesLabel ? `posts em ${mesLabel}` : 'posts no mês'}
            value={postsNoMes}
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  labelPlural,
}: {
  value: number;
  label: string;
  labelPlural: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-[rgba(21,21,33,0.08)] px-3 sm:px-4 py-2.5 sm:py-3 sm:min-w-[110px] text-center">
      <div className="text-[22px] sm:text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">
        {value}
      </div>
      <div className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-t3">
        {value === 1 ? label : labelPlural}
      </div>
    </div>
  );
}
