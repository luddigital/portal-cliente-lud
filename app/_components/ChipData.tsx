/** Urgência de uma data com prazo, em dias a partir de hoje (YYYY-MM-DD). */
export function urgenciaDaData(
  prazo: string | null,
  hoje: string,
): 'atrasado' | 'hoje' | 'chegando' | 'em-dia' | 'tranquilo' | 'sem-prazo' {
  if (!prazo) return 'sem-prazo';
  const d = (s: string) => {
    const [y, m, dd] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  const dias = Math.round((d(prazo) - d(hoje)) / 86_400_000);
  if (dias < 0) return 'atrasado';
  if (dias === 0) return 'hoje';
  if (dias <= 2) return 'chegando';
  if (dias <= 7) return 'em-dia';
  return 'tranquilo';
}

function textoDias(prazo: string, hoje: string): string {
  const d = (s: string) => {
    const [y, m, dd] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  const dias = Math.round((d(prazo) - d(hoje)) / 86_400_000);
  if (dias < 0) return `atrasado ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias} dias`;
}

/**
 * Chip de data padrão do portal (design system › Chips de data): sólido, texto
 * branco, cor pela urgência. Mostra dd/mm; `texto` troca o rótulo se precisar.
 */
export function ChipData({
  prazo,
  hoje,
  texto,
  className = '',
}: {
  prazo: string | null;
  hoje: string;
  texto?: string;
  className?: string;
}) {
  const nivel = urgenciaDaData(prazo, hoje);
  const rotulo = texto ?? (prazo ? `${prazo.slice(8, 10)}/${prazo.slice(5, 7)}` : 'sem prazo');
  return (
    <span className={`chip-data ${nivel} ${className}`} title={prazo ? textoDias(prazo, hoje) : undefined}>
      {rotulo}
    </span>
  );
}
