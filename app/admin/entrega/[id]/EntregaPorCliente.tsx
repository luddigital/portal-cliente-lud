'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreviaPostModal } from '../../aprovacoes/PreviaPostModal';
import {
  ModalMensagem,
  type GrupoWpp,
  type ItemPendenciaUi,
} from '@/app/admin/projetos/[id]/PendenciasCliente';
import { grupoDaTarefa } from '@/lib/pendencias-cliente';
import { montarMensagemRegua } from '@/lib/regua-mensagens';
import { ChipData } from '@/app/_components/ChipData';

export type TipoEntrega = 'envio' | 'cliente' | 'interna';

export type ItemEntrega = {
  tarefaId: string;
  titulo: string;
  prazo: string | null;
  pronto: boolean;
  postId: string | null;
  postTitulo: string;
  /** Onde o post está em relação a essa entrega. */
  relacao: 'aqui' | 'antes' | 'depois' | 'concluido';
  rotulo: string;
  comCliente: boolean;
  atualTitulo: string | null;
  atualPrazo: string | null;
  responsavel: string | null;
  /** Tarefa "Aprovação | Post" do post (link da mensagem pro cliente). */
  aprovacaoTarefaId: string | null;
  prazoCliente: string | null;
  visto: { ultima: string; total: number } | null;
  /** Já feito nessa entrega (enviado ao cliente, no caso do envio de quinta). */
  enviado: boolean;
  enviadoEm: string | null;
};

export type GrupoEntrega = {
  projetoId: string;
  nome: string;
  projetoNome: string;
  gruposWpp: GrupoWpp[];
  itens: ItemEntrega[];
};

function ddmm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function diasEntre(deIso: string, ateIso: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(ateIso) - t(deIso)) / 86_400_000);
}

/** Segunda-feira da semana da data (chave da aba). Sem data → 'sem-data'. */
function semanaDe(iso: string | null): string {
  if (!iso) return 'sem-data';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

function rotuloSemana(chave: string, atual: string): { titulo: string; datas: string } {
  if (chave === 'sem-data') return { titulo: 'Sem data', datas: '' };
  const datas = `${ddmm(chave)} a ${ddmm(somarDiasIso(chave, 6))}`;
  const dif = Math.round(diasEntre(atual, chave) / 7);
  const titulo =
    dif === 0 ? 'Esta semana' : dif === 1 ? 'Próxima semana' : dif === -1 ? 'Semana passada' : datas;
  return { titulo, datas: dif >= -1 && dif <= 1 ? datas : '' };
}

/** Cor semântica do design system (mesmas do calendário) pelo que está acontecendo com o post. */
function corDoStatus(item: ItemEntrega, tipo: TipoEntrega): { bg: string; fg: string } {
  const par = (nome: string) => ({ bg: `var(--${nome}-soft)`, fg: `var(--${nome})` });
  if (item.relacao === 'aqui' && tipo === 'envio') return par('prazo-em-dia');
  if (item.relacao === 'concluido') return par('cal-publicado');
  const t = (item.atualTitulo ?? '').toLowerCase();
  if (/altera/.test(t)) return par('cal-alteracao');
  if (/enviar post/.test(t)) return par('prazo-em-dia');
  if (/programar/.test(t)) return par('cal-programar');
  if (/conferir/.test(t)) return par('cal-conferir');
  if (/aprova/.test(t)) return par('cal-aprovacao');
  if (item.comCliente) return par('cal-aguardando');
  return par('cal-agendado');
}

function ChipStatus({ item, tipo }: { item: ItemEntrega; tipo: TipoEntrega }) {
  const cor = corDoStatus(item, tipo);
  const texto = item.relacao === 'aqui' && tipo === 'envio' ? 'Pronto pra enviar' : item.rotulo;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: cor.bg, color: cor.fg }}
      title={item.atualTitulo ?? undefined}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {texto}
    </span>
  );
}

type Ordem = 'az' | 'za' | 'atrasados' | 'prazo' | 'prontos' | 'posts';
type Filtros = {
  ordem: Ordem;
  situacao: 'todas' | 'prontas' | 'nao';
  clientes: string[];
  soAtrasados: boolean;
};
const FILTROS_PADRAO: Filtros = { ordem: 'az', situacao: 'todas', clientes: [], soAtrasados: false };
const CHAVE_FILTROS = 'entrega-filtros';

const ORDENS: { id: Ordem; rotulo: string; curto: string }[] = [
  { id: 'az', rotulo: 'Projeto A → Z', curto: 'Projeto A → Z' },
  { id: 'za', rotulo: 'Projeto Z → A', curto: 'Projeto Z → A' },
  { id: 'atrasados', rotulo: 'Mais atrasados primeiro', curto: 'Mais atrasados' },
  { id: 'prazo', rotulo: 'Prazo mais próximo', curto: 'Prazo mais próximo' },
  { id: 'prontos', rotulo: 'Prontos primeiro', curto: 'Prontos primeiro' },
  { id: 'posts', rotulo: 'Mais posts primeiro', curto: 'Mais posts' },
];

function contarAtrasados(g: GrupoEntrega, hoje: string): number {
  return g.itens.filter((i) => i.prazo && diasEntre(hoje, i.prazo) < 0).length;
}

function aplicarFiltros(grupos: GrupoEntrega[], f: Filtros, hoje: string): GrupoEntrega[] {
  const menorPrazo = (g: GrupoEntrega) =>
    g.itens.map((i) => i.prazo).filter((x): x is string => !!x).sort()[0] ?? '9999';
  return grupos
    .filter((g) => (f.situacao === 'todas' ? true : f.situacao === 'prontas' ? clientePronto(g.itens) : !clientePronto(g.itens)))
    .filter((g) => f.clientes.length === 0 || f.clientes.includes(g.projetoId || g.nome))
    .filter((g) => !f.soAtrasados || contarAtrasados(g, hoje) > 0)
    .sort((a, b) => {
      const nome = a.nome.localeCompare(b.nome, 'pt-BR');
      switch (f.ordem) {
        case 'za':
          return -nome;
        case 'atrasados':
          return contarAtrasados(b, hoje) - contarAtrasados(a, hoje) || menorPrazo(a).localeCompare(menorPrazo(b)) || nome;
        case 'prazo':
          return menorPrazo(a).localeCompare(menorPrazo(b)) || nome;
        case 'prontos':
          return Number(clientePronto(b.itens)) - Number(clientePronto(a.itens)) || nome;
        case 'posts':
          return b.itens.length - a.itens.length || nome;
        default:
          return nome;
      }
    });
}

const CHIP_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition';
const CHIP_ATIVO = 'border-transparent bg-[var(--cal-agendado-soft)] font-semibold text-[var(--cal-agendado)]';
const CHIP_INATIVO = 'border-[rgba(21,21,33,0.1)] bg-white text-t2 hover:bg-bgSoft hover:text-ink';

function Seta() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Pop({ children, fechar, largura = 'w-60' }: { children: React.ReactNode; fechar: () => void; largura?: string }) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={fechar} />
      <div className={`absolute left-0 top-full z-30 mt-1.5 ${largura} rounded-xl border border-[rgba(21,21,33,0.1)] bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]`}>
        {children}
      </div>
    </>
  );
}

function OpcaoMenu({
  ativa,
  onClick,
  children,
  extra,
  marcador = 'radio',
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
  extra?: React.ReactNode;
  marcador?: 'radio' | 'check';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition hover:bg-bgSoft ${
        ativa ? 'font-semibold text-ink' : 'text-t2'
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] ${
          marcador === 'radio' ? 'rounded-full' : 'rounded-[4px]'
        } ${ativa ? 'border-ink bg-ink text-white' : 'border-[rgba(21,21,33,0.25)] text-transparent'}`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {extra}
    </button>
  );
}

/** Barra de filtros e ordenação no estilo Notion: chips que abrem menus. */
function BarraFiltros({
  filtros,
  mudar,
  menu,
  setMenu,
  tipo,
  grupos,
  hojeIso,
}: {
  filtros: Filtros;
  mudar: (p: Partial<Filtros>) => void;
  menu: 'ordem' | 'situacao' | 'clientes' | null;
  setMenu: (m: 'ordem' | 'situacao' | 'clientes' | null) => void;
  tipo: TipoEntrega;
  grupos: GrupoEntrega[];
  hojeIso: string;
}) {
  const nProntos = grupos.filter((g) => clientePronto(g.itens)).length;
  const situacoes = [
    { id: 'todas' as const, rotulo: 'Todas', n: grupos.length },
    { id: 'prontas' as const, rotulo: tipo === 'envio' ? 'Prontas pra enviar' : 'Prontas', n: nProntos },
    { id: 'nao' as const, rotulo: 'Não prontas', n: grupos.length - nProntos },
  ];
  const situacaoAtual = situacoes.find((x) => x.id === filtros.situacao)!;
  const ordemAtual = ORDENS.find((o) => o.id === filtros.ordem) ?? ORDENS[0];
  const temFiltro = filtros.situacao !== 'todas' || filtros.clientes.length > 0 || filtros.soAtrasados;
  const nomesClientes = grupos.filter((g) => filtros.clientes.includes(g.projetoId || g.nome)).map((g) => g.nome);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ordenação */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu(menu === 'ordem' ? null : 'ordem')}
          className={`${CHIP_BASE} ${filtros.ordem !== 'az' ? CHIP_ATIVO : CHIP_INATIVO}`}
          title="Ordenar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
          </svg>
          {ordemAtual.curto}
          <Seta />
        </button>
        {menu === 'ordem' && (
          <Pop fechar={() => setMenu(null)}>
            <div className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3">Ordenar por</div>
            {ORDENS.map((o) => (
              <OpcaoMenu
                key={o.id}
                ativa={filtros.ordem === o.id}
                onClick={() => {
                  mudar({ ordem: o.id });
                  setMenu(null);
                }}
              >
                {o.rotulo}
              </OpcaoMenu>
            ))}
          </Pop>
        )}
      </div>

      <span className="mx-1 h-5 w-px bg-[rgba(21,21,33,0.12)]" />

      {/* situação */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu(menu === 'situacao' ? null : 'situacao')}
          className={`${CHIP_BASE} ${filtros.situacao !== 'todas' ? CHIP_ATIVO : CHIP_INATIVO}`}
        >
          Situação: {situacaoAtual.rotulo}
          <Seta />
        </button>
        {menu === 'situacao' && (
          <Pop fechar={() => setMenu(null)}>
            {situacoes.map((x) => (
              <OpcaoMenu
                key={x.id}
                ativa={filtros.situacao === x.id}
                onClick={() => {
                  mudar({ situacao: x.id });
                  setMenu(null);
                }}
                extra={<span className="text-[11px] text-t3">{x.n}</span>}
              >
                {x.rotulo}
              </OpcaoMenu>
            ))}
          </Pop>
        )}
      </div>

      {/* clientes */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu(menu === 'clientes' ? null : 'clientes')}
          className={`${CHIP_BASE} ${filtros.clientes.length > 0 ? CHIP_ATIVO : CHIP_INATIVO}`}
        >
          Cliente
          {filtros.clientes.length > 0 &&
            `: ${nomesClientes.length === 1 ? nomesClientes[0] : `${filtros.clientes.length} selecionados`}`}
          <Seta />
        </button>
        {menu === 'clientes' && (
          <Pop fechar={() => setMenu(null)} largura="w-72">
            <div className="max-h-[280px] overflow-y-auto">
              {grupos.map((g) => {
                const id = g.projetoId || g.nome;
                const ativa = filtros.clientes.includes(id);
                return (
                  <OpcaoMenu
                    key={id}
                    marcador="check"
                    ativa={ativa}
                    onClick={() =>
                      mudar({
                        clientes: ativa ? filtros.clientes.filter((c) => c !== id) : [...filtros.clientes, id],
                      })
                    }
                    extra={<span className="text-[11px] text-t3">{g.itens.length}</span>}
                  >
                    {g.nome}
                  </OpcaoMenu>
                );
              })}
            </div>
            {filtros.clientes.length > 0 && (
              <button
                type="button"
                onClick={() => mudar({ clientes: [] })}
                className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-t3 underline hover:text-ink"
              >
                Limpar seleção
              </button>
            )}
          </Pop>
        )}
      </div>

      {/* só com atraso */}
      <button
        type="button"
        onClick={() => mudar({ soAtrasados: !filtros.soAtrasados })}
        className={`${CHIP_BASE} ${filtros.soAtrasados ? CHIP_ATIVO : CHIP_INATIVO}`}
      >
        {filtros.soAtrasados && <span aria-hidden>✓</span>}
        Só com atraso
        <span className="text-[11px] opacity-70">{grupos.filter((g) => contarAtrasados(g, hojeIso) > 0).length}</span>
      </button>

      {temFiltro && (
        <button
          type="button"
          onClick={() => mudar({ situacao: 'todas', clientes: [], soAtrasados: false })}
          className="px-2 text-[12px] text-t3 underline transition hover:text-ink"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

/** Cliente pronto: todos os posts pendentes da semana já estão nessa etapa. */
function clientePronto(itens: ItemEntrega[]): boolean {
  const pendentes = itens.filter((i) => !i.enviado);
  return pendentes.length > 0 && pendentes.every((i) => i.relacao === 'aqui');
}

function PilulaVisto({ visto }: { visto: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
        visto ? 'bg-[var(--cal-conferir-soft)] text-[var(--cal-conferir)]' : 'bg-bgSoft text-t3'
      }`}
    >
      {visto ? '👁 visto' : 'não visto'}
    </span>
  );
}

/** Responsável (inicial) + prazo da etapa atual, vermelho se atrasado. */
function MetaAtual({ item, hoje }: { item: ItemEntrega; hoje: string }) {
  if (!item.atualPrazo && !item.responsavel) return null;
  const atrasada = item.atualPrazo ? diasEntre(hoje, item.atualPrazo) < 0 : false;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
      {item.responsavel && (
        <span
          title={item.responsavel}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E9E9E7] text-[9.5px] font-semibold text-ink"
        >
          {item.responsavel.trim()[0]?.toUpperCase()}
        </span>
      )}
      {item.atualPrazo && (
        <span className={atrasada ? 'font-semibold text-[var(--prazo-atrasado)]' : 'text-t3'}>
          {atrasada ? `atrasada · ${ddmm(item.atualPrazo)}` : `até ${ddmm(item.atualPrazo)}`}
        </span>
      )}
    </span>
  );
}

/**
 * Página de entrega: um card por cliente, com o status real de cada post e,
 * conforme a entrega, o botão de envio pro grupo do cliente.
 */
export function EntregaPorCliente({
  entregaNome,
  tipo,
  grupos,
  textos,
  baseUrl,
  hojeIso,
}: {
  entregaNome: string;
  tipo: TipoEntrega;
  grupos: GrupoEntrega[];
  textos: Record<string, string>;
  baseUrl: string;
  hojeIso: string;
}) {
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string } | null>(null);
  const [envio, setEnvio] = useState<GrupoEntrega | null>(null);
  const [mensagem, setMensagem] = useState<GrupoEntrega | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);
  const [menu, setMenu] = useState<'ordem' | 'situacao' | 'clientes' | null>(null);
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_FILTROS) ?? 'null');
      if (salvo && typeof salvo === 'object') setFiltros({ ...FILTROS_PADRAO, ...salvo, clientes: [] });
    } catch {
      /* sem storage: padrão */
    }
  }, []);
  useEffect(() => {
    try {
      const { clientes: _c, ...resto } = filtros;
      localStorage.setItem(CHAVE_FILTROS, JSON.stringify(resto));
    } catch {
      /* sem storage */
    }
  }, [filtros]);
  const mudar = (parcial: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...parcial }));

  // Uma aba por semana de envio (pela data da tarefa da entrega).
  const semanaAtual = semanaDe(hojeIso);
  // Semanas que já passaram entram em "Esta semana": o atrasado é prioridade dela.
  const abaDe = (prazo: string | null) => {
    const k = semanaDe(prazo);
    return k !== 'sem-data' && k < semanaAtual ? semanaAtual : k;
  };
  // Enviados ficam na semana do envio; envios de semanas passadas saem de cena.
  const abaDoItem = (i: ItemEntrega): string | null => {
    if (!i.enviado) return abaDe(i.prazo);
    const k = semanaDe(i.enviadoEm ?? i.prazo);
    return k !== 'sem-data' && k < semanaAtual ? null : k;
  };
  const semanas = useMemo(() => {
    const set = new Set<string>();
    for (const g of grupos)
      for (const i of g.itens) {
        const k = abaDoItem(i);
        if (k) set.add(k);
      }
    return [...set].sort();
  }, [grupos]);
  const [semana, setSemana] = useState<string>(() =>
    semanas.includes(semanaAtual)
      ? semanaAtual
      : semanas.find((k) => k !== 'sem-data' && k > semanaAtual) ?? semanas[semanas.length - 1] ?? '',
  );
  const daSemana = (filtro: (i: ItemEntrega) => boolean) =>
    grupos
      .map((g) => ({ ...g, itens: g.itens.filter((i) => abaDoItem(i) === semana && filtro(i)) }))
      .filter((g) => g.itens.length > 0);
  const gruposDaSemana = daSemana((i) => !i.enviado);
  const enviadosDaSemana = daSemana((i) => i.enviado);
  const contar = (k: string) => {
    let total = 0;
    let atrasados = 0;
    for (const g of grupos)
      for (const i of g.itens) {
        if (i.enviado || abaDoItem(i) !== k) continue;
        total++;
        if (i.prazo && diasEntre(hojeIso, i.prazo) < 0) atrasados++;
      }
    return { total, atrasados };
  };
  const itensSemana = gruposDaSemana.flatMap((g) => g.itens);
  const nProntos = itensSemana.filter((i) => i.relacao === 'aqui').length;
  const nAtrasados = itensSemana.filter((i) => i.prazo && diasEntre(hojeIso, i.prazo) < 0).length;
  const nEnviados = enviadosDaSemana.reduce((n, g) => n + g.itens.length, 0);
  const rotuloFeitos = tipo === 'envio' ? 'Enviados' : 'Concluídos';

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 8000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <div className="space-y-4">
      {aviso && (
        <div role="status" className="rounded-xl bg-bgSoft px-4 py-2.5 text-[12.5px] text-ink">
          {aviso}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-[rgba(21,21,33,0.08)]">
        {semanas.map((k) => {
          const r = rotuloSemana(k, semanaAtual);
          const c = contar(k);
          const ativa = k === semana;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSemana(k)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-left transition ${
                ativa ? 'border-ink' : 'border-transparent hover:border-[rgba(21,21,33,0.2)]'
              }`}
            >
              <div className={`flex items-center gap-1.5 text-[13px] ${ativa ? 'font-semibold text-ink' : 'text-t2'}`}>
                {r.titulo}
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    c.atrasados > 0 ? 'bg-[var(--prazo-atrasado)] text-white' : 'bg-bgSoft text-t2'
                  }`}
                >
                  {c.total}
                </span>
              </div>
              {r.datas && <div className="text-[11px] text-t3">{r.datas}</div>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-t2">
        <span>
          <b className="text-ink">{itensSemana.length}</b> posts
        </span>
        <span>
          <b className="text-[var(--prazo-em-dia)]">{nProntos}</b>{' '}
          {tipo === 'envio' ? 'prontos pra enviar' : 'nessa etapa'}
        </span>
        {nAtrasados > 0 && (
          <span>
            <b className="text-[var(--prazo-atrasado)]">{nAtrasados}</b> atrasados
          </span>
        )}
        {nEnviados > 0 && (
          <span>
            <b className="text-ink">{nEnviados}</b> {rotuloFeitos.toLowerCase()}
          </span>
        )}
      </div>

      {gruposDaSemana.length > 0 && (
        <BarraFiltros
          filtros={filtros}
          mudar={mudar}
          menu={menu}
          setMenu={setMenu}
          tipo={tipo}
          grupos={gruposDaSemana}
          hojeIso={hojeIso}
        />
      )}

      {gruposDaSemana.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.12)] px-4 py-6 text-center text-[12.5px] text-t3">
          {nEnviados > 0 ? `Tudo dessa semana já foi ${tipo === 'envio' ? 'enviado' : 'concluído'} ✨` : 'Nada nessa semana.'}
        </p>
      )}

      {aplicarFiltros(gruposDaSemana, filtros, hojeIso).length === 0 && gruposDaSemana.length > 0 && (
        <p className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.12)] px-4 py-6 text-center text-[12.5px] text-t3">
          Nenhum cliente com esses filtros.{' '}
          <button type="button" onClick={() => setFiltros({ ...FILTROS_PADRAO, ordem: filtros.ordem })} className="font-semibold underline hover:text-ink">
            Limpar filtros
          </button>
        </p>
      )}

      {aplicarFiltros(gruposDaSemana, filtros, hojeIso).map((g) => {
        const prontos = g.itens.filter((i) => i.relacao === 'aqui');
        const travados = g.itens.filter((i) => i.relacao === 'antes');
        const atrasados = g.itens.filter((i) => i.prazo && diasEntre(hojeIso, i.prazo) < 0).length;
        const temCliente = g.itens.some((i) => i.comCliente);
        return (
          <section
            key={g.projetoId || g.nome}
            className={`overflow-hidden rounded-2xl border bg-white ${
              atrasados > 0 ? 'border-[rgba(110,42,44,0.25)]' : 'border-[rgba(21,21,33,0.08)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(21,21,33,0.06)] px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{g.nome}</h2>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-t3">
                  {g.projetoNome && g.projetoNome !== g.nome && <span>{g.projetoNome}</span>}
                  <span>
                    {prontos.length} de {g.itens.length}{' '}
                    {tipo === 'envio' ? 'prontos pra enviar' : 'nessa etapa'}
                  </span>
                  {travados.length > 0 && <span>· {travados.length} ainda não chegaram aqui</span>}
                  {atrasados > 0 && (
                    <span className="font-semibold text-[var(--prazo-atrasado)]">· {atrasados} atrasados</span>
                  )}
                  {g.gruposWpp.length === 0 && <span>· sem grupo do WhatsApp</span>}
                </div>
              </div>
              {tipo === 'envio' && clientePronto(g.itens) && (
                // Só aparece com TODOS os posts do cliente prontos (o lote não sai pela metade).
                <button type="button" onClick={() => setEnvio(g)} className="btn-enviar">
                  📱 Enviar para aprovação ({prontos.length})
                </button>
              )}
              {tipo === 'cliente' && prontos.some((i) => i.postId) && (
                <button
                  type="button"
                  onClick={() => setMensagem(g)}
                  className="btn-enviar"
                >
                  📱 Mensagem da entrega{prontos.length > 0 ? ` (${prontos.length})` : ''}
                </button>
              )}
            </div>
            <ul className="divide-y divide-[rgba(21,21,33,0.05)]">
              {g.itens.map((i) => (
                <li key={i.tarefaId}>
                  <button
                    type="button"
                    onClick={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.aprovacaoTarefaId ?? i.tarefaId })}
                    disabled={!i.postId}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-left transition hover:bg-bgSoft/60 disabled:cursor-default"
                  >
                    <ChipData prazo={i.prazo} hoje={hojeIso} className="w-[66px]" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{i.postTitulo}</span>
                    {/* colunas fixas: a tag de status fica sempre alinhada na direita */}
                    <span className="hidden w-[132px] shrink-0 justify-end sm:flex">
                      {i.relacao !== 'aqui' && <MetaAtual item={i} hoje={hojeIso} />}
                    </span>
                    {temCliente && (
                      <span className="hidden w-[68px] shrink-0 justify-end sm:flex">
                        {i.comCliente && <PilulaVisto visto={!!i.visto} />}
                      </span>
                    )}
                    <span className="flex w-full justify-end sm:w-[210px] sm:shrink-0">
                      <ChipStatus item={i} tipo={tipo} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {enviadosDaSemana.length > 0 && (
        <section className="space-y-2 pt-4">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
              {rotuloFeitos}
              <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[11px] font-semibold text-t2">{nEnviados}</span>
            </h2>
            <p className="mt-0.5 text-[12px] text-t3">
              {tipo === 'envio'
                ? 'Já foram pro cliente nessa semana. A última coluna mostra onde cada post está agora.'
                : 'Já passaram dessa etapa nessa semana.'}
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
            <div className="hidden items-center gap-3 border-b border-[rgba(21,21,33,0.08)] px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3 sm:flex">
              <span className="min-w-0 flex-1">Post</span>
              <span className="w-[72px] shrink-0">{tipo === 'envio' ? 'Enviado' : 'Feito'}</span>
              <span className="w-[84px] shrink-0">Cliente viu</span>
              <span className="w-[210px] shrink-0 text-right">Onde está agora</span>
            </div>
            {enviadosDaSemana.map((g) => {
              const vistos = g.itens.filter((i) => i.visto).length;
              return (
                <div key={g.projetoId || g.nome}>
                  <div className="flex items-baseline justify-between gap-2 bg-[rgba(55,53,47,0.03)] px-5 py-1.5">
                    <span className="truncate text-[12px] font-semibold text-ink">{g.nome}</span>
                    <span className="shrink-0 text-[11px] text-t3">
                      {g.itens.length} {g.itens.length === 1 ? 'post' : 'posts'}
                      {g.itens.some((i) => i.comCliente) && ` · ${vistos} ${vistos === 1 ? 'visto' : 'vistos'}`}
                    </span>
                  </div>
                  <ul className="divide-y divide-[rgba(21,21,33,0.05)]">
                    {g.itens.map((i) => (
                      <li key={i.tarefaId}>
                        <button
                          type="button"
                          onClick={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.aprovacaoTarefaId ?? i.tarefaId })}
                          disabled={!i.postId}
                          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-left transition hover:bg-bgSoft/60 disabled:cursor-default"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{i.postTitulo}</span>
                          <span className="w-[72px] shrink-0 font-mono text-[11.5px] text-t2">
                            {i.enviadoEm ? `${i.enviadoEm.slice(8, 10)}/${i.enviadoEm.slice(5, 7)}` : '—'}
                          </span>
                          <span className="w-[84px] shrink-0">
                            {i.comCliente ? <PilulaVisto visto={!!i.visto} /> : <span className="text-[11px] text-t3">—</span>}
                          </span>
                          <span className="flex w-full justify-end sm:w-[210px] sm:shrink-0">
                            <ChipStatus item={i} tipo={tipo} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {previa && (
        <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />
      )}

      {envio && (
        <ModalEnvioAprovacao
          grupo={envio}
          textos={textos}
          baseUrl={baseUrl}
          hojeIso={hojeIso}
          fechar={() => setEnvio(null)}
          aoEnviar={(msg) => {
            setEnvio(null);
            setAviso(msg);
          }}
        />
      )}

      {mensagem && (
        <ModalMensagem
          projetoId={mensagem.projetoId}
          clienteNome={mensagem.nome}
          gruposWpp={mensagem.gruposWpp}
          titulo={entregaNome}
          itens={mensagem.itens
            .filter((i) => i.relacao === 'aqui' && i.postId)
            .map(
              (i): ItemPendenciaUi => ({
                tarefaId: i.tarefaId,
                tarefaTitulo: i.titulo,
                postId: i.postId!,
                postTitulo: i.postTitulo,
                postData: null,
                prazo: i.prazo,
                link: `${baseUrl}/post/${i.postId}?tarefa=${i.tarefaId}`,
                grupo: grupoDaTarefa(i.titulo),
                visto: i.visto,
              }),
            )}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setMensagem(null)}
          aoEnviar={(nomeGrupo) => {
            setMensagem(null);
            setAviso(`Mensagem enviada no grupo ${nomeGrupo ?? mensagem.gruposWpp[0]?.nome ?? 'do cliente'}.`);
          }}
        />
      )}
    </div>
  );
}

/** Envio de quinta: lote com os posts prontos do cliente (texto do envio da Régua). */
function ModalEnvioAprovacao({
  grupo,
  textos,
  baseUrl,
  hojeIso,
  fechar,
  aoEnviar,
}: {
  grupo: GrupoEntrega;
  textos: Record<string, string>;
  baseUrl: string;
  hojeIso: string;
  fechar: () => void;
  aoEnviar: (mensagem: string) => void;
}) {
  const router = useRouter();
  const prontos = grupo.itens.filter((i) => i.relacao === 'aqui' && i.postId);
  const travados = grupo.itens.filter((i) => i.relacao === 'antes');
  const [sel, setSel] = useState<Set<string>>(() => new Set(prontos.map((i) => i.tarefaId)));
  const [grupoId, setGrupoId] = useState<string | null>(grupo.gruposWpp[0]?.id ?? null);
  const [liberado, setLiberado] = useState(travados.length === 0);
  const [manual, setManual] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupoAtual = grupo.gruposWpp.find((g) => g.id === grupoId) ?? null;
  const selecionados = prontos.filter((i) => sel.has(i.tarefaId));
  const prazoCliente =
    selecionados.map((i) => i.prazoCliente).filter((p): p is string => !!p).sort()[0] ?? null;

  const gerado = useMemo(
    () =>
      selecionados.length === 0
        ? ''
        : montarMensagemRegua({
            momento: 'quinta',
            variante: 'unica',
            apelido: grupoAtual?.apelido || grupo.nome,
            posts: selecionados.map((i) => ({
              titulo: i.postTitulo,
              link: `${baseUrl}/post/${i.postId}${i.aprovacaoTarefaId ? `?tarefa=${i.aprovacaoTarefaId}` : ''}`,
            })),
            prazo: prazoCliente,
            textos,
          }),
    [selecionados, grupoAtual, grupo.nome, baseUrl, prazoCliente, textos],
  );
  const [texto, setTexto] = useState(gerado);
  useEffect(() => {
    if (!manual) setTexto(gerado);
  }, [gerado, manual]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) fechar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fechar, enviando]);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const ciclo = selecionados.map((i) => i.prazo).filter((p): p is string => !!p).sort()[0] ?? hojeIso;
    try {
      const res = await fetch('/api/admin/regua/enviar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itens: [
            {
              projetoId: grupo.projetoId,
              ciclo,
              momento: 'quinta',
              variante: 'unica',
              texto,
              postIds: selecionados.map((i) => i.postId),
              tarefasEnvio: selecionados.map((i) => i.tarefaId),
              grupoId,
            },
          ],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      const r = (j.resultados ?? [])[0];
      if (!r?.ok) throw new Error(r?.erro ?? 'Não consegui enviar.');
      router.refresh();
      aoEnviar(
        `Enviado no grupo ${grupoAtual?.nome ?? ''}: ${selecionados.length} ${
          selecionados.length === 1 ? 'post' : 'posts'
        } pra aprovação.${r.erro ? ` ${r.erro}` : ''}`,
      );
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao enviar.');
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => !enviando && fechar()}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(21,21,33,0.08)] px-5 py-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3">Enviar para aprovação</div>
            <h3 className="mt-0.5 truncate text-[15px] font-semibold text-ink">{grupo.nome}</h3>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] text-t3 hover:bg-bgSoft hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {grupo.gruposWpp.length === 0 ? (
            <div className="rounded-lg border border-ink px-3 py-2 text-[12px] text-ink">
              Esse projeto não tem grupo do WhatsApp vinculado.{' '}
              <a href="/admin/whatsapp" className="font-semibold underline">
                Vincular grupo
              </a>
            </div>
          ) : grupo.gruposWpp.length > 1 ? (
            <label className="flex flex-wrap items-center gap-2 rounded-lg bg-bgSoft px-3 py-2 text-[12px] text-t2">
              Vai pro grupo
              <select
                value={grupoId ?? ''}
                onChange={(e) => {
                  setGrupoId(e.target.value);
                  setManual(false);
                }}
                className="rounded-md border border-[rgba(21,21,33,0.12)] bg-white px-2 py-1 text-[12px] font-semibold text-ink"
              >
                {grupo.gruposWpp.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nome}
                    {w.apelido ? ` (${w.apelido})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-lg bg-bgSoft px-3 py-2 text-[12px] text-t2">
              Vai pro grupo <span className="font-semibold text-ink">{grupoAtual?.nome}</span>. Nunca no privado.
            </div>
          )}

          {travados.length > 0 && (
            <div className="rounded-lg border border-[rgba(110,42,44,0.3)] bg-[var(--prazo-atrasado-soft)] px-3 py-2.5 text-[12px] text-[var(--prazo-atrasado)]">
              <div className="font-semibold">
                {travados.length} {travados.length === 1 ? 'post ainda não está pronto' : 'posts ainda não estão prontos'}. O
                combinado é segurar o lote até todos ficarem prontos.
              </div>
              <ul className="mt-1 space-y-0.5">
                {travados.map((i) => (
                  <li key={i.tarefaId}>
                    • {i.postTitulo} <span className="opacity-80">({i.rotulo.toLowerCase()})</span>
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={liberado}
                  onChange={(e) => setLiberado(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#37352F]"
                />
                Enviar mesmo assim só os prontos
              </label>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3">Posts no envio</div>
            <ul className="space-y-0.5">
              {prontos.map((i) => (
                <li key={i.tarefaId}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-bgSoft">
                    <input
                      type="checkbox"
                      checked={sel.has(i.tarefaId)}
                      onChange={() =>
                        setSel((s) => {
                          const n = new Set(s);
                          if (n.has(i.tarefaId)) n.delete(i.tarefaId);
                          else n.add(i.tarefaId);
                          return n;
                        })
                      }
                      disabled={enviando}
                      className="h-3.5 w-3.5 accent-[#37352F]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{i.postTitulo}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-t3">Mensagem</div>
              {manual && texto !== gerado && (
                <button type="button" onClick={() => setManual(false)} className="text-[11px] text-t3 underline hover:text-ink">
                  voltar ao texto padrão
                </button>
              )}
            </div>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setManual(true);
              }}
              rows={14}
              disabled={enviando}
              className="w-full resize-y rounded-lg border border-[rgba(21,21,33,0.12)] bg-white px-3 py-2 text-[13px] leading-[1.55] text-ink outline-none focus:border-[rgba(21,21,33,0.35)]"
            />
            <p className="mt-1 text-[11px] text-t3">
              Ao enviar, a tarefa "Enviar Post Aprovação" desses posts é concluída no Notion.
            </p>
          </div>

          {erro && <p className="rounded-lg border border-ink px-3 py-2 text-[12px] font-semibold text-ink">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[rgba(21,21,33,0.08)] px-5 py-3">
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            className="rounded-full px-4 py-2 text-[12px] font-semibold text-t2 hover:bg-bgSoft hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={
              enviando || !grupoAtual || !liberado || selecionados.length === 0 || !texto.trim()
            }
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-30"
          >
            {enviando ? 'Enviando…' : `Enviar no grupo (${selecionados.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
