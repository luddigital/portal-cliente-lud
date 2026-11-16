/**
 * Esqueletos (blocos cinza) pros loading.tsx das telas novas: aparecem na hora
 * enquanto os dados do Notion chegam. Só cinza, sem animação chamativa.
 */
const B = 'animate-pulse rounded-[20px] bg-[#F1F1F2]';

export function Bloco({ h, className = '' }: { h: number; className?: string }) {
  return <div className={`${B} ${className}`} style={{ height: h }} />;
}

/** Cabeçalho (eyebrow + título). */
export function EsqueletoCabecalho() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-3.5 w-40 animate-pulse rounded bg-[#F1F1F2]" />
      <div className="h-8 w-64 animate-pulse rounded-lg bg-[#F1F1F2]" />
    </div>
  );
}

/** Página de etapa: 4 números, progresso, lista + lateral, semana. */
export function EsqueletoEtapa() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 py-7 sm:px-8">
      <EsqueletoCabecalho />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bloco key={i} h={100} />
        ))}
      </div>
      <Bloco h={96} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <Bloco h={300} />
        <div className="flex flex-col gap-[18px]">
          <Bloco h={200} />
          <Bloco h={80} />
          <Bloco h={80} />
        </div>
      </div>
      <Bloco h={240} />
    </main>
  );
}

/** Página de duas colunas (conteúdo grande + passos na lateral). */
export function EsqueletoDuasColunas({ lateral = 380 }: { lateral?: number }) {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 py-7 sm:px-8">
      <EsqueletoCabecalho />
      <div className="grid grid-cols-1 gap-[18px] lg:[grid-template-columns:minmax(0,1fr)_var(--l)]" style={{ ['--l' as any]: `${lateral}px` }}>
        <Bloco h={720} />
        <div className="flex flex-col gap-[18px]">
          <Bloco h={150} />
          <Bloco h={100} />
          <Bloco h={190} />
          <Bloco h={260} />
        </div>
      </div>
    </main>
  );
}
