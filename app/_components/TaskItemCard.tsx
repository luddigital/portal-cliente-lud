import Link from 'next/link';
import type { TarefaPendente, CategoriaTarefa } from '@/lib/notion';

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

const MESES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function fmtDiaMes(iso: string | null): { dia: string; mes: string } {
  if (!iso) return { dia: '—', mes: '' };
  const [, m, d] = iso.split('T')[0].split('-');
  return { dia: d, mes: MESES_ABREV[parseInt(m, 10) - 1] ?? '' };
}

const FORMATO_LABEL: Record<'post' | 'reels' | 'story' | 'desconhecido', string> = {
  post: 'Carrossel',
  reels: 'Reels',
  story: 'Stories',
  desconhecido: 'Post',
};

function diffDias(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function hrefDaCategoria(categoria: CategoriaTarefa, t: TarefaPendente): string {
  // Tudo abre a página única do post — ela se adapta à etapa (aprovação/material).
  return `/post/${t.postId}?tarefa=${t.tarefaId}&from=${categoria}`;
}

function statusPrazo(iso: string | null): {
  label: string;
  className: string;
} {
  const dias = diffDias(iso);
  if (dias === null) {
    return { label: 'Sem prazo', className: 'text-t3' };
  }
  if (dias < 0) {
    return {
      label: `Atrasado · era pra ${fmtData(iso)}`,
      className: 'text-hubRed font-semibold',
    };
  }
  if (dias === 0) {
    return { label: 'Hoje', className: 'text-[var(--cal-aprovacao)] font-semibold' };
  }
  if (dias === 1) {
    return { label: 'Amanhã', className: 'text-[var(--cal-aprovacao)]' };
  }
  if (dias <= 7) {
    return { label: `em ${dias} dias`, className: 'text-t2' };
  }
  return { label: fmtData(iso), className: 'text-t2' };
}

export function TaskItemCard({
  tarefa,
  categoria,
}: {
  tarefa: TarefaPendente;
  categoria: CategoriaTarefa;
}) {
  const href = hrefDaCategoria(categoria, tarefa);
  const prazo = statusPrazo(tarefa.tarefaPrazo);

  return (
    <Link
      href={href}
      className="card group flex items-center gap-4 p-4 transition hover:shadow-[0_4px_20px_rgba(21,21,33,0.06)] hover:border-[rgba(21,21,33,0.16)]"
    >
      <div className="flex w-14 shrink-0 flex-col items-center justify-center text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mauve">
          {fmtDiaMes(tarefa.postData).mes}
        </div>
        <div className="mt-0.5 text-[24px] font-semibold leading-none tracking-[-0.03em] text-ink">
          {fmtDiaMes(tarefa.postData).dia}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          {FORMATO_LABEL[tarefa.formatoTipo]}
        </div>
        <div className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {tarefa.postTitulo}
        </div>
      </div>

      <div className="hidden text-right text-[12px] sm:block">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">Prazo</div>
        <div className={`mt-0.5 ${prazo.className}`}>{prazo.label}</div>
      </div>

      <span className="shrink-0 text-t3 transition group-hover:text-navy">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </Link>
  );
}
