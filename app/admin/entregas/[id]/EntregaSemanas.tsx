'use client';

import { avisarConcluida } from '@/app/_ui/DesfazerConcluir';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rotas, nomeCurtoDoProjeto } from '@/lib/rotas';
import { corDaEtapa } from '@/lib/corEtapa';
import { AvatarPessoa, AvatarProjeto, Cadeado, LegendaSinal, Sinal, type Bolinha } from '../../_ui/Avatares';
import { PreviaPostModal, prefetchPrevia } from '../../aprovacoes/PreviaPostModal';
import { BotaoLembreteWpp } from '../../aprovacoes/BotaoLembreteWpp';
import { ModalMensagem, type ItemPendenciaUi } from '@/app/admin/projetos/[id]/PendenciasCliente';
import { grupoDaTarefa } from '@/lib/pendencias-cliente';
import {
  ModalEnvioAprovacao,
  mensagensDe,
  quandoFoi,
  type GrupoEntrega,
  type ItemEntrega,
  type TipoEntrega,
} from '../../entrega/[id]/EntregaPorCliente';

/**
 * Página de uma entrega (todos os clientes), aberta na semana atual.
 * Abas Atrasados / Esta semana / próximas semanas, a DL de cada semana em
 * destaque (vermelha quando já passou), números da semana, posts por cliente
 * (quem tem algo pra fazer primeiro) e o que já foi feito no fim.
 */

const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const dias = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86_400_000);
const soma = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const curta = (iso: string) => `${DIA[new Date(utc(iso)).getUTCDay()]}, ${ddmm(iso)}`;
const segunda = (iso: string) => soma(iso, -((new Date(utc(iso)).getUTCDay() + 6) % 7));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

type Cor = { bg: string; fg: string };
type Visao = 'extra' | 'data' | 'cliente' | 'semanas';
const ATR: Cor = { bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)' };
const HOJE: Cor = { bg: 'var(--prazo-hoje-soft)', fg: 'var(--prazo-hoje)' };
const CHEG: Cor = { bg: '#E4DFFB', fg: '#3D3478' };
const OK: Cor = { bg: '#D8EDCF', fg: '#2E5520' };
const NEU: Cor = { bg: '#F4F4F5', fg: '#46464B' };

/** Alteração pedida pelo cliente e a reaprovação dela vivem nas entregas Alterações e Aprovações. */
// Reaprovação agora mora na própria página da aprovação: só a tarefa de alteração sai daqui.
const foiPraAlteracao = (i: ItemEntrega) => /^altera[çc][ãa]o\s*\|/i.test(i.titulo);
const feito = (i: ItemEntrega) => i.enviado || i.relacao === 'depois' || i.relacao === 'concluido' || (!ENTREGA_DE_ALTERACAO && foiPraAlteracao(i));
let ENTREGA_DE_ALTERACAO = false;
/** Entrega de materiais (do cliente pra produção): a comunicação é a cobrança dos materiais, não a aprovação do post. */
let ENTREGA_DE_MATERIAIS = false;
const aqui = (i: ItemEntrega) => !feito(i) && i.relacao === 'aqui';
const naLud = (i: ItemEntrega) => !feito(i) && i.relacao === 'antes';

function corDaData(iso: string, hoje: string): Cor {
  const d = dias(hoje, iso);
  return d < 0 ? ATR : d === 0 ? HOJE : CHEG;
}
function quando(iso: string, hoje: string): string {
  const d = dias(hoje, iso);
  if (d === 0) return 'vence hoje';
  if (d === -1) return 'venceu ontem';
  if (d < 0) return `venceu há ${-d} dias`;
  if (d === 1) return 'amanhã';
  return `em ${d} dias`;
}

function Chip({ texto, cor, grande = false }: { texto: string; cor: Cor; grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-extrabold ${grande ? 'px-3 py-1 text-[12.5px]' : 'px-2.5 py-[3px] text-[11.5px]'}`}
      style={{ background: cor.bg, color: cor.fg }}
    >
      {texto}
    </span>
  );
}

function Selo({ handle, href, foto }: { handle: string; href: string; foto?: string | null }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 hover:opacity-80">
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="h-[34px] w-[34px] rounded-full border border-[#E9E9EB] object-cover" />
      ) : (
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#111113] text-[13px] font-extrabold text-white">
          {handle.replace(/^@/, '')[0]?.toUpperCase()}
        </span>
      )}
      <b className="text-[14px]">{handle.startsWith('@') ? handle : `@${handle}`}</b>
    </Link>
  );
}

const BTN = 'inline-flex min-w-[136px] items-center justify-center whitespace-nowrap rounded-full border border-[#D6D6D9] bg-white px-3 py-[5px] text-[12px] font-extrabold hover:bg-[#F4F4F5]';
/** Que mensagem foi: o envio de quinta, o avulso, a reaprovação ou um lembrete. */
function rotuloMomento(m: string): string {
  if (m === 'quinta') return 'Envio de quinta';
  if (m === 'separado') return 'Envio avulso';
  if (m === 'reaprovacao') return 'Reaprovação';
  if (m.startsWith('auto_') || m.startsWith('envio_auto')) return 'Lembrete automático';
  if (['sexta', 'segunda_manha', 'segunda_tarde', 'terca'].includes(m)) return 'Lembrete';
  return 'Mensagem';
}
const diaSpIso = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

/** DL do post à esquerda do título: só a data, compacta, na cor do prazo. */
function SeloDL({ data, hojeIso }: { data: string; hojeIso: string }) {
  // Número branco: fundo um tom mais forte da mesma cor do prazo, pra ler bem.
  const d = dias(hojeIso, data);
  const c = { bg: d < 0 ? '#B42318' : d === 0 ? '#D9564F' : '#7462D6', fg: '#FFFFFF' };
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold"
      style={{ background: c.bg, color: c.fg }}
      title={`DL ${curta(data)} · ${quando(data, hojeIso)}`}
    >
      {ddmm(data)}
    </span>
  );
}

/** O que já mandamos no grupo sobre o post: visto, quantos lembretes e quando foi o último. */
function LinhaLembretes({ i, hojeIso }: { i: ItemEntrega; hojeIso: string }) {
  const msgs = [...(i.mensagens ?? [])].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
  const viu = i.visto ? `👁 viu ${ddmm(diaSpIso(i.visto.ultima))}` : null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-[11.5px]">
      {viu && <span className="font-bold text-[#46464B]">{viu}</span>}
      {!viu && <span className="text-[#A1A1A8]">não visto</span>}
      {msgs.length ? (
        <span className="font-bold text-[#46464B]" title={msgs.map((m) => quandoFoi(m.enviadoEm, hojeIso)).join(' · ')}>
          💬 {msgs.length === 1 ? 'lembrete' : `${msgs.length} lembretes`} · último {ddmm(diaSpIso(msgs[0].enviadoEm))}
        </span>
      ) : (
        <span className="font-bold text-[#B42318]">💬 nenhum lembrete</span>
      )}
    </span>
  );
}

/** O post está esperando o cliente (aprovação com ele). */
function comOCliente(i: ItemEntrega): boolean {
  // "Alteração pedida pelo cliente" fala de cliente mas está com a Lud.: não conta.
  if (/altera/i.test(i.rotulo)) return false;
  return i.comCliente || /cliente/i.test(i.rotulo);
}

type PassoTrilha = { icone: React.ReactNode; rotulo: string; data: string; st: 'ok' | 'atr' | 'off' };
const COR_PASSO = { ok: { bg: '#D8EDCF', fg: '#2E5520', linha: '#8FC07A' }, atr: { bg: '#FBE3E0', fg: '#B42318', linha: '#E8A39B' }, off: { bg: '#F4F4F5', fg: '#A1A1A8', linha: '#E3E3E6' } };

/** Nome curto da etapa, igual à tarefa do Notion sem a barra: "Aprovação Post", "Alteração Arte". */
function nomeDaTag(i: ItemEntrega): string {
  // Igual ao Notion ("Aprovação | Post"); reaprovação ganha o nome próprio.
  const base = (i.atualTitulo ?? '').replace(/\s+/g, ' ').trim();
  if (!base) return i.rotulo;
  if (i.reaprovacao && /^aprova[çc][ãa]o \| (post|arte)$/i.test(base)) return base.replace(/^aprova[çc][ãa]o/i, 'Reaprovação');
  return base;
}

/**
 * Trilha do post em bolinhas, com a data pequena embaixo. Com o cliente: cada mensagem no
 * grupo é um envio (📤), o visto (👁) entra na data dele, e o ✓ cinza é a aprovação que falta.
 * Com a equipe: quem está fazendo, o prazo dela (🚨 se atrasou) e o ✓ que falta.
 */
function StatusTrilha({ i, hojeIso, semTag = false, emLinha = false }: { i: ItemEntrega; hojeIso: string; semTag?: boolean; emLinha?: boolean }) {
  const tag = nomeDaTag(i);
  let passos: PassoTrilha[];
  if (comOCliente(i)) {
    const envios = [...(i.mensagens ?? [])].sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm));
    const ev: { quando: string; p: PassoTrilha }[] = envios.map((m, k) => ({
      quando: m.enviadoEm,
      p: { icone: '📤', rotulo: `${k + 1}º envio`, data: ddmm(diaSpIso(m.enviadoEm)), st: 'ok' },
    }));
    // "Visto" é do post (aprovação); na entrega de materiais não conta.
    if (i.visto && !ENTREGA_DE_MATERIAIS) ev.push({ quando: i.visto.ultima, p: { icone: '👁', rotulo: 'Visto', data: ddmm(diaSpIso(i.visto.ultima)), st: 'ok' } });
    ev.sort((a, b) => a.quando.localeCompare(b.quando));
    passos = ev.map((e) => e.p);
    if (!envios.length) passos.unshift({ icone: '📤', rotulo: ENTREGA_DE_MATERIAIS ? 'Ninguém cobrou os materiais no grupo ainda' : 'Nenhuma mensagem no grupo ainda', data: '—', st: 'atr' });
    if (ENTREGA_DE_MATERIAIS && i.prazo) {
      const atrasou = dias(hojeIso, i.prazo) < 0;
      passos.push({ icone: atrasou ? '🚨' : '⏳', rotulo: atrasou ? `Materiais atrasados desde ${ddmm(i.prazo)}` : `Materiais até ${ddmm(i.prazo)}`, data: ddmm(i.prazo), st: atrasou ? 'atr' : 'off' });
    }
  } else {
    passos = [];
    if (/altera/i.test(i.rotulo)) passos.push({ icone: '↺', rotulo: 'Alteração pedida', data: '', st: 'ok' });
    if (i.responsavel)
      passos.push({
        icone: <AvatarPequeno nome={i.responsavel} foto={i.responsavelAvatar ?? null} grande />,
        rotulo: `Com ${i.responsavel}`,
        data: i.responsavel.split(' ')[0],
        st: 'ok',
      });
    if (i.atualPrazo) {
      const atrasou = dias(hojeIso, i.atualPrazo) < 0;
      passos.push({ icone: atrasou ? '🚨' : '⏳', rotulo: atrasou ? `Atrasada desde ${ddmm(i.atualPrazo)}` : `Prazo ${ddmm(i.atualPrazo)}`, data: ddmm(i.atualPrazo), st: atrasou ? 'atr' : 'off' });
    }
  }
  passos.push({ icone: '✓', rotulo: ENTREGA_DE_MATERIAIS ? 'Materiais recebidos' : 'Aprovado', data: '', st: 'off' });
  return (
    // Tag em cima e trilha embaixo, sempre alinhadas à esquerda. Medidas fixas: círculo 28px,
    // traço de 16px entre eles e a data numa linha reservada embaixo (não empurra nada).
    <span className={emLinha ? 'flex items-center gap-2.5' : 'flex flex-col items-start gap-1.5'}>
      {!semTag && <Chip texto={tag} cor={corDaEtapa(i.rotulo)} />}
      <span className="flex items-start pb-0.5">
        {passos.map((p, k) => {
          const c = COR_PASSO[p.st];
          return (
            <span key={k} className="flex items-start">
              {k > 0 && <span className="mt-[13px] h-[2px] w-4 shrink-0" style={{ background: c.linha }} />}
              <span className="flex w-7 shrink-0 flex-col items-center gap-1" title={p.rotulo}>
                {typeof p.icone === 'string' ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-extrabold leading-none" style={{ background: c.bg, color: c.fg }}>
                    {p.icone}
                  </span>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center">{p.icone}</span>
                )}
                <span className="h-[10px] whitespace-nowrap text-[10px] font-semibold leading-[10px]" style={{ color: p.st === 'ok' ? '#8A8A90' : c.fg }}>
                  {p.data}
                </span>
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Foto pequena do responsável (ou a inicial, quando o Notion não tem foto). */
function AvatarPequeno({ nome, foto, grande = false }: { nome: string; foto: string | null; grande?: boolean }) {
  const t = grande ? 'h-7 w-7 text-[11px]' : 'h-[18px] w-[18px] text-[9.5px]';
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" className={`${t} rounded-full object-cover`} />
  ) : (
    <span className={`flex ${t} items-center justify-center rounded-full bg-[#111113] font-extrabold text-white`}>
      {nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Barra de progresso em partes: enviados · prontos · o que falta, com a legenda ao lado. */
function BarraSegmentos({ total, partes }: { total: number; partes: { n: number; cor: string; rot: string }[] }) {
  const t = Math.max(total, 1);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex h-2 w-36 overflow-hidden rounded-full bg-[#F0F0F2]">
        {partes.map((p, k) => (p.n > 0 ? <span key={k} style={{ width: `${(100 * p.n) / t}%`, background: p.cor }} /> : null))}
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 text-[12px] text-[#46464B]">
        {partes
          .filter((p) => p.n > 0)
          .map((p, k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: p.cor }} />
              <b className="text-[#111113]">{p.n}</b> {p.rot}
            </span>
          ))}
      </span>
    </span>
  );
}

const BTN_VERDE_O = 'inline-flex min-w-[136px] items-center justify-center whitespace-nowrap rounded-full border border-[#8BC4A0] bg-white px-3 py-[5px] text-[12px] font-extrabold text-[#1E6B3A] hover:bg-[#EEF7EA]';

export function EntregaSemanas({
  entregaId,
  entregaNome,
  tipo,
  grupos: gruposDoServidor,
  textos,
  baseUrl,
  hojeIso,
  diaria = false,
  fotos = {},
  extra,
}: {
  /** Visão própria da entrega (ex.: Conferência do dia), mostrada como primeira aba. */
  extra?: { rotulo: string; conteudo: React.ReactNode };
  /** Foto do Instagram de cada projeto (projetoId → url). */
  fotos?: Record<string, string | null>;
  /** Entrega diária (Alterações, Aprovações): atraso é o que venceu antes de hoje. */
  diaria?: boolean;
  entregaId: string;
  entregaNome: string;
  tipo: TipoEntrega;
  grupos: GrupoEntrega[];
  textos: Record<string, string>;
  baseUrl: string;
  hojeIso: string;
}) {
  const router = useRouter();
  ENTREGA_DE_ALTERACAO = /altera|^aprova[çc][õo]es$/i.test(entregaNome.trim());
  ENTREGA_DE_MATERIAIS = /materia|pr[ée]vi|conte[úu]do|informa/i.test(entregaNome.trim());
  const [previa, setPrevia] = useState<{ postId: string; tarefaId: string } | null>(null);
  const [envio, setEnvio] = useState<{ grupo: GrupoEntrega; separado: boolean } | null>(null);
  const [mensagem, setMensagem] = useState<GrupoEntrega | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [feitosAgora, setFeitosAgora] = useState<Record<string, string>>({});
  const [visao, setVisao] = useState<Visao>(extra ? 'extra' : 'data');
  // Aprovação: a 1ª vez com o cliente (data oficial) e a reaprovação (2ª e 3ª) em abas separadas.
  const temReaprovacao = gruposDoServidor.some((g) => g.itens.some((i) => i.reaprovacao));
  const [rodadaAba, setRodadaAba] = useState<'primeira' | 'reaprovacao'>('primeira');
  // Filtro (fica num botão só): cliente, responsável e um atalho de situação.
  const [fCliente, setFCliente] = useState('');
  const [fResp, setFResp] = useState('');
  const [fSit, setFSit] = useState<'' | 'nao_enviado' | 'nao_visto' | 'travado'>('');
  // Período (botões à vista): atrasados, esta semana, próxima, depois.
  const [fPer, setFPer] = useState<'' | 'atr' | 'esta' | 'prox' | 'depois'>('');
  const periodoDe = (i: ItemEntrega): 'atr' | 'esta' | 'prox' | 'depois' => {
    const esta = segunda(hojeIso);
    if (!i.prazo) return 'esta';
    const k = segunda(i.prazo);
    if (k < esta) return 'atr';
    if (k === esta) return 'esta';
    const dif = Math.round((Date.parse(k + 'T12:00:00Z') - Date.parse(esta + 'T12:00:00Z')) / 86_400_000);
    return dif <= 7 ? 'prox' : 'depois';
  };
  // Lembra a última visão escolhida (só depois de montar, pra não brigar com o servidor).
  useEffect(() => {
    if (extra) return;
    try {
      const v = window.localStorage.getItem('lud-visao-entrega');
      if (v === 'cliente') setVisao(v);
    } catch {
      /* sem storage */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const trocarVisao = (v: Visao) => {
    setVisao(v);
    if (v === 'extra') return;
    try {
      window.localStorage.setItem('lud-visao-entrega', v);
    } catch {
      /* sem storage */
    }
  };

  const grupos = useMemo(
    () =>
      gruposDoServidor.map((g) => ({
        ...g,
        itens: g.itens.map((i) => (feitosAgora[i.tarefaId] && !i.enviado ? { ...i, enviado: true, enviadoEm: feitosAgora[i.tarefaId] } : i)),
      })),
    [gruposDoServidor, feitosAgora],
  );

  const gruposTabela = useMemo(() => {
    const ok = (i: ItemEntrega) => {
      // Aba principal mostra tudo (reaprovação junto, com o nome dela no status); a aba Reaprovação filtra só elas.
      if (rodadaAba === 'reaprovacao' && !i.reaprovacao) return false;
      if (fResp && (i.responsavel ?? i.pessoa ?? '') !== fResp) return false;
      if (fPer && periodoDe(i) !== fPer) return false;
      if (fSit === 'travado') return i.relacao === 'antes';
      if (fSit === 'nao_enviado') return i.relacao !== 'antes' && comOCliente(i) && !(i.mensagens ?? []).length;
      if (fSit === 'nao_visto') {
        // Não visto = nunca abriu ou abriu antes do último envio.
        const ult = [...(i.mensagens ?? [])].map((m) => Date.parse(m.enviadoEm)).sort((a, b) => b - a)[0];
        return i.relacao !== 'antes' && comOCliente(i) && (!i.visto || (!!ult && Date.parse(i.visto.ultima) < ult));
      }
      return true;
    };
    return grupos
      .filter((g) => !fCliente || g.projetoId === fCliente)
      .map((g) => ({ ...g, itens: g.itens.filter(ok) }))
      .filter((g) => g.itens.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, temReaprovacao, rodadaAba, fCliente, fResp, fSit, fPer]);
  const nPer = (p: 'atr' | 'esta' | 'prox' | 'depois') => grupos.reduce((n, g) => n + g.itens.filter((i) => periodoDe(i) === p && !feito(i)).length, 0);
  const contaAbertos = (soReap: boolean) => grupos.reduce((n, g) => n + g.itens.filter((i) => !feito(i) && (!soReap || !!i.reaprovacao)).length, 0);
  const clientesDaEntrega = grupos.map((g) => ({ id: g.projetoId, nome: nomeCurtoDoProjeto(g.projetoNome || g.nome) })).sort((a, b) => a.nome.localeCompare(b.nome));
  const pessoasDaEntrega = [...new Set(grupos.flatMap((g) => g.itens.filter((i) => !feito(i)).map((i) => i.responsavel ?? i.pessoa ?? '')).filter(Boolean))].sort();
  const nFiltros = Number(!!fCliente) + Number(!!fResp) + Number(!!fSit);

  // Entrega diária (ex.: Conferir Postagem) separa por dia; as outras, por semana.
  const chaveDe = (d: string) => (diaria ? d.slice(0, 10) : segunda(d));
  const semanaAtual = chaveDe(hojeIso);
  /** Aba do item: 'atr' (rodadas anteriores, ainda aberto), a segunda da semana dele, ou null (feito em semana passada). */
  const abaDe = (i: ItemEntrega): string | null => {
    if (feito(i)) {
      const k = chaveDe(i.enviadoEm ? diaSpIso(i.enviadoEm) : i.prazo ?? hojeIso);
      return k < semanaAtual ? null : k;
    }
    if (!i.prazo) return semanaAtual;
    const k = chaveDe(i.prazo);
    return k < semanaAtual ? 'atr' : k;
  };

  const abas = useMemo(() => {
    const cont = new Map<string, number>();
    for (const g of grupos)
      for (const i of g.itens) {
        const k = abaDe(i);
        if (!k) continue;
        if (!cont.has(k)) cont.set(k, 0);
        if (!feito(i)) cont.set(k, (cont.get(k) ?? 0) + 1);
      }
    if (!cont.has(semanaAtual)) cont.set(semanaAtual, 0);
    if (!cont.has('atr')) cont.set('atr', 0);
    const semanas = [...cont.keys()].filter((k) => k !== 'atr' && k >= semanaAtual).sort().slice(0, diaria ? 6 : 3);
    return [{ id: 'atr', n: cont.get('atr') ?? 0 }, ...semanas.map((k) => ({ id: k, n: cont.get(k) ?? 0 }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, semanaAtual]);

  // Diária com atraso abre nos atrasados (é o que precisa de atenção primeiro).
  const [aba, setAba] = useState<string>(() => (diaria && (abas.find((x) => x.id === 'atr')?.n ?? 0) > 0 ? 'atr' : semanaAtual));

  const daAba = useMemo(
    () =>
      grupos
        .map((g) => ({ ...g, itens: g.itens.filter((i) => abaDe(i) === aba) }))
        .filter((g) => g.itens.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grupos, aba],
  );
  const itensAba = daAba.flatMap((g) => g.itens);
  const pendentes = itensAba.filter((i) => !feito(i));

  // DL de cada aba: a data mais comum entre os posts em aberto dela (nos atrasados, a mais antiga).
  const dlDe = (lista: ItemEntrega[], atrasados: boolean): string | null => {
    const base = lista.filter((i) => !feito(i)).length ? lista.filter((i) => !feito(i)) : lista;
    const datas = base.map((i) => i.prazo?.slice(0, 10)).filter((d): d is string => !!d);
    if (!datas.length) return null;
    if (atrasados) return datas.sort()[0];
    const cont = new Map<string, number>();
    for (const d of datas) cont.set(d, (cont.get(d) ?? 0) + 1);
    return [...cont.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  };
  const dlDaAba = (id: string) =>
    dlDe(
      grupos.flatMap((g) => g.itens.filter((i) => abaDe(i) === id)),
      id === 'atr',
    );
  const dl = dlDaAba(aba);

  const comAlgo = daAba
    .filter((g) => g.itens.some((i) => !feito(i)))
    .sort((a, b) => b.itens.filter(aqui).length - a.itens.filter(aqui).length || a.nome.localeCompare(b.nome));
  const fechados = daAba.filter((g) => g.itens.every(feito));
  const nAqui = pendentes.filter(aqui).length;
  const nLud = pendentes.filter(naLud).length;
  const nFeitos = itensAba.filter(feito).length;
  const clientesAqui = new Set(daAba.filter((g) => g.itens.some(aqui)).map((g) => g.projetoId)).size;

  const rotAqui = tipo === 'envio' ? 'Pronto pra enviar' : tipo === 'cliente' ? 'Com o cliente' : 'Pra fazer';
  const nTotal = itensAba.length;
  const dePosts = `de ${plural(nTotal, 'post', 'posts')}`;
  const tiles: { rot: string; num: string; sub: string; destaque?: boolean }[] = [
    {
      rot: tipo === 'envio' ? 'Prontos pra enviar' : tipo === 'cliente' ? 'Com o cliente' : 'Pra fazer',
      num: String(nAqui),
      sub: dePosts,
      destaque: true,
    },
    {
      rot: tipo === 'envio' ? 'Já enviados' : tipo === 'cliente' ? (ENTREGA_DE_MATERIAIS ? 'Já cobrados' : 'Já viram') : 'Feitos',
      num: String(
        tipo === 'cliente'
          ? pendentes.filter((i) => aqui(i) && (ENTREGA_DE_MATERIAIS ? (i.mensagens ?? []).length > 0 : i.visto)).length
          : nFeitos,
      ),
      sub: tipo === 'cliente' ? `de ${plural(nAqui, 'post', 'posts')} com o cliente` : dePosts,
    },
    { rot: 'Ainda na Lud.', num: String(nLud), sub: dePosts },
    { rot: tipo === 'envio' ? 'Faltam enviar' : 'Faltam', num: String(pendentes.length), sub: dePosts },
  ];

  const tituloAba = (id: string) => {
    if (id === 'atr') return 'Atrasados';
    if (diaria) {
      const dif = dias(hojeIso, id);
      if (dif === 0) return 'Hoje';
      if (dif === 1) return 'Amanhã';
      return `${new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(id + 'T12:00:00Z')).replace('.', '')}, ${ddmm(id)}`;
    }
    const dif = Math.round(dias(semanaAtual, id) / 7);
    return dif === 0 ? 'Esta semana' : dif === 1 ? 'Próxima semana' : `Semana de ${ddmm(id)}`;
  };

  function enviarFeito(msg: string, tarefaIds: string[]) {
    const agora = new Date().toISOString();
    setFeitosAgora((e) => ({ ...e, ...Object.fromEntries(tarefaIds.map((id) => [id, agora])) }));
    setEnvio(null);
    setAviso(msg);
    router.refresh();
  }

  const acao = (i: ItemEntrega, g: GrupoEntrega) => (
    <>{aqui(i) && i.postId && tipo === 'envio' ? (
                          <button type="button" onClick={() => setEnvio({ grupo: { ...g, itens: [i] }, separado: true })} className={BTN_VERDE_O}>
                            Enviar no grupo
                          </button>
                        ) : comOCliente(i) && i.postId ? (
                          <BotaoLembreteWpp
                            tarefaId={ENTREGA_DE_MATERIAIS ? i.tarefaId : i.aprovacaoTarefaId ?? i.tarefaId}
                            clienteNome={g.nome}
                            rotulo={ENTREGA_DE_MATERIAIS ? 'Cobrar materiais' : 'Lembrar no grupo'}
                            compacto
                          />
                        ) : (
                          <BotaoConcluirTarefa
                            tarefaId={i.atualTarefaId ?? i.tarefaId}
                            nome={i.atualTitulo ?? i.titulo}
                            classe={BTN}
                            onFeito={() => (aqui(i) ? enviarFeito('Tarefa concluída.', [i.tarefaId]) : (setAviso('Tarefa concluída.'), router.refresh()))}
                          />
                        )}</>
  );

  /** Vários posts do mesmo cliente numa mensagem só, no grupo do cliente. */
  const acaoCliente = (g: GrupoEntrega) => {
    const prontos = g.itens.filter((i) => aqui(i) && i.postId);
    if (tipo === 'envio' && prontos.length > 0)
      return (
        <button type="button" onClick={() => setEnvio({ grupo: { ...g, itens: g.itens.filter((i) => !feito(i)) }, separado: false })} className="btn-enviar">
          Enviar {plural(prontos.length, 'post', 'posts')} no grupo
        </button>
      );
    const comCli = g.itens.filter((i) => aqui(i) && i.postId);
    if (tipo === 'cliente' && comCli.length > 0)
      return (
        <button type="button" onClick={() => setMensagem({ ...g, itens: g.itens.filter((i) => !feito(i)) })} className="btn-enviar">
          {ENTREGA_DE_MATERIAIS ? 'Cobrar' : 'Lembrar'} {plural(comCli.length, 'post', 'posts')} no grupo
        </button>
      );
    return null;
  };

  return (
    <div className="flex flex-col gap-4">
      {temReaprovacao && visao !== 'extra' && (
        <div className="flex gap-1 border-b border-[#EDEDEF]">
          {(
            [
              ['primeira', entregaNome, contaAbertos(false), false],
              ['reaprovacao', 'Reaprovação', contaAbertos(true), true],
            ] as [typeof rodadaAba, string, number, boolean][]
          ).map(([id, rot, n, vermelho]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRodadaAba(id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[14px] ${rodadaAba === id ? 'border-[#111113] font-bold text-[#111113]' : 'border-transparent text-[#636369] hover:text-[#111113]'}`}
            >
              {rot}
              <span className={`rounded-full px-1.5 text-[11.5px] ${vermelho && n > 0 ? 'bg-[var(--prazo-atrasado)] font-bold text-white' : 'bg-[#F0F0F1] text-[#636369]'}`}>{n}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex w-fit gap-1 rounded-[12px] bg-[#F0F0F1] p-1">
        {([...(extra ? [['extra', extra.rotulo]] : []), ['data', '📅 Por data'], ['cliente', '👤 Por cliente']] as [Visao, string][]).map(([id, rot]) => (
          <button
            key={id}
            type="button"
            onClick={() => trocarVisao(id)}
            className={`whitespace-nowrap rounded-[9px] px-3.5 py-1.5 text-[13px] font-extrabold ${visao === id ? 'bg-white text-[#111113] shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-[#636369] hover:text-[#111113]'}`}
          >
            {rot}
          </button>
        ))}
      </div>
        {(visao === 'data' || visao === 'cliente') && (
          <span className="flex flex-wrap items-center gap-3.5">
            <span className="flex flex-wrap gap-1">
              {(
                [
                  ['', 'Tudo', 0],
                  ['atr', 'Atrasados', nPer('atr')],
                  ['esta', 'Esta semana', nPer('esta')],
                  ['prox', 'Próxima', nPer('prox')],
                  ['depois', 'Depois', nPer('depois')],
                ] as [typeof fPer, string, number][]
              ).map(([id, rot, n]) => (
                <button
                  key={id || 'tudo'}
                  type="button"
                  onClick={() => setFPer(id)}
                  className={`rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${fPer === id ? 'border-[#111113] bg-[#111113] text-white' : 'border-[#E2E2E5] bg-white text-[#46464B] hover:bg-[#F4F4F5]'}`}
                >
                  {rot}
                  {id && n > 0 ? <span className={`ml-1 ${id === 'atr' && fPer !== id ? 'text-[var(--prazo-atrasado)]' : 'opacity-60'}`}>{n}</span> : null}
                </button>
              ))}
            </span>
            <details className="relative">
              <summary className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold [&::-webkit-details-marker]:hidden ${nFiltros ? 'border-[#111113] bg-[#111113] text-white' : 'border-[#E2E2E5] bg-white text-[#46464B] hover:bg-[#F4F4F5]'}`}>
                Filtrar{nFiltros ? ` · ${nFiltros}` : ''} <span className="text-[10px]">▾</span>
              </summary>
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-[240px] flex-col gap-2.5 rounded-[12px] border border-[#E9E9EB] bg-white p-3 shadow-[0_8px_24px_rgba(17,17,19,0.12)]">
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-[#8A8A90]">
                  Cliente
                  <select value={fCliente} onChange={(e) => setFCliente(e.target.value)} className="rounded-[8px] border border-[#E2E2E5] px-2 py-1.5 text-[13px] text-[#111113]">
                    <option value="">Todos</option>
                    {clientesDaEntrega.map((c) => (
                      <option key={c.id} data-tarefa-id={c.id} value={c.id}>
                        {c.nome.startsWith('@') ? c.nome : `@${c.nome}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-[#8A8A90]">
                  Responsável
                  <select value={fResp} onChange={(e) => setFResp(e.target.value)} className="rounded-[8px] border border-[#E2E2E5] px-2 py-1.5 text-[13px] text-[#111113]">
                    <option value="">Todos</option>
                    {pessoasDaEntrega.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['', 'Todos'],
                      ['nao_enviado', '📤 Não enviados'],
                      ['nao_visto', '👁 Não vistos'],
                      ['travado', '🔒 Travados'],
                    ] as [typeof fSit, string][]
                  ).map(([id, rot]) => (
                    <button
                      key={id || 'todos'}
                      type="button"
                      onClick={() => setFSit(id)}
                      className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${fSit === id ? 'border-[#111113] bg-[#111113] text-white' : 'border-[#E2E2E5] text-[#46464B] hover:bg-[#F4F4F5]'}`}
                    >
                      {rot}
                    </button>
                  ))}
                </span>
                {nFiltros > 0 && (
                  <button type="button" onClick={() => (setFCliente(''), setFResp(''), setFSit(''))} className="self-start text-[12px] font-semibold text-[#636369] hover:text-[#111113]">
                    Limpar filtros
                  </button>
                )}
              </div>
            </details>
            <LegendaSinal />
          </span>
        )}
      </div>

      {aviso && visao !== 'semanas' && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#EEF7EA] px-4 py-2.5 text-[13px] font-bold text-[#2E5520]">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} className="text-[12px] font-extrabold">
            fechar
          </button>
        </div>
      )}

      {visao === 'extra' && extra?.conteudo}
      {(visao === 'data' || visao === 'cliente') && (
        <TabelaEntrega
          grupos={gruposTabela}
          porCliente={visao === 'cliente'}
          hojeIso={hojeIso}
          fotos={fotos}
          acao={acao}
          acaoCliente={acaoCliente}
          abrir={(i) => i.postId && setPrevia({ postId: i.postId, tarefaId: i.tarefaId })}
        />
      )}

      {visao === 'semanas' && (<>
      <div className="flex flex-wrap gap-2">
        {abas.map((a) => {
          const sel = a.id === aba;
          const d = diaria && a.id !== 'atr' ? null : dlDaAba(a.id);
          const cor = d ? corDaData(d, hojeIso) : NEU;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={`flex items-center gap-2.5 rounded-[14px] py-2 pl-3.5 pr-2 ${sel ? 'bg-[#111113] text-white' : 'border border-[#E2E2E5] bg-white text-[#111113] hover:bg-[#F7F7F8]'}`}
            >
              <b className="text-[13.5px]">{tituloAba(a.id)}</b>
              <span
                className={`rounded-full px-2 py-px text-[12px] font-extrabold ${
                  a.id === 'atr' && a.n > 0 ? 'bg-[var(--prazo-atrasado)] text-white' : sel ? 'bg-white/15' : 'bg-[#F4F4F5]'
                }`}
              >
                {a.n}
              </span>
              {d && (
                <span className="flex items-baseline gap-1.5 rounded-[10px] px-2.5 py-1" style={{ background: cor.bg, color: cor.fg }}>
                  <span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]">{a.id === 'atr' ? 'desde' : 'DL'}</span>
                  <b className="text-[13.5px]">{curta(d)}</b>
                  {a.id !== 'atr' && <span className="text-[11.5px] font-extrabold">{quando(d, hojeIso)}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {aviso && (
        <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[#EEF7EA] px-4 py-2.5 text-[13px] font-bold text-[#2E5520]">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} className="text-[12px] font-extrabold">
            fechar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.rot}
            className="flex flex-col gap-1 rounded-[16px] border px-4 py-3.5"
            style={t.destaque ? { background: '#EEF7EA', borderColor: '#D6EBCB' } : { background: '#FFFFFF', borderColor: '#E9E9EB' }}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">{t.rot}</span>
            <b className="text-[30px] leading-none tracking-[-0.02em]" style={{ color: t.destaque ? '#2E5520' : '#111113' }}>
              {t.num}
            </b>
            <span className="text-[12px] text-[#636369]">{t.sub}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <b className="text-[18px]">{aba === 'atr' ? 'Posts atrasados' : diaria ? 'Posts do dia' : 'Posts da semana'}</b>
          <span className="text-[12.5px] text-[#636369]">
            quem tem post {tipo === 'envio' ? 'pronto' : 'pendente'} aparece primeiro · clique no título pra ver a prévia
          </span>
        </div>

        {comAlgo.length === 0 && (
          <div className="rounded-[16px] border border-dashed border-[#D6D6D9] bg-white px-5 py-8 text-center text-[13px] text-[#636369]">
            {aba === 'atr' ? 'Nada atrasado de rodadas anteriores.' : diaria ? 'Nada em aberto nesse dia.' : 'Nada em aberto nesta semana.'}
          </div>
        )}

        {comAlgo.map((g) => {
          const handle = nomeCurtoDoProjeto(g.projetoNome || g.nome);
          const abertos = g.itens.filter((i) => !feito(i));
          const prontos = abertos.filter(aqui);
          const nFeitosG = g.itens.length - abertos.length;
          const msgs = mensagensDe(g.itens);
          const viu = prontos.some((i) => i.visto);
          const status =
            tipo === 'cliente'
              ? prontos.length
                ? ENTREGA_DE_MATERIAIS
                  ? { t: msgs.length ? 'Cobrado, esperando materiais' : 'Materiais não cobrados', c: msgs.length ? HOJE : ATR }
                  : { t: viu ? 'Cliente viu, sem aprovar' : 'Cliente não viu', c: viu ? HOJE : ATR }
                : { t: 'Com a Lud.', c: { bg: '#E3ECF7', fg: '#24466B' } }
              : null;
          const ordenados = [...abertos].sort((a, b) => Number(aqui(b)) - Number(aqui(a)) || (a.prazo ?? '').localeCompare(b.prazo ?? ''));
          return (
            <div key={g.projetoId} className="overflow-hidden rounded-[16px] border border-[#E9E9EB] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA] px-4 py-3">
                <span className="flex flex-wrap items-center gap-3">
                  <Selo handle={handle} href={rotas.entregaDoProjeto(g.projetoId, entregaId)} foto={fotos[g.projetoId]} />
                  <BarraSegmentos
                    total={g.itens.length}
                    partes={[
                      { n: nFeitosG, cor: '#2E7D4F', rot: tipo === 'envio' ? (nFeitosG === 1 ? 'enviado' : 'enviados') : nFeitosG === 1 ? 'feito' : 'feitos' },
                      { n: prontos.length, cor: '#A9D49A', rot: tipo === 'envio' ? (prontos.length === 1 ? 'pronto' : 'prontos') : tipo === 'cliente' ? 'com o cliente' : 'pra fazer' },
                      { n: abertos.length - prontos.length, cor: '#C9C9CE', rot: 'ainda na Lud.' },
                    ]}
                  />
                  {status && <Chip texto={status.t} cor={status.c} />}
                  {(tipo === 'cliente' || tipo === 'envio') && (
                    <span className="text-[12px] text-[#8A8A90]">
                      {msgs.length ? `${plural(msgs.length, 'mensagem', 'mensagens')} · última ${quandoFoi(msgs[0].enviadoEm, hojeIso)}` : 'nenhuma mensagem ainda'}
                    </span>
                  )}
                </span>
                {tipo === 'envio' && prontos.length > 0 && (
                  <button type="button" onClick={() => setEnvio({ grupo: { ...g, itens: abertos }, separado: false })} className="btn-enviar">
                    Enviar {prontos.length} pra aprovação
                  </button>
                )}
                {tipo === 'cliente' && prontos.some((i) => i.postId) && (
                  <button type="button" onClick={() => setMensagem({ ...g, itens: abertos })} className="btn-enviar">
                    Mensagem da entrega ({prontos.length})
                  </button>
                )}
                {tipo === 'envio' && prontos.length === 0 && <span className="text-[12px] text-[#8A8A90]">nada pronto pra enviar</span>}
              </div>
              <ul>
                {ordenados.map((i) => {
                  return (
                    <li
                      key={i.tarefaId} data-tarefa-id={i.tarefaId}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#F0F0F2] px-4 py-2.5 sm:grid-cols-[72px_minmax(0,1fr)_minmax(360px,560px)_170px]"
                    >
                      <span className="hidden sm:block">{i.prazo && <SeloDL data={i.prazo.slice(0, 10)} hojeIso={hojeIso} />}</span>
                      <button
                        type="button"
                        onMouseEnter={() => prefetchPrevia(i.postId)} onClick={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.tarefaId })}
                        className="truncate text-left text-[13.5px] font-bold hover:underline"
                        title={i.postTitulo}
                      >
                        {i.postTitulo}
                      </button>
                      <span className="col-span-2 flex flex-col items-start gap-0.5 sm:col-span-1">
                        {tipo !== 'envio' ? (
                          <StatusTrilha i={i} hojeIso={hojeIso} />
                        ) : (
                        <>
                        {aqui(i) ? (
                          <span className="flex flex-col items-start gap-1">
                            <span className="flex flex-wrap items-center gap-2">
                              {tipo === 'envio' ? (
                                <Chip texto={i.reaprovacao ? `${rotAqui} · reaprovação` : rotAqui} cor={OK} />
                              ) : (
                                <Chip texto={nomeDaTag(i)} cor={corDaEtapa(i.rotulo)} />
                              )}
                              {tipo === 'envio' &&
                                (i.visto ? (
                                  <span className="whitespace-nowrap text-[11.5px] font-bold text-[#46464B]" title="O cliente já abriu esse post no portal">
                                    👁 {ddmm(diaSpIso(i.visto.ultima))}
                                  </span>
                                ) : (
                                  <span className="whitespace-nowrap text-[11.5px] text-[#A1A1A8]" title="O cliente ainda não abriu esse post no portal">
                                    não visto
                                  </span>
                                ))}
                            </span>
                            {tipo !== 'envio' && <LinhaLembretes i={i} hojeIso={hojeIso} />}
                          </span>
                        ) : (
                          <>
                            <Chip texto={i.rotulo} cor={corDaEtapa(i.rotulo)} />
                            {(i.responsavel || i.atualPrazo) && (
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[#636369]">
                                {i.responsavel && (
                                  <span className="flex items-center gap-1.5">
                                    <AvatarPequeno nome={i.responsavel} foto={i.responsavelAvatar ?? null} />
                                    <b className="font-bold text-[#46464B]">{i.responsavel.split(' ')[0]}</b>
                                  </span>
                                )}
                                {i.atualPrazo &&
                                  (dias(hojeIso, i.atualPrazo) < 0 ? (
                                    <span className="font-bold text-[#B42318]" title={`atrasada desde ${ddmm(i.atualPrazo)}`}>
                                      🚨 {ddmm(i.atualPrazo)}
                                    </span>
                                  ) : (
                                    <span title={`prazo ${ddmm(i.atualPrazo)}`}>⏳ {ddmm(i.atualPrazo)}</span>
                                  ))}
                              </span>
                            )}
                          </>
                        )}
                        </>
                        )}
                      </span>
                      <span className="hidden justify-end sm:flex">
                        {acao(i, g)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {aba !== 'atr' && fechados.length + daAba.filter((g) => g.itens.some(feito) && !g.itens.every(feito)).length > 0 && (
        // O que já foi feito fica fechado num toggle (abre pra conferir).
        <details className="group overflow-hidden rounded-[16px] border border-[#E9E9EB] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-[#FAFAFA] px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex items-baseline gap-2.5">
              <span className="inline-block text-[12px] text-[#636369] transition group-open:rotate-90">▸</span>
              <b className="text-[15px]">{`${tipo === 'envio' ? 'Já enviados' : 'Já feitos'} ${diaria ? 'nesse dia' : 'nesta semana'}`}</b>
              <span className="text-[12.5px] text-[#636369]">quando saiu e se foi no prazo</span>
            </span>
            <span className="text-[12px] font-extrabold text-[#46464B]">{plural(nFeitos, 'post', 'posts')}</span>
          </summary>
          {daAba
            .filter((g) => g.itens.some(feito))
            .map((g) => {
              const fs = g.itens.filter(feito);
              const datas = fs.map((i) => i.enviadoEm).filter((d): d is string => !!d).sort();
              const atrasados = fs.filter((i) => i.enviadoEm && i.prazo && i.enviadoEm.slice(0, 10) > i.prazo.slice(0, 10)).length;
              return (
                <div key={g.projetoId} className="flex flex-col gap-1.5 border-t border-[#F0F0F2] px-4 py-2.5">
                  <span className="flex flex-wrap items-center gap-3">
                    <Selo handle={nomeCurtoDoProjeto(g.projetoNome || g.nome)} href={rotas.entregaDoProjeto(g.projetoId, entregaId)} foto={fotos[g.projetoId]} />
                    <span className="text-[12.5px] text-[#636369]">
                      {plural(fs.length, 'post', 'posts')}
                      {datas.length ? ` · ${quandoFoi(datas[datas.length - 1], hojeIso)}` : ''}
                    </span>
                    {datas.length > 0 && <Chip texto={atrasados ? `${atrasados} com atraso` : 'no prazo'} cor={atrasados ? ATR : OK} />}
                  </span>
                  <ul className="flex flex-col gap-0.5 pl-1">
                    {fs.map((i) => (
                      <li key={i.tarefaId} data-tarefa-id={i.tarefaId} className="flex items-center gap-2 text-[12.5px]">
                        <span className="text-[#2E7D4F]">✓</span>
                        <button
                          type="button"
                          onMouseEnter={() => prefetchPrevia(i.postId)}
                          onClick={() => i.postId && setPrevia({ postId: i.postId, tarefaId: i.tarefaId })}
                          className="min-w-0 truncate text-left font-bold hover:underline"
                        >
                          {i.postTitulo}
                        </button>
                        {i.enviadoEm && <span className="shrink-0 text-[#8A8A90]">{ddmm(diaSpIso(i.enviadoEm))}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </details>
      )}

      </>)}

      {previa && <PreviaPostModal postId={previa.postId} tarefaId={previa.tarefaId} fechar={() => setPrevia(null)} />}

      {envio && (
        <ModalEnvioAprovacao
          grupo={envio.grupo}
          separado={envio.separado}
          textos={textos}
          baseUrl={baseUrl}
          hojeIso={hojeIso}
          fechar={() => setEnvio(null)}
          aoEnviar={enviarFeito}
        />
      )}

      {mensagem && (
        <ModalMensagem
          projetoId={mensagem.projetoId}
          clienteNome={mensagem.nome}
          gruposWpp={mensagem.gruposWpp}
          titulo={entregaNome}
          itens={mensagem.itens
            .filter((i) => aqui(i) && i.postId)
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
                reaprovacao: i.reaprovacao,
                visto: i.visto,
              }),
            )}
          textos={textos}
          hojeIso={hojeIso}
          fechar={() => setMensagem(null)}
          aoEnviar={(nomeGrupo) => {
            setMensagem(null);
            setAviso(`Mensagem enviada no grupo ${nomeGrupo ?? mensagem.gruposWpp[0]?.nome ?? 'do cliente'}.`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Conclui no Notion a tarefa de quem está com o post agora (no lugar do antigo "Ver tarefa"). */
function BotaoConcluirTarefa({ tarefaId, nome, classe, onFeito }: { tarefaId: string; nome: string; classe: string; onFeito: () => void }) {
  const [estado, setEstado] = useState<'livre' | 'salvando' | 'feito' | 'erro'>('livre');
  async function concluir() {
    setEstado('salvando');
    try {
      const r = await fetch(`/api/tarefas/${tarefaId}/concluir`, { method: 'POST' });
      if (!r.ok) throw new Error();
      avisarConcluida(tarefaId);
      setEstado('feito');
      onFeito();
    } catch {
      setEstado('erro');
    }
  }
  return (
    <button type="button" onClick={concluir} disabled={estado === 'salvando' || estado === 'feito'} className={classe} title={`Concluir "${nome}" no Notion`}>
      {estado === 'salvando' ? 'Concluindo…' : estado === 'feito' ? '✓ Concluída' : estado === 'erro' ? 'Erro, tentar de novo' : 'Concluir tarefa'}
    </button>
  );
}

/**
 * Visão em tabela (igual em todas as entregas): o que está aberto, por data
 * (Atrasados, Esta semana, Próxima semana, semanas seguintes) ou por cliente.
 * Colunas fixas: Data · 🔒 · Status · Post · Projeto · Resp. · Sinal · ação.
 */
function TabelaEntrega({
  grupos,
  porCliente,
  hojeIso,
  fotos,
  acao,
  abrir,
  acaoCliente,
}: {
  /** Botão no topo de cada cliente (visão Por cliente): manda vários posts de uma vez. */
  acaoCliente?: (g: GrupoEntrega) => React.ReactNode;
  grupos: GrupoEntrega[];
  porCliente: boolean;
  hojeIso: string;
  fotos: Record<string, string | null>;
  acao: (i: ItemEntrega, g: GrupoEntrega) => React.ReactNode;
  abrir: (i: ItemEntrega) => void;
}) {
  type Linha = { i: ItemEntrega; g: GrupoEntrega; handle: string; data: string | null };
  const linhas: Linha[] = grupos
    .flatMap((g) => g.itens.filter((i) => !feito(i)).map((i) => ({ i, g, handle: nomeCurtoDoProjeto(g.projetoNome || g.nome), data: i.prazo?.slice(0, 10) ?? null })))
    .sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999') || a.handle.localeCompare(b.handle));

  type Bloco = { id: string; titulo: React.ReactNode; sub?: string; linhas: Linha[]; cliente?: boolean; dentro?: boolean; g?: GrupoEntrega };
  const blocos: Bloco[] = [];
  // Atrasados primeiro; depois uma tabela por semana (segunda a domingo).
  const seg0 = segunda(hojeIso);
  const porSemanas = (ls: Linha[], prefixo: string, dentro: boolean, sempreAtrasados: boolean) => {
    const atr = ls.filter((l) => l.data && l.data < hojeIso);
    if (atr.length || sempreAtrasados) blocos.push({ id: `${prefixo}atr`, titulo: <span className="text-[var(--prazo-atrasado)]">Atrasados</span>, linhas: atr, dentro });
    const porSemana = new Map<string, Linha[]>();
    for (const l of ls) if (l.data && l.data >= hojeIso) porSemana.set(segunda(l.data), [...(porSemana.get(segunda(l.data)) ?? []), l]);
    for (const s0 of [...porSemana.keys()].sort()) {
      const n = Math.round(dias(seg0, s0) / 7);
      blocos.push({
        id: `${prefixo}sem-${s0}`,
        titulo: n === 0 ? 'Esta semana' : n === 1 ? 'Próxima semana' : `Semana de ${ddmm(s0)}`,
        sub: `${ddmm(s0)} a ${ddmm(soma(s0, 6))}`,
        linhas: porSemana.get(s0)!,
        dentro,
      });
    }
    const sem = ls.filter((l) => !l.data);
    if (sem.length) blocos.push({ id: `${prefixo}sem`, titulo: 'Sem data', linhas: sem, dentro });
  };
  if (porCliente) {
    // Cada cliente com as mesmas semanas da visão por data.
    const m = new Map<string, Linha[]>();
    for (const l of linhas) m.set(l.g.projetoId, [...(m.get(l.g.projetoId) ?? []), l]);
    for (const [pid, ls] of [...m.entries()].sort((a, b) => a[1][0].handle.localeCompare(b[1][0].handle))) {
      blocos.push({
        id: `cli-${pid}`,
        cliente: true,
        g: ls[0].g,
        titulo: (
          <span className="flex items-center gap-2.5">
            <AvatarProjeto handle={ls[0].handle} nome={ls[0].g.projetoNome} foto={fotos[pid] ?? null} />
            {ls[0].handle.startsWith('@') ? ls[0].handle : `@${ls[0].handle}`}
          </span>
        ),
        linhas: ls,
      });
      porSemanas(ls, `${pid}-`, true, false);
    }
  } else {
    porSemanas(linhas, '', false, true);
  }

  if (!linhas.length)
    return <div className="rounded-[16px] border border-[#E9E9EB] bg-white px-5 py-8 text-center text-[13px] text-[#636369]">Nada por aqui. 🎉</div>;

  const TH = 'px-3 py-2 text-left text-[12px] font-semibold text-[#8A8A90] whitespace-nowrap';
  const comCliente = (i: ItemEntrega) => i.relacao !== 'antes' && comOCliente(i);
  const sinal = (i: ItemEntrega): Bolinha[] => {
    if (comCliente(i)) {
      const msgs = [...(i.mensagens ?? [])].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
      const b: Bolinha[] = [
        msgs.length
          ? {
              icone: '📤',
              dica: `Enviado no grupo${msgs.length > 1 ? ` · ${msgs.length} mensagens` : ''}`,
              st: 'ok',
              linhas: msgs.slice(0, 5).map((m) => `${rotuloMomento(m.momento)} · ${quandoFoi(m.enviadoEm, hojeIso)}`),
            }
          : {
              icone: '📤',
              dica: ENTREGA_DE_MATERIAIS ? 'Ninguém cobrou no grupo ainda' : 'Ainda não foi pro grupo',
              st: 'atr',
              linhas: i.prazoCliente ? [`Prazo do cliente: ${curta(i.prazoCliente.slice(0, 10))}`] : [],
            },
      ];
      if (!ENTREGA_DE_MATERIAIS) {
        // O visto só vale se for DEPOIS do último envio: senão o cliente ainda não viu o que mandamos agora.
        const ultimoEnvio = msgs[0]?.enviadoEm ?? null;
        const vezes = i.visto ? `${i.visto.total} ${i.visto.total === 1 ? 'visualização' : 'visualizações'}` : '';
        b.push(
          !i.visto
            ? { icone: '👁', dica: 'Cliente ainda não abriu o post', st: 'off' }
            : ultimoEnvio && Date.parse(i.visto.ultima) < Date.parse(ultimoEnvio)
              ? {
                  icone: '👁',
                  dica: `Ainda não viu o envio de ${quandoFoi(ultimoEnvio, hojeIso)}`,
                  st: 'off',
                  linhas: [`Viu antes, ${quandoFoi(i.visto.ultima, hojeIso)}`, vezes],
                }
              : { icone: '👁', dica: 'Cliente viu o post', st: 'ok', linhas: [`Última vez ${quandoFoi(i.visto.ultima, hojeIso)}`, vezes] },
        );
      }
      return b;
    }
    if (i.atualPrazo && i.atualPrazo.slice(0, 10) < hojeIso) {
      const n = -dias(hojeIso, i.atualPrazo.slice(0, 10));
      return [
        {
          icone: '🚨',
          dica: `Atrasada desde ${curta(i.atualPrazo.slice(0, 10))}`,
          st: 'atr',
          linhas: [`${i.atualTitulo ?? i.rotulo}${i.responsavel ? ` com ${i.responsavel}` : ''}`, `${n} ${n === 1 ? 'dia' : 'dias'} de atraso`],
        },
      ];
    }
    return [];
  };
  const tituloStatus = (i: ItemEntrega) => (i.relacao === 'antes' ? i.atualTitulo ?? i.rotulo : nomeDaTag(i));

  return (
    <div className="flex flex-col gap-5">
      {blocos.map((b) =>
        b.cliente ? (
          <div key={b.id} className="mt-3 flex items-center gap-2 border-t border-[#EDEDEF] pt-5 first:mt-0 first:border-0 first:pt-0">
            <b className="text-[18px] tracking-[-0.01em]">{b.titulo}</b>
            <span className="text-[13px] text-[#A1A1A8]">{b.linhas.length}</span>
            {b.g && acaoCliente && <span className="ml-auto">{acaoCliente(b.g)}</span>}
          </div>
        ) : (
        <section key={b.id} className={`flex flex-col gap-1.5 ${b.dentro ? 'pl-4' : ''}`}>
          <div className="flex items-baseline gap-2 py-1">
            <b className={b.dentro ? 'text-[14px]' : 'text-[15px]'}>{b.titulo}</b>
            <span className="text-[12.5px] text-[#A1A1A8]">
              {b.sub ? `${b.sub} · ` : ''}
              {b.linhas.length}
            </span>
          </div>
          <div className="overflow-x-auto rounded-[12px] border border-[#EDEDEF] bg-white">
            {b.linhas.length === 0 ? (
              <p className="px-4 py-4 text-center text-[12.5px] text-[#A1A1A8]">Nada aqui.</p>
            ) : (
              <table className="w-full min-w-[980px] table-fixed border-collapse">
                <thead>
                  <tr className="border-b border-[#EDEDEF]">
                    <th className={`${TH} w-[76px]`}>Data</th>
                    <th className="w-[44px]" />
                    <th className={`${TH} w-[290px]`}>Status</th>
                    <th className={TH}>Post</th>
                    <th className={`${TH} w-[68px] text-center`}>Projeto</th>
                    <th className={`${TH} w-[60px] text-center`}>Resp.</th>
                    <th className={`${TH} w-[120px]`}>Sinal</th>
                    <th className={`${TH} w-[170px]`} />
                  </tr>
                </thead>
                <tbody>
                  {b.linhas.map(({ i, g, handle, data }) => {
                    const trav = i.relacao === 'antes';
                    const quem = i.responsavel ?? i.pessoa;
                    return (
                      <tr key={i.tarefaId} data-tarefa-id={i.tarefaId} className={`border-b border-[#F2F2F4] align-middle last:border-0 ${trav ? 'bg-[#FCFCFC]' : 'hover:bg-[#FAFAFA]'}`}>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] font-semibold tabular-nums" style={{ color: data && data < hojeIso ? 'var(--prazo-atrasado)' : data === hojeIso ? '#8A3B0E' : '#46464B' }}>
                          {!data ? '—' : data === hojeIso ? 'hoje' : dias(hojeIso, data) === 1 ? 'amanhã' : ddmm(data)}
                        </td>
                        <td className="py-2.5 pl-1">{trav && <Cadeado />}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="min-w-0 truncate" title={tituloStatus(i)}>
                              <Chip texto={tituloStatus(i)} cor={corDaEtapa(tituloStatus(i))} />
                            </span>
                            {i.reaprovacao && i.rodada > 1 && (
                              <span className="rounded-[6px] bg-[#F2D0EA] px-1.5 text-[11px] font-extrabold text-[#6A2B5F]" title={`${i.rodada}ª vez com o cliente`}>
                                {i.rodada}ª
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onMouseEnter={() => i.postId && prefetchPrevia(i.postId)}
                            onClick={() => abrir(i)}
                            className="block w-full truncate text-left text-[13.5px] font-semibold text-[#111113] hover:underline"
                            title={i.postTitulo}
                          >
                            {i.postTitulo}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex justify-center">
                            <AvatarProjeto handle={handle} nome={g.projetoNome} foto={fotos[g.projetoId] ?? null} />
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex justify-center">
                            {comCliente(i) ? (
                              <AvatarPessoa nome={quem ?? g.nome} foto={i.responsavelAvatar ?? fotos[g.projetoId] ?? null} titulo={`Com o cliente${quem ? ` (${quem})` : ''}`} />
                            ) : quem ? (
                              <AvatarPessoa nome={quem} foto={i.responsavelAvatar ?? null} titulo={`Com ${quem}`} />
                            ) : (
                              <span className="text-[#A1A1A8]">—</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Sinal itens={sinal(i)} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">{acao(i, g)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
        ),
      )}
    </div>
  );
}

function Projeto({ handle, foto, pequeno = false, soAvatar = false }: { handle: string; foto: string | null; pequeno?: boolean; soAvatar?: boolean }) {
  const t = soAvatar ? 'h-7 w-7 text-[11px]' : pequeno ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]';
  const arroba = handle.startsWith('@') ? handle : `@${handle}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={arroba}>
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className={`${t} shrink-0 rounded-full border border-[#E9E9EB] object-cover`} />
      ) : (
        <span className={`${t} flex shrink-0 items-center justify-center rounded-full bg-[#111113] font-extrabold text-white`}>{handle.replace(/^@/, '')[0]?.toUpperCase()}</span>
      )}
      {!soAvatar && <span className={pequeno ? 'text-[13px]' : ''}>{arroba}</span>}
    </span>
  );
}

/** Quando, com emoji: 🚨 atrasada · 🔥 hoje · ⏭ amanhã · 📅 data. */
export function quandoComEmoji(prazo: string, hojeIso: string): { texto: string; cor: string } {
  const d = dias(hojeIso, prazo);
  if (d < 0) return { texto: `🚨 ${ddmm(prazo)}`, cor: 'var(--prazo-atrasado)' };
  if (d === 0) return { texto: '🔥 hoje', cor: '#8A3B0E' };
  if (d === 1) return { texto: '⏭ amanhã', cor: '#46464B' };
  return { texto: `📅 ${ddmm(prazo)}`, cor: '#636369' };
}

/** Bloqueada: cadeado, a tag da etapa que segura o post e, embaixo, a foto de quem está com ela e quando. */
export function TagBloqueio({
  titulo,
  pessoa,
  avatar = null,
  prazo,
  hojeIso,
  semCadeado = false,
}: {
  semCadeado?: boolean;
  titulo: string;
  pessoa: string | null;
  avatar?: string | null;
  prazo: string | null;
  hojeIso: string;
}) {
  const q = prazo ? quandoComEmoji(prazo, hojeIso) : null;
  return (
    <span className="flex items-center gap-2">
      {!semCadeado && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#D6D6D9] text-[11px]" aria-hidden="true">
          🔒
        </span>
      )}
      <span className="flex flex-col items-start gap-1 lg:flex-row lg:flex-nowrap lg:items-center lg:gap-2">
        <Chip texto={titulo} cor={corDaEtapa(titulo)} />
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px]">
          {pessoa && (
            <span className="flex shrink-0 items-center gap-1 text-[#46464B]" title={`Com ${pessoa}`}>
              <AvatarPequeno nome={pessoa} foto={avatar} />
              {pessoa.split(' ')[0]}
            </span>
          )}
          {q && (
            <span className="shrink-0 font-semibold" style={{ color: q.cor }}>
              {q.texto}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
