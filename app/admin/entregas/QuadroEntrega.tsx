import Link from 'next/link';
import { rotas } from '@/lib/rotas';
import { BotaoLembreteWpp } from '../aprovacoes/BotaoLembreteWpp';
import { LinkPrevia } from '../_components/LinkPrevia';
import { ContornoVerde } from '../_ui/ContornoVerde';
import { Avatar, Card, Ponto, Selo, ST, Tag, type St } from '../_ui/lud';
import type { Coluna, LinhaCliente, QuadroEntrega } from './quadro';

/**
 * Card de uma entrega no quadro "Entregas · todos os clientes": título, dia,
 * quem faz, contadores e as três colunas (Atrasado / Atual / Próxima entrega) com os
 * clientes dentro. Cada cliente leva pra entrega do projeto dele.
 */

const FUNDO_COLUNA: Record<Coluna['id'], string> = { atr: '#FDF1EF', atu: '#FDF1F6', dep: '#F6F4FE' };
const PONTO_COLUNA: Record<Coluna['id'], St> = { atr: 'atr', atu: 'hoje', dep: 'cheg' };
const VAZIO_COLUNA: Record<Coluna['id'], string> = { atr: 'nada atrasado ✓', atu: 'nada nesta rodada', dep: 'nada previsto' };

function Acao({ q, l, col }: { q: QuadroEntrega; l: LinhaCliente; col: Coluna['id'] }) {
  if (col === 'dep' || !l.tarefaId) return null;
  if (q.tipo === 'cliente') {
    // Lembrete pronto e editável; vai só pro grupo do cliente.
    return (
      <ContornoVerde>
        <BotaoLembreteWpp tarefaId={l.tarefaId} clienteNome={l.clienteNome} rotulo="Lembrar" verde />
      </ContornoVerde>
    );
  }
  return (
    <Link
      href={rotas.entregaDoProjeto(l.projetoId, q.id)}
      className="whitespace-nowrap rounded-[9px] border border-[#D6D6D9] bg-white px-2.5 py-1 text-[11.5px] font-extrabold text-[#111113] hover:bg-[#F4F4F5]"
    >
      {q.tipo === 'envio' ? 'Enviar' : 'Abrir'}
    </Link>
  );
}

const MAX_POSTS = 4;

function Linha({ q, l, col }: { q: QuadroEntrega; l: LinhaCliente; col: Coluna['id'] }) {
  const href = l.projetoId ? rotas.entregaDoProjeto(l.projetoId, q.id) : undefined;
  const resto = l.posts.length - MAX_POSTS;
  return (
    <div className="flex flex-col rounded-[12px] border border-[#E9E9EB] bg-white px-3 pb-2.5 pt-1">
      {/* Títulos dos posts primeiro; cada um abre a prévia (e de lá "Abrir completo"). */}
      {l.posts.length > 0 ? (
        <ul className="flex flex-col">
          {l.posts.slice(0, MAX_POSTS).map((p) => (
            <li key={p.id} className="border-t border-[#F0F0F2] first:border-t-0">
              <LinkPrevia postId={p.id} tarefaId={p.tarefaId} className="group block py-[7px]">
                <h1 className="truncate !text-[13px] !font-bold !leading-snug !tracking-normal text-[#111113] group-hover:underline">
                  {p.titulo}
                </h1>
              </LinkPrevia>
            </li>
          ))}
          {resto > 0 && href && (
            <li className="border-t border-[#F0F0F2] py-[7px]">
              <Link href={href} className="text-[12px] font-bold text-[#46464B] hover:underline">
                + {resto} {resto === 1 ? 'post' : 'posts'}
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <span className="truncate py-[7px] text-[13px] font-bold">
          {href ? (
            <Link href={href} className="hover:underline">
              {l.qtd} {l.unidade}
            </Link>
          ) : (
            `${l.qtd} ${l.unidade}`
          )}
        </span>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-[#E9E9EB] pt-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Selo handle={l.handle} href={l.projetoId ? rotas.projeto(l.projetoId) : undefined} />
          {l.tag && <Tag st={l.tag.st} className="!min-w-0 !text-[10.5px]">{l.tag.texto}</Tag>}
          {l.detalhe && l.posts.length > 0 && <span className="hidden truncate text-[11.5px] text-[#636369] xl:inline">{l.detalhe}</span>}
        </span>
        <Acao q={q} l={l} col={col} />
      </div>
    </div>
  );
}

function ColunaQuadro({ q, c }: { q: QuadroEntrega; c: Coluna }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[16px] p-2.5" style={{ background: FUNDO_COLUNA[c.id] }}>
      <div className="flex items-center justify-between px-1 py-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <Ponto st={PONTO_COLUNA[c.id]} />
          <b className="text-[13px]">{c.rotulo}</b>
          <span className="truncate text-[12px] text-[#636369]">{c.periodo}</span>
        </span>
        <span className="text-[12px] font-extrabold text-[#46464B]">{c.linhas.length}</span>
      </div>
      {c.linhas.length === 0 ? (
        <span className="rounded-[12px] border-[1.5px] border-dashed border-[#D6D6D9] p-2.5 text-center text-[12px] text-[#636369]">
          {VAZIO_COLUNA[c.id]}
        </span>
      ) : (
        c.linhas.map((l) => <Linha key={l.projetoId || l.handle} q={q} l={l} col={c.id} />)
      )}
    </div>
  );
}

export function CardQuadroEntrega({ q, comLink = true }: { q: QuadroEntrega; comLink?: boolean }) {
  const [atr, atu, dep] = q.colunas;
  const nAtr = atr.linhas.length;
  const nAtu = atu.linhas.length;
  const nDep = dep.linhas.length;
  return (
    <Card pad="p-5" className="!gap-3.5">
      <div id={`ent-${q.id}`} className="flex scroll-mt-6 flex-wrap items-center justify-between gap-2.5">
        <span className="flex flex-wrap items-center gap-2.5">
          {comLink ? (
            <Link href={rotas.entrega(q.id)} className="text-[18px] font-extrabold tracking-[-0.01em] hover:underline">
              {q.nome}
            </Link>
          ) : (
            <b className="text-[18px] font-extrabold tracking-[-0.01em]">{q.nome}</b>
          )}
          <span className="rounded-full bg-[#F4F4F5] px-2.5 py-[3px] text-[12.5px] font-bold text-[#46464B]">{q.diaRotulo}</span>
          {q.pessoas.length > 0 && (
            <span className="flex -space-x-1.5">
              {q.pessoas.slice(0, 4).map((p) => (
                <span key={p} className="rounded-full ring-2 ring-white">
                  <Avatar nome={p} tam={22} />
                </span>
              ))}
            </span>
          )}
          {q.tipo === 'interna' && <span className="text-[12px] text-[#636369]">interna · sem mensagem pro cliente</span>}
          {q.tipo === 'envio' && <span className="text-[12px] text-[#636369]">envio pro cliente aprovar</span>}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Tag st={nAtr ? 'atr' : 'neu'}>
            {nAtr} {nAtr === 1 ? 'cliente atrasado' : 'clientes atrasados'}
          </Tag>
          <Tag st={nAtu ? 'hoje' : 'neu'}>{nAtu} {nAtu === 1 ? 'cliente' : 'clientes'} nesta rodada</Tag>
          <Tag st={nDep ? 'cheg' : 'neu'}>{nDep} {nDep === 1 ? 'cliente' : 'clientes'} na próxima entrega</Tag>
        </span>
      </div>
      <div className="grid grid-cols-1 items-start gap-2.5 md:grid-cols-3">
        <ColunaQuadro q={q} c={atr} />
        <ColunaQuadro q={q} c={atu} />
        <ColunaQuadro q={q} c={dep} />
      </div>
    </Card>
  );
}

/** Faixa ANTES → AGORA → DEPOIS do topo. */
export function FaixaRodadas({
  blocos,
}: {
  blocos: { rotulo: string; periodo: string; valor: string; sub: string; st: St }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {blocos.map((b, i) => {
        const [bg, fg] = ST[b.st];
        return (
          <div key={b.rotulo} className="relative flex min-w-0 flex-col gap-1 rounded-[18px] px-[18px] py-4" style={{ background: bg, color: fg }}>
            {i < blocos.length - 1 && (
              <span className="absolute -right-[11px] top-1/2 z-[1] hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-[#E9E9EB] bg-white text-[11px] text-[#636369] md:flex">
                →
              </span>
            )}
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">{b.rotulo}</span>
              <span className="text-right text-[12px] font-bold">{b.periodo}</span>
            </span>
            <b className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">{b.valor}</b>
            <span className="text-[12.5px]">{b.sub}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Uma entrega que abre e fecha (detalhe por entrega em /admin/entregas).
 * Fechada: linha com nome, dia e contadores. Aberta: as três colunas.
 */
export function EntregaRecolhivel({ q, aberta = false }: { q: QuadroEntrega; aberta?: boolean }) {
  const [atr, atu, dep] = q.colunas;
  const nAtr = atr.linhas.length;
  const nAtu = atu.linhas.length;
  const nDep = dep.linhas.length;
  return (
    <details id={`ent-${q.id}`} open={aberta} className="group scroll-mt-6 rounded-[20px] border border-[#E9E9EB] bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2.5 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="text-[10px] text-[#8A8A90] transition-transform group-open:rotate-90">▶</span>
          <b className="text-[15.5px] font-extrabold tracking-[-0.01em] group-open:text-[18px]">{q.nome}</b>
          <span className="rounded-full bg-[#F4F4F5] px-2.5 py-[3px] text-[12px] font-bold text-[#46464B]">{q.diaRotulo}</span>
          {q.pessoas.length > 0 && (
            <span className="hidden -space-x-1.5 group-open:flex">
              {q.pessoas.slice(0, 4).map((p) => (
                <span key={p} className="rounded-full ring-2 ring-white">
                  <Avatar nome={p} tam={22} />
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {nAtr > 0 && <Tag st="atr">{nAtr} {nAtr === 1 ? 'cliente atrasado' : 'clientes atrasados'}</Tag>}
          {nAtu > 0 ? <Tag st="hoje">{nAtu === 1 ? 'falta 1 cliente' : `faltam ${nAtu} clientes`} nesta rodada</Tag> : <Tag st="ok">rodada em dia</Tag>}
          {nDep > 0 && <Tag st="cheg">{nDep} {nDep === 1 ? 'cliente' : 'clientes'} na próxima entrega</Tag>}
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#636369]">
          <span>
            {q.tipo === 'interna' ? 'interna · sem mensagem pro cliente' : q.tipo === 'envio' ? 'envio pro cliente aprovar' : 'esperando o cliente'}
          </span>
          <Link href={rotas.entrega(q.id)} className="font-extrabold text-[#111113] hover:underline">
            Abrir a entrega →
          </Link>
        </div>
        <div className="grid grid-cols-1 items-start gap-2.5 md:grid-cols-3">
          <ColunaQuadro q={q} c={atr} />
          <ColunaQuadro q={q} c={atu} />
          <ColunaQuadro q={q} c={dep} />
        </div>
      </div>
    </details>
  );
}
