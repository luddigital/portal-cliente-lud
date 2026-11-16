import Link from 'next/link';
import { rotas } from '@/lib/rotas';
import { Card, Kpis, Ponto, Tag, type St } from '../_ui/lud';
import type { QuadroEntrega } from './quadro';

/**
 * O geral das entregas (proposta escolhida "KPIs e agenda da semana"):
 * 4 números no topo e a lista do que vence em cada dia desta semana.
 * Usado em /admin/entregas e no topo de cada entrega.
 */

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const soma = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
const segunda = (iso: string) => soma(iso, -((new Date(utc(iso)).getUTCDay() + 6) % 7));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function GeralEntregas({ quadros, hoje, atual }: { quadros: QuadroEntrega[]; hoje: string; atual?: string }) {
  const linhas = (i: 0 | 1 | 2) => quadros.flatMap((q) => q.colunas[i].linhas);
  const comCol = (i: 0 | 1 | 2) => quadros.filter((q) => q.colunas[i].linhas.length > 0).length;
  const atr = linhas(0);
  const atu = linhas(1);
  const hojeLinhas = atu.filter((l) => l.prazoMaisAntigo === hoje);
  const hojePosts = hojeLinhas.reduce((s, l) => s + (l.posts.length || 0), 0);

  const ini = segunda(hoje);
  const fim = soma(ini, 6);
  const agenda = quadros
    .filter((q) => q.dataAtual && q.dataAtual >= ini && q.dataAtual <= fim)
    .sort((a, b) => a.dataAtual!.localeCompare(b.dataAtual!) || a.nome.localeCompare(b.nome, 'pt-BR'));

  // Clientes contam uma vez só, mesmo aparecendo em várias entregas.
  const unicos = (ls: { projetoId: string; handle: string }[]) => new Set(ls.map((l) => l.projetoId || l.handle)).size;
  const nAtrClientes = unicos(atr);
  // Entregas cuja rodada é hoje e ainda têm algo em aberto.
  const entregasHoje = quadros.filter((q) => /semanal|mensal/i.test(q.frequencia ?? '') && q.dataAtual === hoje && q.colunas[1].linhas.length > 0);
  const atuTarefas = atu.reduce((s, l) => s + l.nTarefas, 0);
  // A próxima rodada depois de hoje (semanais e mensais), com algo em aberto.
  const proxima = quadros
    .filter((q) => q.dataAtual && q.dataAtual > hoje && q.colunas[1].linhas.length > 0)
    .sort((a, b) => a.dataAtual!.localeCompare(b.dataAtual!))[0];

  // Linha do tempo: só semanais e mensais (as de todo dia venceriam sempre hoje).
  const dias = Array.from({ length: 7 }, (_, i) => soma(ini, i));
  const linhaDoTempo = agenda.filter((q) => /semanal|mensal/i.test(q.frequencia ?? ''));

  const situacao = (q: QuadroEntrega): { texto: string; st: St } => {
    const nA = q.colunas[0].linhas.length;
    const nB = q.colunas[1].linhas.length;
    if (nA) return { texto: plural(nA, 'cliente atrasado', 'clientes atrasados'), st: 'atr' };
    if (nB) return { texto: nB === 1 ? 'falta 1 cliente' : `faltam ${nB} clientes`, st: q.dataAtual === hoje ? 'hoje' : 'cheg' };
    return { texto: 'em dia', st: 'ok' };
  };

  return (
    <>
      <Kpis
        itens={[
          {
            rotulo: 'Atrasado',
            valor: plural(nAtrClientes, 'cliente', 'clientes'),
            sub: nAtrClientes ? `em ${plural(comCol(0), 'entrega', 'entregas')}` : 'nada atrasado',
            st: nAtrClientes ? 'atr' : undefined,
          },
          entregasHoje.length
            ? {
                rotulo: 'Vence hoje',
                valor: plural(entregasHoje.length, 'entrega', 'entregas'),
                sub: `${entregasHoje.slice(0, 2).map((q) => q.nome).join(entregasHoje.length === 2 ? ' e ' : ', ')}${
                  entregasHoje.length > 2 ? ` e mais ${entregasHoje.length - 2}` : ''
                }${hojePosts ? ` · ${plural(hojePosts, 'post', 'posts')}` : ''}`,
                st: 'hoje',
              }
            : { rotulo: 'Vence hoje', valor: 'nada', sub: 'nenhuma entrega vence hoje' },
          {
            rotulo: 'Em aberto nesta rodada',
            valor: plural(atuTarefas, 'tarefa', 'tarefas'),
            sub: `de ${plural(unicos(atu), 'cliente', 'clientes')}`,
          },
          proxima
            ? {
                rotulo: 'Próxima entrega',
                valor: proxima.nome,
                sub: `${SEMANA[new Date(utc(proxima.dataAtual!)).getUTCDay()]}, ${proxima.dataAtual!.slice(8, 10)}/${proxima.dataAtual!.slice(5, 7)} · ${plural(proxima.colunas[1].linhas.length, 'cliente', 'clientes')}`,
                st: 'cheg',
                href: rotas.entrega(proxima.id),
              }
            : { rotulo: 'Próxima entrega', valor: 'nada', sub: 'nenhuma rodada nos próximos dias' },
        ]}
      />
      <Card pad="p-5" className="!gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2.5">
          <span className="flex items-baseline gap-2.5">
            <b className="text-[16px] font-extrabold">Linha do tempo da semana</b>
            <span className="text-[12.5px] text-[#636369]">cada entrega no dia da rodada, com a situação</span>
          </span>
          <span className="flex flex-wrap gap-3 text-[12px] text-[#46464B]">
            {(
              [
                ['atr', 'atrasada'],
                ['hoje', 'vence hoje'],
                ['cheg', 'chegando'],
                ['ok', 'feita'],
              ] as const
            ).map(([st, t]) => (
              <span key={st} className="flex items-center gap-1.5">
                <Ponto st={st} />
                {t}
              </span>
            ))}
          </span>
        </div>
        <div className="overflow-x-auto min-h-fit">
          <div className="grid min-w-[760px] grid-cols-7 gap-1">
            {dias.map((d) => {
              const eHoje = d === hoje;
              const doDia = linhaDoTempo.filter((q) => q.dataAtual === d);
              return (
                <div key={d} className={`flex min-w-0 flex-col gap-2 rounded-[14px] px-1 pb-2 ${eHoje ? 'bg-[#FDF1F6]' : ''}`}>
                  <span className={`pt-2 text-center text-[12px] font-extrabold ${eHoje ? 'text-[#7A1F4C]' : 'text-[#46464B]'}`}>
                    {SEMANA[new Date(utc(d)).getUTCDay()].toUpperCase()} <span className="font-semibold">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
                    {eHoje ? ' · hoje' : ''}
                  </span>
                  <span className="relative flex h-4 items-center justify-center">
                    <span className="absolute inset-x-[-4px] top-1/2 h-[2px] bg-[#E9E9EB]" />
                    <span
                      className={`relative rounded-full border-2 border-white ${eHoje ? 'h-3.5 w-3.5 bg-[#C2417E]' : doDia.length ? 'h-2.5 w-2.5 bg-[#7462D6]' : 'h-2.5 w-2.5 bg-[#D6D6D9]'}`}
                    />
                  </span>
                  {doDia.length === 0 ? (
                    <span className="pt-1 text-center text-[11.5px] text-[#B4B4B9]">sem entrega</span>
                  ) : (
                    doDia.map((q) => {
                      const s = situacao(q);
                      return (
                        <Link
                          key={q.id}
                          href={rotas.entrega(q.id)}
                          className={`flex flex-col gap-1.5 rounded-[12px] border bg-white px-2.5 py-2 hover:border-[#B4B4B9] ${atual && q.id === atual ? 'border-[#111113]' : 'border-[#E9E9EB]'}`}
                        >
                          <span className="flex items-start gap-1.5">
                            <span className="mt-[5px]">
                              <Ponto st={s.st} />
                            </span>
                            <b className="text-[12.5px] leading-tight">{q.nome}</b>
                          </span>
                          <span className="text-[10.5px] text-[#8A8A90]">{(q.frequencia ?? '').toLowerCase()}</span>
                          <Tag st={s.st} className="!min-w-0 !text-[10.5px]">
                            {s.texto}
                          </Tag>
                        </Link>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </>
  );
}
