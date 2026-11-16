/** "O mês da Lud.": as 9 etapas do ciclo mensal com o dia de hoje marcado.
 *  Usado na página Processo e no Dashboard. */
import { Card, Ponto, ST, TituloCard, hojeSP, type St } from './lud';

export const ETAPAS: { n: number; nome: string; quando: string; ini: number; fim: number; desc: string }[] = [
  { n: 1, nome: 'Fechamento da análise de dados', quando: 'dias 1 a 3', ini: 1, fim: 3, desc: 'O social media monta a apresentação com os números do mês pra reunião interna.' },
  { n: 2, nome: 'Reunião interna de metas', quando: 'dia 4', ini: 4, fim: 4, desc: 'Com a análise na mão, alinhamos as metas do próximo ciclo de conteúdo.' },
  { n: 3, nome: 'Entrega do calendário', quando: 'até o dia 5', ini: 3, fim: 5, desc: 'Temas do mês, sempre 2 meses à frente (em setembro sai o de novembro).' },
  { n: 4, nome: 'Reunião com o cliente', quando: 'por volta do dia 15', ini: 13, fim: 17, desc: 'Apresentamos os dados do mês e aprovamos o calendário com o cliente.' },
  { n: 5, nome: 'Briefing e copy', quando: 'até o dia 28', ini: 18, fim: 28, desc: 'Roteiros, referências, copy, legendas e instruções pra equipe criativa.' },
  { n: 6, nome: 'Curadoria de materiais', quando: 'contínuo', ini: 20, fim: 31, desc: 'Escolhemos os melhores materiais do cliente e conferimos a qualidade.' },
  { n: 7, nome: 'Arte', quando: 'contínuo', ini: 1, fim: 31, desc: 'O design produz as peças, que passam pela revisão da Lud. antes do cliente.' },
  { n: 8, nome: 'Programação e publicação', quando: 'contínuo', ini: 1, fim: 31, desc: 'Depois da aprovação, os posts são programados conforme o calendário.' },
  { n: 9, nome: 'Análise de resultados', quando: 'fim do mês', ini: 26, fim: 31, desc: 'Acompanhamos a performance e fechamos o ciclo com aprendizados.' },
];

export function estadoEtapa(e: (typeof ETAPAS)[number], dia: number): { st: St; texto: string } {
  return dia > e.fim ? { st: 'neu', texto: 'feito' } : dia >= e.ini ? { st: 'cheg', texto: 'em andamento' } : { st: 'info', texto: 'próximo' };
}

export type NumeroMes = { rotulo: string; valor: string | number; sub?: string };

/** Mês anterior em análise, atual no ar, próximo em produção, o seguinte em planejamento. */
function mesesDoCiclo(y: number, m: number) {
  const nome = (k: number) => {
    const t = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1 + k, 15)));
    return t[0].toUpperCase() + t.slice(1);
  };
  return [
    [nome(-1), 'em análise'],
    [nome(0), 'no ar'],
    [nome(1), 'em produção'],
    [nome(2), 'em planejamento'],
  ];
}

export function MesDaLud({ numeros = [] }: { numeros?: NumeroMes[] }) {
  const hoje = hojeSP();
  const dia = Number(hoje.slice(8));
  const [y, m] = hoje.split('-').map(Number);
  const diasNoMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mesNome = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
  const estado = (e: (typeof ETAPAS)[number]) => estadoEtapa(e, dia);
  return (
      <Card>
        <TituloCard
          titulo={`O mês da Lud. · ${mesNome}`}
          sub={`hoje é dia ${dia}`}
          acao={
            <span className="hidden flex-wrap justify-end gap-1.5 md:flex">
              {mesesDoCiclo(y, m).map(([n, e], k) => (
                <span key={n} className={`rounded-full px-2.5 py-1 text-[11.5px] ${k === 1 ? 'bg-[#111113] text-white' : 'bg-[#F4F4F5] text-[#46464B]'}`}>
                  <b>{n}</b> {e}
                </span>
              ))}
            </span>
          }
        />
        {numeros.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {numeros.map((n) => (
              <span key={n.rotulo} className="flex flex-col gap-0.5 rounded-[14px] border border-[#E9E9EB] px-3 py-2.5">
                <span className="text-[11.5px] text-[#636369]">{n.rotulo}</span>
                <b className="text-[22px] leading-tight tabular-nums">{n.valor}</b>
                {n.sub && <span className="text-[11.5px] text-[#636369]">{n.sub}</span>}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3.5 text-[12.5px] font-bold">
          {(
            [
              ['neu', 'feito'],
              ['cheg', 'em andamento'],
              ['info', 'próximo'],
            ] as [St, string][]
          ).map(([st, t]) => (
            <span key={t} className="flex items-center gap-1.5" style={{ color: ST[st][1] }}>
              <Ponto st={st} />
              {t}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto min-h-fit">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-3 pb-1">
              <span />
              <div className="relative grid text-[10.5px] text-[#8A8A90]" style={{ gridTemplateColumns: `repeat(${diasNoMes}, minmax(0,1fr))` }}>
                {Array.from({ length: diasNoMes }, (_, i) => (
                  <span key={i} className={`text-center ${i + 1 === dia ? 'font-extrabold text-[#111113]' : ''}`}>
                    {(i + 1) % 5 === 0 || i === 0 || i + 1 === dia ? i + 1 : ''}
                  </span>
                ))}
              </div>
            </div>
            {ETAPAS.map((e) => {
              const s = estado(e);
              const fim = Math.min(e.fim, diasNoMes);
              return (
                <div key={e.n} className="grid grid-cols-[220px_minmax(0,1fr)] items-center gap-3 border-t border-[#F4F4F5] py-2">
                  <span className="flex items-center gap-2 text-[13px] font-bold">
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold" style={{ background: ST[s.st][0], color: ST[s.st][1] }}>
                      {s.texto === 'feito' ? '✓' : e.n}
                    </span>
                    <span className="truncate">{e.nome}</span>
                  </span>
                  <div className="relative h-6 rounded-[6px] bg-[#FAFAFA]">
                    <span
                      className="absolute inset-y-1 rounded-[5px]"
                      style={{
                        left: `${((e.ini - 1) / diasNoMes) * 100}%`,
                        width: `${((fim - e.ini + 1) / diasNoMes) * 100}%`,
                        background: s.st === 'neu' ? '#E9E9EB' : ST[s.st][2],
                      }}
                    />
                    <span className="absolute inset-y-0 w-[2px] bg-[#111113]" style={{ left: `${((dia - 0.5) / diasNoMes) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
  );
}
