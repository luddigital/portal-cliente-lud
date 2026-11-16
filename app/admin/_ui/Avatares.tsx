'use client';

import { useState } from 'react';

/**
 * Avatares e sinais iguais em todas as tabelas internas.
 *
 * - Projeto e pessoa são sempre círculos de 28px. Com foto, a foto; sem foto, iniciais
 *   num tom pastel fixo pra cada um (o mesmo nome dá sempre a mesma cor).
 *   Projeto: duas iniciais do @. Pessoa: a inicial do primeiro nome.
 * - Sinal: só bolinhas coloridas, sem texto (o detalhe fica no "title", ao passar o mouse).
 *   Verde = feito · vermelho = falta / atrasado · cinza = ainda não.
 */

const PASTEIS: [string, string][] = [
  ['#B9D3EC', '#2D4F7C'], // azul
  ['#D9CFF2', '#3E2F8F'], // lilás
  ['#F6CFCB', '#7E211C'], // salmão
  ['#F2D0EA', '#6A2B5F'], // rosa
  ['#E3F0B2', '#3F5A12'], // verde-limão
  ['#F5DDBF', '#6E3A0A'], // pêssego
  ['#CFEBDD', '#2F6B4F'], // menta
  ['#F1E1C8', '#7A4F1E'], // bege
  ['#DCDBF6', '#4B4AA8'], // lavanda
  ['#F6D6E2', '#A8476B'], // rosa-chá
];

/** Tom pastel fixo pra um nome (hash simples do texto). */
export function corPastel(nome: string): { bg: string; fg: string } {
  const s = nome.trim().toLowerCase().replace(/^@/, '');
  let h = 0;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
  const [bg, fg] = PASTEIS[h % PASTEIS.length];
  return { bg, fg };
}

/**
 * Duas iniciais do projeto. Pelo nome do projeto no Notion quando tem ("Descubra Paris" → DP);
 * senão, as duas primeiras letras do @.
 */
export function iniciaisDoProjeto(handle: string, nome?: string | null): string {
  const n = (nome ?? '').split('|')[0].replace(/[^\p{L}\s]/gu, ' ').trim();
  const palavras = n.split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÁ-Ú]/.test(p));
  if (palavras.length >= 2) return (palavras[0][0] + palavras[1][0]).toUpperCase();
  const h = handle.replace(/^@/, '').replace(/[^a-z]/gi, '');
  return h.slice(0, 2).toUpperCase() || '?';
}

function Circulo({ titulo, foto, texto, cor, tamanho = 28 }: { titulo: string; foto: string | null | undefined; texto: string; cor: { bg: string; fg: string }; tamanho?: number }) {
  const est = { width: tamanho, height: tamanho };
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" title={titulo} style={est} className="shrink-0 rounded-full object-cover ring-1 ring-[#EDEDEF]" />
  ) : (
    <span
      title={titulo}
      style={{ ...est, background: cor.bg, color: cor.fg, fontSize: texto.length > 1 ? 10.5 : 11 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-extrabold tracking-[-0.02em]"
    >
      {texto}
    </span>
  );
}

export function AvatarProjeto({ handle, nome, foto, tamanho }: { handle: string; nome?: string | null; foto?: string | null; tamanho?: number }) {
  const arroba = handle.startsWith('@') ? handle : `@${handle}`;
  return <Circulo titulo={arroba} foto={foto} texto={iniciaisDoProjeto(arroba, nome)} cor={corPastel(arroba)} tamanho={tamanho} />;
}

export function AvatarPessoa({ nome, foto, titulo, tamanho }: { nome: string; foto?: string | null; titulo?: string; tamanho?: number }) {
  return <Circulo titulo={titulo ?? nome} foto={foto} texto={nome.trim().charAt(0).toUpperCase() || '?'} cor={corPastel(nome)} tamanho={tamanho} />;
}

const COR_SINAL = {
  ok: { bg: '#E4EBDF', fg: '#2E5520', linha: '#9BCB8A' },
  atr: { bg: 'var(--prazo-atrasado-soft)', fg: 'var(--prazo-atrasado)', linha: '#F2B8B0' },
  off: { bg: '#F0F0F1', fg: '#8A8A90', linha: '#E2E2E5' },
};
/** dica = título da linha no detalhe; linhas = o que aconteceu (datas, quem, quantas vezes). */
export type Bolinha = { icone: string; dica: string; st: keyof typeof COR_SINAL; linhas?: string[] };

/**
 * Bolinhas do sinal, ligadas por um traço curto. Ao passar o mouse abre um cartão com o
 * detalhe de cada bolinha (posição fixa, pra não ser cortado pela tabela com rolagem).
 */
export function Sinal({ itens }: { itens: Bolinha[] }) {
  const [pos, setPos] = useState<{ x: number; y: number; baixo: boolean } | null>(null);
  if (!itens.length) return null;
  const abrir = (e: React.MouseEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const baixo = r.bottom + 220 < window.innerHeight;
    setPos({ x: Math.min(r.left, window.innerWidth - 300), y: baixo ? r.bottom + 6 : r.top - 6, baixo });
  };
  return (
    <span className="relative flex w-fit cursor-default items-center" onMouseEnter={abrir} onMouseLeave={() => setPos(null)}>
      {itens.map((b, k) => {
        const c = COR_SINAL[b.st];
        return (
          <span key={k} className="flex items-center">
            {k > 0 && <span className="h-[2px] w-3 shrink-0" style={{ background: c.linha }} />}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: c.bg, color: c.fg }}>
              {b.icone}
            </span>
          </span>
        );
      })}
      {pos && (
        <span
          className="fixed z-50 flex w-[280px] flex-col gap-2.5 rounded-[12px] border border-[#E9E9EB] bg-white p-3 text-left shadow-[0_8px_24px_rgba(17,17,19,0.14)]"
          style={{ left: pos.x, top: pos.y, transform: pos.baixo ? undefined : 'translateY(-100%)' }}
        >
          {itens.map((b, k) => {
            const c = COR_SINAL[b.st];
            return (
              <span key={k} className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]" style={{ background: c.bg, color: c.fg }}>
                  {b.icone}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <b className="text-[12.5px] font-bold" style={{ color: b.st === 'atr' ? 'var(--prazo-atrasado)' : '#111113' }}>
                    {b.dica}
                  </b>
                  {(b.linhas ?? []).map((l, j) => (
                    <span key={j} className="text-[12px] leading-[1.4] text-[#636369]">
                      {l}
                    </span>
                  ))}
                </span>
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}

/** Legenda pequena das cores do sinal. */
export function LegendaSinal() {
  return (
    <span className="hidden items-center gap-3 text-[12px] text-[#8A8A90] md:flex">
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2 w-2 rounded-full bg-[#9BCB8A]" />
        feito
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2 w-2 rounded-full bg-[#E8A39B]" />
        falta / atrasado
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2 w-2 rounded-full bg-[#D6D6D9]" />
        ainda não
      </span>
    </span>
  );
}

/** Cadeado da tarefa travada (o post ainda está numa etapa antes). Sempre no mesmo lugar, antes do status. */
export function Cadeado() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#D6D6D9] text-[11px]" aria-label="Travada" title="Travada: o post ainda está numa etapa antes">
      🔒
    </span>
  );
}
