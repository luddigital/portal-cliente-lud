import type { EntregaItem } from '@/lib/notion';

type Tone = 'em-dia' | 'tranquilo' | 'proximo' | 'hoje' | 'atrasada';

const TONE_PILL: Record<Tone, { bg: string; color: string }> = {
  'em-dia': { bg: 'var(--prazo-em-dia-soft)', color: 'var(--prazo-em-dia)' },
  atrasada: { bg: 'var(--prazo-atrasado-soft)', color: 'var(--prazo-atrasado)' },
  hoje: { bg: 'var(--prazo-hoje-soft)', color: 'var(--prazo-hoje)' },
  proximo: { bg: 'var(--cal-agendado-soft)', color: 'var(--cal-agendado)' },
  tranquilo: { bg: 'rgba(21,21,33,0.05)', color: 'var(--cal-rascunho)' },
};

/** Cor sólida do "topinho" — forte, não a versão soft. */
const TONE_TOPO: Record<Tone, string> = {
  'em-dia': 'var(--prazo-em-dia)',
  atrasada: 'var(--prazo-atrasado)',
  hoje: 'var(--prazo-hoje)',
  proximo: 'var(--cal-agendado)',
  tranquilo: 'rgba(21,21,33,0.15)',
};

function detectarTone(e: EntregaItem): Tone {
  const status = (e.statusTexto ?? '').toLowerCase();
  const prox = (e.proximaEntregaTexto ?? '').toLowerCase();
  if (e.atrasadas > 0 || status.includes('atraso')) return 'atrasada';
  if (prox.includes('hoje')) return 'hoje';
  if (prox.includes('dia') || prox.includes('amanh')) return 'proximo';
  if (status.includes('concluído') || status.includes('concluido')) return 'em-dia';
  return 'tranquilo';
}

/** Extrai número de dias se o texto for "em X dias" ou "amanhã". */
function diasAte(texto: string | null): number | null {
  if (!texto) return null;
  const t = texto.toLowerCase();
  if (t.includes('hoje')) return 0;
  if (t.includes('amanh')) return 1;
  const m = t.match(/(\d+)\s*dia/);
  return m ? parseInt(m[1], 10) : null;
}

/** Tira só o dia de uma data tipo "15/10/2026" → "15". */
function diaDaData(data: string | null): string | null {
  if (!data) return null;
  const m = data.match(/^(\d{1,2})\//);
  return m ? m[1].padStart(2, '0') : null;
}

export function EntregaCard({
  entrega,
  href,
}: {
  entrega: EntregaItem;
  href?: string;
}) {
  const tone = detectarTone(entrega);
  const pill = TONE_PILL[tone];
  const topoBg = TONE_TOPO[tone];
  const dias = diasAte(entrega.proximaEntregaTexto);
  const dia = diaDaData(entrega.proximaData);
  const statusConcluido =
    (entrega.statusTexto ?? '').toLowerCase().includes('conclu');

  const statusCurto = (() => {
    if (entrega.atrasadas > 0) return `${entrega.atrasadas} em atraso`;
    if (statusConcluido) return '✓ em dia';
    if (dias === 0) return 'hoje';
    if (dias === 1) return 'amanhã';
    return entrega.proximaEntregaTexto ?? '—';
  })();

  // Linhas de info principal — ícones só se há conteúdo relevante.
  const infoLinhas: { icone: string; texto: string }[] = [];
  if (entrega.atrasadas > 0) {
    infoLinhas.push({
      icone: '📕',
      texto: `${entrega.atrasadas} tarefa${entrega.atrasadas > 1 ? 's' : ''} em atraso`,
    });
  }
  if (dias != null && dias > 0 && !statusConcluido) {
    infoLinhas.push({
      icone: '📅',
      texto:
        dias === 1
          ? 'Próxima entrega amanhã'
          : `${dias} dias pra próxima entrega`,
    });
  } else if (dias === 0 && !statusConcluido) {
    infoLinhas.push({ icone: '🔥', texto: 'Próxima entrega hoje' });
  }
  if (
    entrega.proximaData &&
    entrega.proximaData !== '⏳ Próximo Calendário não iniciado' &&
    infoLinhas.length === 0
  ) {
    infoLinhas.push({ icone: '📅', texto: entrega.proximaData });
  }

  return (
    <a
      href={href ?? `/admin/entrega/${entrega.id}`}
      className="group block overflow-hidden rounded-xl border border-[rgba(21,21,33,0.06)] bg-white transition hover:border-navy/30 hover:shadow-sm"
    >
      {/* Topinho colorido */}
      <div
        className="h-1 w-full"
        style={{ background: topoBg }}
        aria-hidden
      />

      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {/* Nome + frequência */}
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[13px] font-semibold text-ink">
              {entrega.nome}
            </div>
            <span
              className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
              style={{ background: pill.bg, color: pill.color }}
            >
              {statusCurto}
            </span>
          </div>

          {/* Info detalhada (atraso + dias pra próxima) */}
          {infoLinhas.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {infoLinhas.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[11.5px] text-t2"
                >
                  <span className="shrink-0 text-[12px] leading-none">
                    {l.icone}
                  </span>
                  <span className="truncate">{l.texto}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rodapé: frequência (sempre) + data da próxima entrega */}
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-t3">
            <span className="truncate">{entrega.frequencia ?? '—'}</span>
            {entrega.proximaData &&
              entrega.proximaData !== '⏳ Próximo Calendário não iniciado' &&
              infoLinhas.some((l) => l.texto.includes('dia')) && (
                <span className="truncate font-mono">{entrega.proximaData}</span>
              )}
          </div>
        </div>

        {/* Dia destacado — tipo o anexo 2 */}
        {dia && !statusConcluido && entrega.atrasadas === 0 && (
          <div
            className="shrink-0 flex h-10 w-10 flex-col items-center justify-center rounded-lg"
            style={{ background: pill.bg, color: pill.color }}
            aria-hidden
          >
            <span className="font-mono text-[16px] font-bold leading-none">
              {dia}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}
