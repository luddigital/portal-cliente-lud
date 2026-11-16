'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LinhaProjeto } from '@/lib/visao-geral';

// Filtro de serviço lembrado entre visitas (o mesmo da lista antiga).
const STORAGE_KEY = 'admin:projetos:servico';

const ORDEM: Record<string, number> = {
  Instagram: 1, TikTok: 2, Stories: 3, 'Tráfego Pago': 4, Site: 5, 'Landing Page': 6,
  'E-book': 7, Mentoria: 8, Consultoria: 9, Grupos: 10, 'Identidade visual': 11, Interno: 90, Outros: 99,
};

const COR_NIVEL: Record<LinhaProjeto['nivel'], string> = {
  atrasado: 'var(--prazo-atrasado)',
  hoje: 'var(--prazo-hoje)',
  chegando: 'var(--prazo-chegando)',
  'em-dia': 'var(--prazo-em-dia)',
  sem: 'var(--prazo-tranquilo)',
};

const COLUNAS =
  'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,1.8fr)]';

/**
 * Lista de projetos do dashboard: quem precisa de você primeiro e como está
 * o mês de cada um (layout aprovado em "Projetos (sugestão)").
 */
export function TabelaProjetos({ linhas, mesNome }: { linhas: LinhaProjeto[]; mesNome: string }) {
  const [filtro, setFiltro] = useState<string>('todos');

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo && (salvo === 'todos' || salvo === 'atencao' || linhas.some((l) => l.servico === salvo))) setFiltro(salvo);
    } catch {
      /* sem localStorage: fica em "todos" */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function escolher(f: string) {
    setFiltro(f);
    try {
      localStorage.setItem(STORAGE_KEY, f);
    } catch {
      /* ignora */
    }
  }

  const contagem = new Map<string, number>();
  for (const l of linhas) contagem.set(l.servico, (contagem.get(l.servico) ?? 0) + 1);
  const servicos = [...contagem.keys()].sort((a, b) => (ORDEM[a] ?? 50) - (ORDEM[b] ?? 50) || a.localeCompare(b, 'pt-BR'));

  const visiveis = linhas.filter((l) => (filtro === 'todos' ? true : filtro === 'atencao' ? l.precisa : l.servico === filtro));
  const ordenar = (a: LinhaProjeto, b: LinhaProjeto) =>
    b.atrasadas - a.atrasadas || (a.acaoPrazo ?? '9999').localeCompare(b.acaoPrazo ?? '9999');
  const grupos = [
    { titulo: 'Precisa de você', itens: visiveis.filter((l) => l.precisa).sort(ordenar) },
    { titulo: 'Em dia', itens: visiveis.filter((l) => !l.precisa).sort(ordenar) },
  ].filter((g) => g.itens.length > 0);

  const comAtraso = linhas.filter((l) => l.atrasadas > 0);
  const esperandoCliente = linhas.filter((l) => l.comCliente > 0);
  const noAr = linhas.reduce((s, l) => s + l.postsNoAr, 0);
  const totalPosts = linhas.reduce((s, l) => s + l.postsMes, 0);
  const nomes = (ls: LinhaProjeto[]) =>
    ls.length === 0 ? 'nenhum' : ls.slice(0, 3).map((l) => l.rotulo).join(', ') + (ls.length > 3 ? ` e mais ${ls.length - 3}` : '');

  const resumo = [
    { rotulo: 'Projetos ativos', n: String(linhas.length), quem: `${contagem.get('Instagram') ?? 0} de Instagram`, cor: '#313D65' },
    { rotulo: 'Com atraso', n: String(comAtraso.length), quem: nomes(comAtraso), cor: 'var(--prazo-atrasado)' },
    { rotulo: 'Esperando o cliente', n: String(esperandoCliente.length), quem: nomes(esperandoCliente), cor: 'var(--prazo-hoje)' },
    { rotulo: `Posts no ar em ${mesNome}`, n: `${noAr} de ${totalPosts}`, quem: 'todos os projetos', cor: 'var(--prazo-em-dia)' },
  ];

  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12.5px] transition ${
      ativo ? 'border-[#313D65] bg-[#313D65] font-semibold text-white' : 'border-[rgba(21,21,33,0.12)] bg-white text-ink hover:bg-bgSoft'
    }`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">Projetos</h2>
        <p className="text-[13px] text-t2">Qual projeto precisa de você primeiro, e como está o mês de cada um.</p>
      </div>

      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        {resumo.map((r) => (
          <div key={r.rotulo} className="flex flex-col gap-1 rounded-xl border border-[rgba(21,21,33,0.07)] bg-white px-4 py-3.5">
            <span className="flex items-center gap-1.5 text-[12px] text-t2">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: r.cor }} />
              {r.rotulo}
            </span>
            <span className="text-[26px] font-bold tracking-[-0.02em] text-ink">{r.n}</span>
            <span className="truncate text-[12px] text-t3" title={r.quem}>
              {r.quem}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => escolher('todos')} className={chip(filtro === 'todos')}>
          Todos · {linhas.length}
        </button>
        <button type="button" onClick={() => escolher('atencao')} className={chip(filtro === 'atencao')}>
          Precisa de atenção · {linhas.filter((l) => l.precisa).length}
        </button>
        {servicos.map((s) => (
          <button key={s} type="button" onClick={() => escolher(s)} className={chip(filtro === s)}>
            {s} · {contagem.get(s)}
          </button>
        ))}
      </div>

      {grupos.length === 0 && <p className="text-[13px] text-t2">Nenhum projeto nesse filtro.</p>}

      {grupos.map((g) => (
        <section key={g.titulo} className="space-y-2">
          <h3 className="text-[13px] font-semibold text-t2">
            {g.titulo} <span className="font-normal text-t3">· {g.itens.length}</span>
          </h3>
          <div className="overflow-hidden rounded-[14px] border border-[rgba(21,21,33,0.07)] bg-white">
            <div className={`hidden gap-4 border-b border-[rgba(21,21,33,0.06)] px-[18px] py-2.5 text-[10.5px] font-semibold tracking-[0.06em] text-t3 md:grid ${COLUNAS}`}>
              <span>PROJETO</span>
              <span>POSTS DO MÊS</span>
              <span>ATRASADAS</span>
              <span>COM O CLIENTE</span>
              <span>PRÓXIMA AÇÃO</span>
            </div>
            {g.itens.map((l) => {
              const pct = l.postsMes ? Math.round((l.postsNoAr / l.postsMes) * 100) : 0;
              const corChip = COR_NIVEL[l.nivel];
              return (
                <Link
                  key={l.projetoId}
                  href={`/admin/projetos/${l.projetoId}`}
                  className={`grid items-center gap-4 border-b border-[rgba(21,21,33,0.05)] px-[18px] py-3 transition last:border-b-0 hover:bg-[#FAFAFB] ${COLUNAS}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {l.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.foto} alt="" className="h-[34px] w-[34px] shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#F2F2F4] text-[12px] font-semibold text-t2">
                        {l.rotulo.replace('@', '').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="truncate text-[14px] font-semibold text-ink">{l.rotulo}</div>
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded-full bg-[#F2F2F4] px-[7px] py-px text-[10.5px] text-t2">{l.clienteNome || 'sem cliente'}</span>
                        <span className="rounded-full bg-[#F2F2F4] px-[7px] py-px text-[10.5px] text-t2">{l.servico}</span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden flex-col gap-1.5 md:flex">
                    {l.postsMes ? (
                      <>
                        <span className="text-[12px]">
                          <b className="font-semibold text-ink">{l.postsNoAr}</b> <span className="text-t3">de {l.postsMes} no ar</span>
                        </span>
                        <span className="block h-[5px] overflow-hidden rounded-full bg-[#EDEDEF]">
                          <span className="block h-[5px] rounded-full bg-[#313D65]" style={{ width: `${pct}%` }} />
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-t3">—</span>
                    )}
                  </div>
                  <span
                    className="hidden text-[15px] font-bold md:block"
                    style={{ color: l.atrasadas > 0 ? 'var(--prazo-atrasado)' : '#A1A1A6' }}
                  >
                    {l.atrasadas}
                  </span>
                  <span className="hidden text-[13px] text-t2 md:block">
                    {l.comCliente > 0 ? `${l.comCliente} ${l.comCliente === 1 ? 'tarefa' : 'tarefas'}` : '—'}
                  </span>
                  <div className="flex min-w-0 items-center justify-between gap-2.5">
                    <span className="hidden truncate text-[13px] font-medium text-ink md:block" title={l.acao ?? ''}>
                      {l.acao ?? 'Nada aberto no Notion'}
                    </span>
                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        borderColor: l.nivel === 'atrasado' ? 'var(--prazo-atrasado-soft)' : 'rgba(21,21,33,0.1)',
                        color: l.nivel === 'atrasado' ? 'var(--prazo-atrasado)' : '#151521',
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: corChip }} />
                      {l.chip}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
