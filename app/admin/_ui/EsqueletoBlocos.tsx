/**
 * Esqueleto simples das telas novas (proposta NOVA): cabeçalho + blocos cinza
 * nos tamanhos da tela, pra navegação mostrar algo na hora.
 */
export function EsqueletoBlocos({
  kpis = 0,
  blocos = [240, 240],
  lateral = false,
}: {
  /** Quantos cards de número no topo (0 = nenhum). */
  kpis?: number;
  /** Altura (px) de cada bloco grande. */
  blocos?: number[];
  /** Duas colunas (conteúdo + lateral de 340px). */
  lateral?: boolean;
}) {
  const caixa = 'animate-pulse rounded-[20px] bg-[#F0F0F1]';
  const corpo = (
    <div className="flex min-w-0 flex-col gap-[18px]">
      {blocos.map((h, i) => (
        <div key={i} className={caixa} style={{ height: h }} />
      ))}
    </div>
  );
  return (
    <main className="lud-admin mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 py-7 sm:px-8">
      <div className="flex flex-col gap-2">
        <div className="h-3.5 w-28 animate-pulse rounded bg-[#F0F0F1]" />
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[#F0F0F1]" />
        <div className="h-3.5 w-96 max-w-full animate-pulse rounded bg-[#F0F0F1]" />
      </div>
      {kpis > 0 && (
        <div className={`grid grid-cols-2 gap-3 ${kpis === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="h-[96px] animate-pulse rounded-[18px] bg-[#F0F0F1]" />
          ))}
        </div>
      )}
      {lateral ? (
        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          {corpo}
          <div className="flex flex-col gap-[18px]">
            <div className={caixa} style={{ height: 200 }} />
            <div className={caixa} style={{ height: 240 }} />
          </div>
        </div>
      ) : (
        corpo
      )}
    </main>
  );
}
