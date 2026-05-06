import Link from 'next/link';
import type { TarefaPendente, CategoriaTarefa } from '@/lib/notion';
import { CATEGORIA_LABEL } from '@/lib/notion';

type Tone = 'em-dia' | 'tranquilo' | 'proximo' | 'hoje' | 'atrasada';

function fmtData(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}`;
}

function diffDias(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

type DeadlineInfo = {
  label: string;
  tone: Tone;
};

function calcDeadline(tarefas: TarefaPendente[]): DeadlineInfo {
  if (tarefas.length === 0) {
    return { label: 'Tudo em dia', tone: 'em-dia' };
  }

  const prazos = tarefas
    .map((t) => ({ dias: diffDias(t.tarefaPrazo), iso: t.tarefaPrazo }))
    .filter((p): p is { dias: number; iso: string } => p.dias !== null && p.iso !== null)
    .sort((a, b) => a.dias - b.dias);

  if (prazos.length === 0) {
    return { label: 'Sem prazo definido', tone: 'tranquilo' };
  }

  const proximo = prazos[0];
  if (proximo.dias < 0) {
    return { label: `Era pra ${fmtData(proximo.iso)}`, tone: 'atrasada' };
  }
  if (proximo.dias === 0) {
    return { label: 'Hoje', tone: 'hoje' };
  }
  if (proximo.dias === 1) {
    return { label: 'Vence amanhã', tone: 'proximo' };
  }
  if (proximo.dias <= 3) {
    return { label: `Em ${proximo.dias} dias`, tone: 'proximo' };
  }
  if (proximo.dias <= 7) {
    return { label: `Em ${proximo.dias} dias`, tone: 'tranquilo' };
  }
  return { label: fmtData(proximo.iso), tone: 'tranquilo' };
}

// Mapeamento único de tone → classes (número + footer)
const TONE_STYLES: Record<Tone, { num: string; footer: string; bold: boolean }> = {
  'em-dia': {
    num: 'text-[var(--cal-publicado)]',
    footer: 'text-[var(--cal-publicado)]',
    bold: false,
  },
  atrasada: {
    num: 'text-hubRed',
    footer: 'text-hubRed',
    bold: true,
  },
  hoje: {
    num: 'text-[var(--cal-aprovacao)]',
    footer: 'text-[var(--cal-aprovacao)]',
    bold: true,
  },
  proximo: {
    num: 'text-[var(--cal-agendado)]',
    footer: 'text-[var(--cal-agendado)]',
    bold: false,
  },
  tranquilo: {
    num: 'text-ink',
    footer: 'text-t3',
    bold: false,
  },
};

const CATEGORIA_ICON: Record<CategoriaTarefa, JSX.Element> = {
  pauta: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  post: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  ),
  materiais: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M21 17l-5-5-9 9" />
    </svg>
  ),
  previas: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 17v.01" />
    </svg>
  ),
  stories: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" />
    </svg>
  ),
};

const ICON_CLOCK = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const ICON_ALARM = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2" />
    <path d="M5 4L2 7M19 4l3 3" />
  </svg>
);
const ICON_WARNING = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18v.01" />
  </svg>
);
const ICON_CHECK = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export function TaskCategoryCard({
  categoria,
  tarefas,
  href,
}: {
  categoria: CategoriaTarefa;
  tarefas: TarefaPendente[];
  href: string;
}) {
  const meta = CATEGORIA_LABEL[categoria];
  const deadline = calcDeadline(tarefas);
  const empty = tarefas.length === 0;
  const styles = TONE_STYLES[deadline.tone];

  const footerIcon =
    deadline.tone === 'em-dia'
      ? ICON_CHECK
      : deadline.tone === 'atrasada'
      ? ICON_WARNING
      : deadline.tone === 'hoje'
      ? ICON_ALARM
      : ICON_CLOCK;

  const descricao = tarefas.length === 1 ? meta.descSing : meta.descPlur;

  const cardInner = (
    <div className="flex h-full flex-col rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white p-4 sm:p-6 transition group-hover:border-[rgba(21,21,33,0.16)] group-hover:shadow-[0_4px_20px_rgba(21,21,33,0.05)]">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-t2">{CATEGORIA_ICON[categoria]}</span>
        <h3 className="text-[14px] sm:text-[18px] font-semibold tracking-[-0.01em] text-ink">
          {meta.label}
        </h3>
      </div>

      <div
        className={`mt-3 sm:mt-4 text-[36px] sm:text-[52px] font-semibold leading-[1] tracking-[-0.04em] ${styles.num}`}
      >
        {tarefas.length}
      </div>

      <p className="mt-2 sm:mt-3 min-h-[36px] sm:min-h-[40px] text-[12px] sm:text-[13px] text-t2 leading-[1.4] sm:leading-[1.5]">
        {descricao}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 sm:gap-3 border-t border-[rgba(21,21,33,0.06)] pt-2.5 sm:pt-3">
        <span className={`inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] ${styles.footer}`}>
          {footerIcon}
          <span className={styles.bold ? 'font-semibold' : ''}>{deadline.label}</span>
        </span>
        {!empty && (
          <span className="hidden sm:inline text-[13px] font-medium text-ink underline-offset-4 group-hover:underline">
            Acessar →
          </span>
        )}
      </div>
    </div>
  );

  if (empty) return <div className="group">{cardInner}</div>;
  return (
    <Link href={href} className="group block">
      {cardInner}
    </Link>
  );
}
