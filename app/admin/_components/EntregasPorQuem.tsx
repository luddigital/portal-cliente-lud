'use client';

import Link from 'next/link';
import type { CardEntrega, NivelPrazo } from '@/lib/visao-projeto';

/**
 * Entregas pendentes no formato "opção E" (aprovado no mapa do portal): os
 * cards do dashboard, separados em duas colunas — o que está com a Lud. e o
 * que está com o cliente. A cor do card é o prazo, em cor cheia (sem pastel):
 * vinho atrasado, salmão hoje ou em até 2 dias, branco com folga. Usado
 * no dashboard (/admin) e na página do projeto.
 */

const COR_PRAZO: Record<NivelPrazo, string> = {
  atrasado: 'var(--prazo-atrasado)',
  hoje: '#FFABAC',
  chegando: '#FFABAC',
  'em-dia': 'var(--prazo-em-dia)',
  sem: 'var(--prazo-tranquilo)',
};

/** Card pintado pelo prazo em cor cheia; com folga fica branco. */
type Pintura = {
  fundo: string;
  /** Cor do texto em cima do fundo. */
  texto: string;
  /** Texto secundário (etiqueta, linha do número). */
  suave: string;
  /** Caixinha dos posts. */
  caixa: string;
  tinto: boolean;
};
const BRANCO: Pintura = { fundo: '#FFFFFF', texto: 'var(--ink)', suave: 'var(--t2)', caixa: '#F5F5F7', tinto: false };
function pintura(n: NivelPrazo): Pintura {
  if (n === 'em-dia' || n === 'sem') return BRANCO;
  // Paleta da Lud.: vence logo (hoje e até 2 dias) = salmão com texto vinho escuro;
  // atrasado = vinho cheio com texto branco.
  if (n === 'hoje' || n === 'chegando') {
    return { fundo: '#FFABAC', texto: '#3A1D1E', suave: 'rgba(58,29,30,0.78)', caixa: 'rgba(255,255,255,0.4)', tinto: true };
  }
  return { fundo: 'var(--prazo-atrasado)', texto: '#FFFFFF', suave: 'rgba(255,255,255,0.88)', caixa: 'rgba(255,255,255,0.16)', tinto: true };
}

function nomesDosPosts(c: CardEntrega): { rotulo: string; texto: string } | null {
  const nomes = c.itens.map((i) => i.postTitulo).filter(Boolean);
  if (nomes.length === 0) return null;
  const tipo = /pauta/i.test(c.titulo) ? 'PAUTA' : 'POST';
  const rotulo = nomes.length === 1 ? tipo : `${nomes.length} ${tipo === 'PAUTA' ? 'PAUTAS' : 'POSTS'}`;
  const prim = nomes.slice(0, 2).map((n) => `“${n}”`);
  const resto = nomes.length - prim.length;
  const texto = resto > 0 ? `${prim.join(', ')} e mais ${resto}` : prim.join(' e ');
  return { rotulo, texto };
}

function Card({
  c,
  onAbrir,
  onAcao,
}: {
  c: CardEntrega;
  onAbrir?: (c: CardEntrega) => void;
  onAcao?: (c: CardEntrega) => void;
}) {
  const p = pintura(c.nivel);
  const posts = nomesDosPosts(c);
  // O card inteiro é clicável por uma camada por baixo; o botão fica por cima dela.
  const camada = c.href ? (
    <Link href={c.href} aria-label={`Abrir ${c.titulo}`} className="absolute inset-0 rounded-[18px]" />
  ) : (
    <button type="button" aria-label={`Abrir ${c.titulo}`} onClick={() => onAbrir?.(c)} className="absolute inset-0 rounded-[18px]" />
  );
  // Em card colorido o botão é branco (verde do envio no texto); no branco, verde cheio.
  const clsBotao = `relative z-10 shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-90 ${
    p.tinto
      ? c.comCliente
        ? 'bg-white text-[var(--prazo-em-dia)]'
        : 'bg-white text-ink'
      : c.comCliente
        ? 'bg-[var(--prazo-em-dia)] text-white'
        : 'bg-[#F2F2F4] text-ink'
  }`;
  return (
    <div
      className={`relative flex min-h-[150px] w-full min-w-0 flex-col gap-2 rounded-[18px] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(21,21,33,0.14)] ${
        p.tinto ? '' : 'border border-[rgba(21,21,33,0.08)]'
      }`}
      style={{ background: p.fundo, color: p.texto }}
    >
      {camada}
      <span
        className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: p.suave }}
      >
        {!p.tinto && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: COR_PRAZO[c.nivel] }} />}
        <span className="truncate">{c.tag}</span>
      </span>
      <span className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em]">{c.titulo}</span>
      {posts && (
        <span className="flex flex-col gap-0.5 rounded-[10px] px-2.5 py-2" style={{ background: p.caixa }}>
          <span className="text-[10px] font-bold tracking-[0.06em]" style={{ color: p.suave }}>
            {posts.rotulo}
          </span>
          <span className="line-clamp-2 text-[12.5px] font-semibold italic leading-snug">{posts.texto}</span>
        </span>
      )}
      <span className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[28px] font-bold leading-none tracking-[-0.03em]">{c.n}</span>
          <span className="truncate whitespace-nowrap text-[12px]" style={{ color: p.suave }}>
            {c.sub}
          </span>
        </span>
        {onAcao ? (
          <button type="button" onClick={() => onAcao(c)} className={clsBotao}>
            {c.acao}
          </button>
        ) : (
          <span className={`${clsBotao} pointer-events-none`}>{c.acao}</span>
        )}
      </span>
    </div>
  );
}

export function EntregasPorQuem({
  cards,
  rotuloCliente = 'Com o cliente',
  onAbrir,
  onAcao,
  vazio = 'Nada pendente. ✨',
}: {
  cards: CardEntrega[];
  /** "Com a Edi", "Com o cliente"… */
  rotuloCliente?: string;
  /** Clique no card que não tem href (página do projeto abre o post). */
  onAbrir?: (c: CardEntrega) => void;
  /** Clique no botão do card. Sem isso, o botão é só visual (o card é o link). */
  onAcao?: (c: CardEntrega) => void;
  vazio?: string;
}) {
  const colunas = [
    { titulo: 'Com a Lud.', sub: 'faço eu', cards: cards.filter((c) => !c.comCliente) },
    { titulo: rotuloCliente, sub: 'cobrar', cards: cards.filter((c) => c.comCliente) },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-t2">
        <span>A cor do card é o prazo:</span>
        {(
          [
            ['atrasado', 'atrasado'],
            ['chegando', 'hoje ou em até 2 dias'],
            ['em-dia', 'com folga'],
          ] as [NivelPrazo, string][]
        ).map(([n, t]) => (
          <span key={n} className="inline-flex items-center gap-1.5">
            <span
              className={`h-3 w-4 rounded-[4px] ${pintura(n).tinto ? '' : 'border border-[rgba(21,21,33,0.25)]'}`}
              style={{ background: pintura(n).fundo }}
            />
            {t}
          </span>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {colunas.map((col) => (
          <div key={col.titulo} className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[16px] font-semibold text-ink">{col.titulo}</span>
              <span className="text-[13px] text-t2">
                {col.sub} · {col.cards.length} {col.cards.length === 1 ? 'entrega' : 'entregas'}
              </span>
            </div>
            {col.cards.length === 0 ? (
              <p className="rounded-[18px] border border-dashed border-[rgba(21,21,33,0.12)] px-4 py-6 text-center text-[13px] text-t2">
                {vazio}
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {col.cards.map((c) => (
                  <Card key={c.chave} c={c} onAbrir={onAbrir} onAcao={onAcao} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
