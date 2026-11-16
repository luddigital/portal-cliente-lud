/**
 * Kit visual do admin (proposta NOVA, aprovada no canvas do LudHub).
 *
 * Base neutra em cinzas + cores semânticas da "Paleta E" só pra estado.
 * Vale SÓ pra Visão Lud. (admin): a visão do cliente continua com o visual de antes.
 * Sem degradê, sem tracinho colorido do lado, sem emoji como marcador de seção.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------- cores
export type St = 'atr' | 'hoje' | 'cheg' | 'ok' | 'info' | 'neu' | 'cli' | 'areia' | 'lima' | 'prog';

/** [fundo, texto, médio] de cada estado. */
export const ST: Record<St, [string, string, string]> = {
  atr: ['#F6CFCB', '#7E211C', '#B42318'], // atrasado
  hoje: ['#F8D5E5', '#7A1F4C', '#C2417E'], // vence hoje
  cheg: ['#E2DDFA', '#3D3478', '#7462D6'], // chegando / em andamento
  ok: ['#D8EDCF', '#2E5520', '#2E7D4F'], // feito / em dia
  info: ['#D3E2F3', '#24466B', '#5E89B5'], // informação
  neu: ['#F4F4F5', '#46464B', '#B4B4B9'], // neutro
  cli: ['#F2D0EA', '#6A2B5F', '#A8559A'], // com o cliente
  areia: ['#EFE4D8', '#5A4634', '#A88A6C'],
  lima: ['#E3F0B2', '#45540F', '#8BA32A'],
  prog: ['#F5CBA7', '#6E2E0A', '#C25A12'], // falta programar: laranja no tom da paleta
};

export const CINZA = {
  fundo: '#FAFAFA',
  card: '#FFFFFF',
  linha: '#E9E9EB',
  linhaFraca: '#F4F4F5',
  texto: '#111113',
  medio: '#46464B',
  fraco: '#636369',
  apagado: '#8A8A90',
};

// ---------------------------------------------------------------- básicos
export function Card({
  children,
  className = '',
  pad = 'p-5',
}: {
  children: ReactNode;
  className?: string;
  pad?: string;
}) {
  return (
    <section className={`rounded-[20px] border border-[#E9E9EB] bg-white ${pad} flex flex-col gap-3 min-w-0 ${className}`}>
      {children}
    </section>
  );
}

export function TituloCard({ titulo, sub, acao }: { titulo: ReactNode; sub?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <b className="text-[16px] font-bold tracking-[-0.01em] text-[#111113]">{titulo}</b>
        {sub && <span className="text-[12.5px] text-[#636369]">{sub}</span>}
      </div>
      {acao}
    </div>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#636369]">{children}</span>;
}

export function Tag({ children, st = 'neu', className = '' }: { children: ReactNode; st?: St; className?: string }) {
  const [bg, fg] = ST[st];
  return (
    <span
      className={`inline-flex min-w-[64px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold ${className}`}
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export function Ponto({ st }: { st: St }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: ST[st][2] }} />;
}

/** Selinho do @ do projeto. */
export function Selo({ handle, href }: { handle: string; href?: string }) {
  const h = handle.replace(/^@/, '');
  const corpo = (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[rgba(17,17,19,0.08)] bg-white py-[2px] pl-[2px] pr-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#111113] text-[8.5px] font-extrabold text-white">
        {(h[0] ?? '?').toUpperCase()}
      </span>
      <span className="truncate text-[11.5px] font-bold text-[#46464B]">@{h}</span>
    </span>
  );
  return href ? <Link href={href}>{corpo}</Link> : corpo;
}

export function Avatar({ nome, tam = 24, cor = '#111113' }: { nome: string; tam?: number; cor?: string }) {
  const p = nome.trim().split(/\s+/);
  const ini = p.length > 1 ? p[0][0] + p[p.length - 1][0] : (p[0] ?? '?').slice(0, 2);
  return (
    <span
      title={nome}
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{ width: tam, height: tam, background: cor, fontSize: Math.max(8, Math.round(tam * 0.36)) }}
    >
      {ini.toUpperCase()}
    </span>
  );
}

type BotaoTipo = 'pri' | 'sec' | 'enviar' | 'ok' | 'sm';
export function Botao({
  children,
  href,
  tipo = 'sec',
  className = '',
}: {
  children: ReactNode;
  href?: string;
  tipo?: BotaoTipo;
  className?: string;
}) {
  const estilos: Record<BotaoTipo, string> = {
    pri: 'bg-[#111113] text-white border-[#111113] hover:bg-[#2C2C30]',
    sec: 'bg-white text-[#111113] border-[#D6D6D9] hover:bg-[#F4F4F5]',
    enviar: 'bg-[#2E7D4F] text-white border-[#2E7D4F] hover:bg-[#256641]', // só pra mandar pro cliente
    ok: 'bg-[#D8EDCF] text-[#2E5520] border-[#D8EDCF]',
    sm: 'bg-white text-[#111113] border-[#D6D6D9] hover:bg-[#F4F4F5] !px-3 !py-1.5 !text-[12px]',
  };
  const cls = `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[11px] border px-3.5 py-2 text-[13px] font-extrabold transition ${estilos[tipo]} ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

// ---------------------------------------------------------------- página
export function Pagina({ children }: { children: ReactNode }) {
  return <main className="lud-admin mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 py-7 sm:px-8">{children}</main>;
}

export function Cabecalho({
  eyebrow,
  titulo,
  sub,
  acoes,
  voltar,
}: {
  eyebrow?: ReactNode;
  titulo: ReactNode;
  sub?: ReactNode;
  acoes?: ReactNode;
  voltar?: { rotulo: string; href: string };
}) {
  return (
    <header className="flex flex-col gap-1">
      {voltar && (
        <Link href={voltar.href} className="text-[12.5px] text-[#636369] hover:text-[#111113]">
          ← {voltar.rotulo}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && <span className="text-[12.5px] font-bold text-[#46464B]">{eyebrow}</span>}
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-[#111113]">{titulo}</h1>
          {sub && <p className="max-w-[70ch] text-[13.5px] text-[#46464B]">{sub}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </header>
  );
}

export type Kpi = { rotulo: string; valor: ReactNode; sub?: ReactNode; st?: St; href?: string };
export function Kpis({ itens }: { itens: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map((k, i) => {
        const [bg, fg] = k.st ? ST[k.st] : ['#FFFFFF', '#111113'];
        const corpo = (
          <div
            className={`flex h-full flex-col gap-1 rounded-[18px] p-4 ${k.st ? '' : 'border border-[#E9E9EB]'}`}
            style={{ background: bg, color: fg }}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-90">{k.rotulo}</span>
            <b className="text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{k.valor}</b>
            {k.sub && <span className="text-[12.5px] opacity-90">{k.sub}</span>}
          </div>
        );
        return k.href ? (
          <Link key={i} href={k.href}>
            {corpo}
          </Link>
        ) : (
          <div key={i}>{corpo}</div>
        );
      })}
    </div>
  );
}

/** Barra dividida por estados (sem degradê). */
export function Barra({ partes, altura = 8 }: { partes: { st: St; valor: number }[]; altura?: number }) {
  const tot = partes.reduce((s, p) => s + p.valor, 0) || 1;
  return (
    <span className="flex gap-[2px] overflow-hidden rounded-full bg-[#F4F4F5]" style={{ height: altura }}>
      {partes
        .filter((p) => p.valor > 0)
        .map((p, i) => (
          <span
            key={i}
            style={{ width: `${(100 * p.valor) / tot}%`, background: p.st === 'neu' ? '#E9E9EB' : ST[p.st][2] }}
          />
        ))}
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#D6D6D9] px-4 py-5 text-center text-[13px] text-[#636369]">
      {children}
    </div>
  );
}

/** Duas colunas: conteúdo + lateral fixa. Empilha no celular. */
export function DuasColunas({ esq, dir, larguraDir = 340 }: { esq: ReactNode; dir: ReactNode; larguraDir?: number }) {
  return (
    <div className="grid grid-cols-1 items-start gap-[18px] lg:[grid-template-columns:minmax(0,1fr)_var(--ld)]" style={{ ['--ld' as any]: `${larguraDir}px` }}>
      <div className="flex min-w-0 flex-col gap-[18px]">{esq}</div>
      <div className="flex min-w-0 flex-col gap-[18px]">{dir}</div>
    </div>
  );
}

/** Formata AAAA-MM-DD como "qua, 22/10" no fuso de São Paulo. */
export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return 'sem data';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00-03:00' : iso);
  const dia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(d).replace('.', '');
  const dm = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d);
  return `${dia}, ${dm}`;
}

/** Hoje (AAAA-MM-DD) no fuso de São Paulo. */
export function hojeSP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function somaDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Em que aba uma data cai: atrasada, hoje, amanhã ou depois. */
export type Janela = 'atr' | 'hoje' | 'amanha' | 'depois';
export function janelaDaData(iso: string | null | undefined, hoje = hojeSP()): Janela {
  if (!iso) return 'depois';
  const d = iso.slice(0, 10);
  if (d < hoje) return 'atr';
  if (d === hoje) return 'hoje';
  if (d === somaDias(hoje, 1)) return 'amanha';
  return 'depois';
}

/** Rótulo curto da data relativa: "ontem", "hoje", "amanhã", "qui, 23/10". */
export function rotuloData(iso: string | null | undefined, hoje = hojeSP()): { texto: string; st: St } {
  if (!iso) return { texto: 'sem data', st: 'neu' };
  const d = iso.slice(0, 10);
  if (d === somaDias(hoje, -1)) return { texto: 'ontem', st: 'atr' };
  if (d < hoje) return { texto: dataCurta(d).split(', ')[1], st: 'atr' };
  if (d === hoje) return { texto: 'hoje', st: 'hoje' };
  if (d === somaDias(hoje, 1)) return { texto: 'amanhã', st: 'cheg' };
  return { texto: dataCurta(d), st: 'neu' };
}
