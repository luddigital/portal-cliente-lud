import Link from 'next/link';
import { FASES, type Celula, type Fase } from '@/lib/macroCalendarios';

/**
 * Visão macro dos calendários: este mês e os dois próximos, por cliente.
 * Em cima, o resumo de cada mês e "Onde agir"; embaixo, a grade cliente × mês.
 */

export type LinhaMacro = { projetoId: string; handle: string; foto: string | null; celulas: Record<string, Celula> };

const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (m: string) => NOME_MES[Number(m.slice(5, 7)) - 1];
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const SIT: Record<Celula['situacao'], { rot: string; bg: string; fg: string }> = {
  vazio: { rot: 'Não iniciado', bg: '#F0F0F1', fg: '#636369' },
  atrasado: { rot: 'Atrasado', bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)' },
  em_dia: { rot: 'No ritmo', bg: '#E4EBDF', fg: '#2E5520' },
  pronto: { rot: 'Tudo agendado', bg: '#D8EDCF', fg: '#2E5520' },
};

export function MacroCalendarios({ meses, linhas, hoje }: { meses: string[]; linhas: LinhaMacro[]; hoje: string }) {
  // Resumo de cada mês.
  const resumo = meses.map((m) => {
    const cs = linhas.map((l) => l.celulas[m]);
    const total = cs.reduce((s, c) => s + c.total, 0);
    const porFase = Object.fromEntries(FASES.map((f) => [f.id, cs.reduce((s, c) => s + c.porFase[f.id], 0)])) as Record<Fase, number>;
    return {
      m,
      total,
      porFase,
      atrasados: cs.reduce((s, c) => s + c.atrasados, 0),
      vazios: linhas.filter((l) => l.celulas[m].situacao === 'vazio'),
      atrasadosClientes: linhas.filter((l) => l.celulas[m].situacao === 'atrasado'),
    };
  });

  // Onde agir: tudo que está atrasado ou sem calendário, do prazo mais antigo pro mais novo.
  const acoes = linhas
    .flatMap((l) =>
      meses
        .filter((m) => ['atrasado', 'vazio'].includes(l.celulas[m].situacao))
        .map((m) => ({ l, m, c: l.celulas[m] })),
    )
    .sort((a, b) => (a.c.proxima?.ate ?? '9999').localeCompare(b.c.proxima?.ate ?? '9999'));

  return (
    <div className="flex flex-col gap-6">
      {/* Resumo por mês */}
      <div className="grid gap-3 md:grid-cols-3">
        {resumo.map((r) => (
          <section key={r.m} className="flex min-h-fit flex-col gap-3 rounded-[18px] border border-[#E9E9EB] bg-white p-5">
            <div className="flex items-baseline justify-between">
              <b className="text-[18px] capitalize">{nomeMes(r.m)}</b>
              <span className="text-[12.5px] text-[#636369]">{r.total} posts</span>
            </div>
            <Barra porFase={r.porFase} total={r.total} alto />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[#636369]">
              {FASES.filter((f) => r.porFase[f.id]).map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1">
                  <i className="inline-block h-2 w-2 rounded-full" style={{ background: f.cor }} />
                  {f.nome} {r.porFase[f.id]}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.atrasados > 0 && (
                <span className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ background: SIT.atrasado.bg, color: SIT.atrasado.fg }}>
                  ⚠️ {r.atrasados} posts atrasados · {r.atrasadosClientes.length} clientes
                </span>
              )}
              {r.vazios.length > 0 && (
                <span className="rounded-full bg-[#F0F0F1] px-2.5 py-[3px] text-[11.5px] font-bold text-[#46464B]">⭘ {r.vazios.length} sem calendário</span>
              )}
              {!r.atrasados && !r.vazios.length && r.total > 0 && (
                <span className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ background: SIT.em_dia.bg, color: SIT.em_dia.fg }}>
                  ✓ tudo no ritmo
                </span>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Onde agir */}
      {acoes.length > 0 && (
        <section className="flex flex-col gap-2">
          <b className="text-[16px]">🎯 Onde agir</b>
          <ul className="overflow-hidden rounded-[14px] border border-[#EDEDEF] bg-white">
            {acoes.slice(0, 12).map(({ l, m, c }) => (
              <li key={l.projetoId + m} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#F2F2F4] px-4 py-2.5 last:border-0">
                <Avatar handle={l.handle} foto={l.foto} />
                <b className="text-[13.5px]">{l.handle}</b>
                <span className="text-[12.5px] capitalize text-[#8A8A90]">{nomeMes(m)}</span>
                <span className="text-[13px] text-[#2C2C30]">{c.proxima?.texto}</span>
                {c.atrasados > 0 && <span className="text-[12px] font-bold text-[var(--prazo-atrasado)]">{c.atrasados} atrasados</span>}
                <span className="ml-auto flex items-center gap-3">
                  {c.proxima?.ate && (
                    <span className={`text-[12px] tabular-nums ${c.proxima.ate < hoje ? 'font-bold text-[var(--prazo-atrasado)]' : 'text-[#636369]'}`}>
                      {c.proxima.ate < hoje ? 'era até' : 'até'} {ddmm(c.proxima.ate)}
                    </span>
                  )}
                  <Link href={`/admin/conteudo/${l.projetoId}?mes=${m}`} className="rounded-full border border-[#D6D6D9] bg-white px-3 py-[3px] text-[12px] font-bold hover:bg-[#F4F4F5]">
                    Abrir →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          {acoes.length > 12 && <span className="text-[12px] text-[#8A8A90]">+ {acoes.length - 12} na grade abaixo</span>}
        </section>
      )}

      {/* Grade cliente × mês */}
      <section className="flex flex-col gap-2">
        <b className="text-[16px]">Por cliente</b>
        <div className="overflow-x-auto rounded-[14px] border border-[#EDEDEF] bg-white">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-[#EDEDEF]">
                <th className="w-[200px] px-4 py-2.5 text-left text-[12px] font-semibold text-[#8A8A90]">Cliente</th>
                {meses.map((m) => (
                  <th key={m} className="px-4 py-2.5 text-left text-[12px] font-semibold capitalize text-[#8A8A90]">
                    {nomeMes(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.projetoId} className="border-b border-[#F2F2F4] align-top last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/conteudo/${l.projetoId}`} className="flex items-center gap-2 hover:underline">
                      <Avatar handle={l.handle} foto={l.foto} />
                      <b className="text-[13.5px]">{l.handle}</b>
                    </Link>
                  </td>
                  {meses.map((m) => {
                    const c = l.celulas[m];
                    const s = SIT[c.situacao];
                    return (
                      <td key={m} className="px-4 py-3">
                        <Link href={`/admin/conteudo/${l.projetoId}?mes=${m}`} className="flex flex-col gap-1.5 rounded-[10px] p-1 -m-1 hover:bg-[#FAFAFA]">
                          <span className="flex items-center gap-2">
                            <span className="rounded-full px-2 py-[2px] text-[11px] font-bold" style={{ background: s.bg, color: s.fg }}>
                              {s.rot}
                              {c.atrasados ? ` · ${c.atrasados}` : ''}
                            </span>
                            {c.total > 0 && <span className="text-[12px] text-[#8A8A90]">{c.total} posts</span>}
                          </span>
                          {c.total > 0 && <Barra porFase={c.porFase} total={c.total} />}
                          {c.proxima && c.situacao !== 'pronto' && (
                            <span className="text-[12px] leading-[1.35] text-[#46464B]">
                              → {c.proxima.texto}
                              {c.proxima.ate && (
                                <span className={c.proxima.ate < hoje ? ' font-bold text-[var(--prazo-atrasado)]' : ' text-[#8A8A90]'}> · {ddmm(c.proxima.ate)}</span>
                              )}
                            </span>
                          )}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11.5px] text-[#8A8A90]">
          Atrasado = o post está numa fase anterior à que a régua pede pra hoje (pauta até dia 16 de dois meses antes, copy até o fim desse mês, materiais 3 semanas antes, arte 2 semanas antes, aprovação 1 semana antes).
        </p>
      </section>
    </div>
  );
}

function Barra({ porFase, total, alto = false }: { porFase: Record<Fase, number>; total: number; alto?: boolean }) {
  return (
    <span className={`flex w-full overflow-hidden rounded-full bg-[#F0F0F1] ${alto ? 'h-2.5' : 'h-1.5'}`}>
      {total > 0 &&
        FASES.map((f) =>
          porFase[f.id] ? <span key={f.id} title={`${f.nome}: ${porFase[f.id]}`} style={{ width: `${(porFase[f.id] / total) * 100}%`, background: f.cor }} /> : null,
        )}
    </span>
  );
}

function Avatar({ handle, foto }: { handle: string; foto: string | null }) {
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" className="h-6 w-6 shrink-0 rounded-full border border-[#E9E9EB] object-cover" />
  ) : (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111113] text-[10px] font-bold text-white">{handle.replace(/^@/, '')[0]?.toUpperCase()}</span>
  );
}
