'use client';

import { useMemo } from 'react';
import { BarraFiltros, Divisor, MenuFiltro, MenuOrdenar, PilulasPeriodo, ordenarPor, useGuardado, type Ordem } from '../_ui/BarraFiltros';

/** Uma linha da lista "Hoje, em atraso e próximos 7 dias", com o que os filtros precisam. */
export type MetaEntrega = {
  id: string;
  grupo: 'atr' | 'hoje' | 'prox';
  data: string;
  nome: string;
  clientes: string[];
  etapaIdx: number;
};

/**
 * Barra de filtros da página Entregas. A lista é montada no servidor; aqui só escondemos e
 * reordenamos as linhas (data-linha-entrega / data-grupo-entregas) com uma regra de CSS.
 */
export function FiltrosEntregas({ metas }: { metas: MetaEntrega[] }) {
  const [periodo, setPeriodo] = useGuardado('entregas-periodo', 'tudo');
  const [cliente, setCliente] = useGuardado<string | null>('entregas-cliente', null);
  const [etapa, setEtapa] = useGuardado<string | null>('entregas-etapa', null);
  const [ordem, setOrdem] = useGuardado<Ordem>('entregas-ordem', 'data');

  const passa = (m: MetaEntrega) => (!cliente || m.clientes.includes(cliente)) && (!etapa || m.nome === etapa);

  const css = useMemo(() => {
    const regras: string[] = ['[data-grupo-entregas]>:not([data-linha-entrega]){order:-1}'];
    for (const g of ['atr', 'hoje', 'prox'] as const) if (periodo !== 'tudo' && periodo !== g) regras.push(`[data-grupo-entregas="${g}"]{display:none}`);
    const escondidas = metas.filter((m) => !passa(m));
    if (escondidas.length) regras.push(`${escondidas.map((m) => `[data-linha-entrega="${m.id}"]`).join(',')}{display:none}`);
    ordenarPor(metas, ordem, (m) => ({ data: m.data, status: m.etapaIdx })).forEach((m, i) => regras.push(`[data-linha-entrega="${m.id}"]{order:${i}}`));
    return regras.join('\n');
  }, [metas, periodo, cliente, etapa, ordem]); // eslint-disable-line react-hooks/exhaustive-deps

  const contar = (f: (m: MetaEntrega) => string[]) => {
    const c = new Map<string, number>();
    for (const m of metas) for (const v of f(m)) c.set(v, (c.get(v) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, rot: v, n }));
  };
  const n = (g: string) => metas.filter((m) => (g === 'tudo' || m.grupo === g) && passa(m)).length;

  return (
    <>
      <style>{css}</style>
      <BarraFiltros
        esquerda={
          <>
            <PilulasPeriodo
              valor={periodo}
              set={setPeriodo}
              opcoes={[
                { v: 'tudo', rot: 'Tudo', n: n('tudo') },
                { v: 'atr', rot: 'Em atraso', n: n('atr'), cor: '#B42318' },
                { v: 'hoje', rot: 'Hoje', n: n('hoje'), cor: '#C2417E' },
                { v: 'prox', rot: 'Próximos 7 dias', n: n('prox'), cor: '#7462D6' },
              ]}
            />
            <Divisor />
            <MenuFiltro rot="Cliente" valor={cliente} set={setCliente} opcoes={contar((m) => m.clientes)} />
            <MenuFiltro rot="Etapa" valor={etapa} set={setEtapa} opcoes={contar((m) => [m.nome])} todos="Todas" />
          </>
        }
        direita={<MenuOrdenar opcoes={['data', 'data-desc', 'status']} valor={ordem} set={setOrdem} />}
      />
    </>
  );
}
