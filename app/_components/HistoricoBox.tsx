'use client';

export type ComentarioItem = {
  id: string;
  texto: string;
  criadoEm: string;
};

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} · ${hh}:${min}`;
}

/**
 * Histórico de comentários do post — discreto, recolhido por padrão.
 * Usado na página de post e nos painéis de post do admin.
 */
export function HistoricoBox({ comentarios }: { comentarios: ComentarioItem[] }) {
  if (!comentarios || comentarios.length === 0) return null;
  return (
    <details className="rounded-xl border border-[rgba(21,21,33,0.08)] bg-bgSoft">
      <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-t3 transition hover:text-ink">
        Histórico de comentários ({comentarios.length})
      </summary>
      <ul className="space-y-3 border-t border-[rgba(21,21,33,0.06)] px-4 py-3">
        {comentarios.map((c) => (
          <li
            key={c.id}
            className="border-l-2 border-[rgba(21,21,33,0.1)] pl-3"
          >
            <div className="text-[10px] text-t3">{fmtDataHora(c.criadoEm)}</div>
            <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-[1.5] text-t2">
              {c.texto}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
