import type { EntregaItem } from '@/lib/notion';

type Tone = 'em-dia' | 'tranquilo' | 'proximo' | 'hoje' | 'atrasada';

const TONE_PILL: Record<Tone, { bg: string; color: string }> = {
  'em-dia': { bg: 'var(--prazo-em-dia-soft)', color: 'var(--prazo-em-dia)' },
  atrasada: { bg: 'var(--prazo-atrasado-soft)', color: 'var(--prazo-atrasado)' },
  hoje: { bg: 'var(--prazo-hoje-soft)', color: 'var(--prazo-hoje)' },
  proximo: { bg: 'var(--cal-agendado-soft)', color: 'var(--cal-agendado)' },
  tranquilo: { bg: 'rgba(21,21,33,0.05)', color: 'var(--cal-rascunho)' },
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

export function EntregaCard({
  entrega,
  href,
}: {
  entrega: EntregaItem;
  href?: string;
}) {
  const tone = detectarTone(entrega);
  const pill = TONE_PILL[tone];
  const statusCurto = (() => {
    if (entrega.atrasadas > 0) {
      return `${entrega.atrasadas} em atraso`;
    }
    const s = entrega.statusTexto ?? '';
    if (s.includes('concluído') || s.includes('concluido')) return '✓ em dia';
    if (s.includes('hoje')) return 'hoje';
    return entrega.proximaEntregaTexto ?? '—';
  })();

  return (
    <a
      href={href ?? `/admin/entrega/${entrega.id}`}
      className="flex items-center gap-3 rounded-xl border border-[rgba(21,21,33,0.06)] bg-white px-3 py-2.5 transition hover:border-navy/30 hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink">
          {entrega.nome}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-t3">
          {entrega.frequencia ?? '—'}
          {entrega.proximaData && entrega.proximaData !== '⏳ Próximo Calendário não iniciado' && (
            <> · {entrega.proximaData}</>
          )}
        </div>
      </div>
      <span
        className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
        style={{ background: pill.bg, color: pill.color }}
      >
        {statusCurto}
      </span>
    </a>
  );
}
