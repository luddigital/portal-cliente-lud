import type { PostCalendario } from '@/lib/notion';
import { COLUNAS_ENTREGA, postParaEtapaEntrega, saudePrazo } from '@/lib/entregas';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export type CalendarioMes = { year: number; month: number; posts: PostCalendario[] };

const ORDEM = COLUNAS_ENTREGA.map((c) => c.id);

/**
 * Status de cada entrega (linhas) em cada calendário em andamento (colunas).
 * Um post "passou" de uma entrega quando já está numa etapa seguinte.
 */
export function CalendariosStatus({
  calendarios,
  hojeIso,
}: {
  calendarios: CalendarioMes[];
  hojeIso: string;
}) {
  const cols = calendarios.map((c) => {
    const itens = c.posts.map((p) => ({
      idx: ORDEM.indexOf(postParaEtapaEntrega(p)),
      atrasado: saudePrazo(p, hojeIso).estado === 'atrasado',
    }));
    return {
      ...c,
      itens,
      publicados: itens.filter((i) => ORDEM[i.idx] === 'publicado').length,
      atrasados: itens.filter((i) => i.atrasado).length,
    };
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#37352F]">
          Calendários em andamento ({calendarios.length})
        </h2>
        <p className="mt-0.5 text-[12px] text-[#787774]">
          Onde cada calendário está em cada entrega. Conta como em andamento enquanto tiver post
          sem publicar.
        </p>
      </div>

      {calendarios.length === 0 ? (
        <p className="rounded-md border border-[rgba(0,0,0,0.09)] bg-white px-4 py-3 text-[12px] text-[#787774]">
          Nenhum calendário em andamento.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[rgba(0,0,0,0.09)] bg-white">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.09)]">
                <th className="w-[170px] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#787774]">
                  Entrega
                </th>
                {cols.map((c) => (
                  <th key={`${c.year}-${c.month}`} className="px-4 py-2.5 align-bottom">
                    <div className="text-[13px] font-semibold text-[#37352F]">
                      {MESES[c.month - 1]}
                      {c.year !== Number(hojeIso.slice(0, 4)) ? ` ${c.year}` : ''}
                    </div>
                    <div className="mt-0.5 text-[11px] font-normal text-[#787774]">
                      {c.itens.length} posts · {c.publicados} publicados
                      {c.atrasados > 0 && (
                        <span className="font-semibold text-[#37352F]"> · {c.atrasados} atrasados</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.06)]">
              {COLUNAS_ENTREGA.map((etapa, linha) => (
                <tr key={etapa.id}>
                  <td className="px-4 py-2.5 text-[13px] text-[#37352F]">{etapa.label}</td>
                  {cols.map((c) => (
                    <td key={`${c.year}-${c.month}`} className="px-4 py-2.5">
                      <Celula itens={c.itens} linha={linha} ultima={etapa.id === 'publicado'} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Celula({
  itens,
  linha,
  ultima,
}: {
  itens: { idx: number; atrasado: boolean }[];
  linha: number;
  ultima: boolean;
}) {
  const total = itens.length;
  if (total === 0) return <span className="text-[11px] text-[rgba(55,53,47,0.45)]">—</span>;
  const feitos = itens.filter((i) => (ultima ? i.idx === linha : i.idx > linha)).length;
  const aqui = ultima ? [] : itens.filter((i) => i.idx === linha);
  const atrasadosAqui = aqui.filter((i) => i.atrasado).length;
  const pct = Math.round((feitos / total) * 100);

  let texto: React.ReactNode;
  if (feitos === total) texto = <span className="font-medium text-[#37352F]">✓ concluída</span>;
  else if (aqui.length > 0)
    texto = (
      <>
        <span className="font-medium text-[#37352F]">
          {aqui.length} nessa etapa
        </span>
        {atrasadosAqui > 0 && (
          <span className="ml-1 rounded bg-[#37352F] px-1 py-[1px] text-[10px] font-medium text-white">
            {atrasadosAqui} atrasado{atrasadosAqui > 1 ? 's' : ''}
          </span>
        )}
      </>
    );
  else texto = <span className="text-[#787774]">{feitos === 0 ? 'a fazer' : `${feitos}/${total}`}</span>;

  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="min-w-0">{texto}</span>
        <span className="shrink-0 font-mono text-[10px] text-[#787774]">
          {feitos}/{total}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#F4F4F2]">
        <div className="h-full rounded-full bg-[#37352F]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
