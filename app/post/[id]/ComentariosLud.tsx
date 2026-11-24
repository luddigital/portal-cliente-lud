'use client';

import { useState } from 'react';
import type { NotaHistorico } from '@/lib/historico-post';

/**
 * Comentários do post num card só, largura total, com 2 abas. As duas conversas ficam no post do Notion:
 *   - Com o cliente → "💬 email" (aparece no histórico com o cliente)
 *   - Nota interna  → "🔒 Nota interna · email" (só a equipe; o portal nunca mostra pro cliente)
 */
export function ComentariosLud({ postId, notas = [], cronologico = false, abaInicial = 'cliente' }: { postId: string; tarefaId?: string | null; notas?: NotaHistorico[]; cronologico?: boolean; abaInicial?: 'cliente' | 'interna' }) {
  const [aba, setAba] = useState<'cliente' | 'interna'>(abaInicial);
  const doCliente = notas.filter((n) => TIPOS_CLIENTE.has(n.tipo));
  const internas = notas.filter((n) => n.tipo === 'interna');
  const abas = [
    { id: 'cliente' as const, rotulo: 'Com o cliente', n: doCliente.length, cor: 'var(--cal-agendado)', dica: 'cliente vê' },
    { id: 'interna' as const, rotulo: 'Nota interna', n: internas.length, cor: 'var(--prazo-hoje)', dica: 'só a equipe' },
  ];
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(21,21,33,0.06)] px-4">
        <div className="flex items-center gap-1" role="tablist">
          <h3 className="mr-3 py-3 text-[15px] font-semibold text-ink">Comentários</h3>
          {abas.map((x) => {
            const on = aba === x.id;
            return (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setAba(x.id)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-[13px] font-semibold transition ${on ? '' : 'border-transparent text-t3 hover:text-ink'}`}
                style={on ? { borderColor: x.cor, color: x.cor } : undefined}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: x.cor, opacity: on ? 1 : 0.5 }} />
                {x.rotulo}
                {x.n > 0 && <span className="rounded-full bg-[rgba(21,21,33,0.06)] px-1.5 text-[11px] font-bold text-t2">{x.n}</span>}
              </button>
            );
          })}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${aba === 'interna' ? 'bg-[var(--prazo-hoje)] text-white' : 'border border-[rgba(59,103,137,0.3)] bg-white text-[var(--cal-agendado)]'}`}
        >
          {aba === 'interna' ? 'só a equipe' : 'cliente vê'}
        </span>
      </div>
      {/* As duas ficam montadas: trocar de aba não perde o que estava escrito. */}
      <div className={aba === 'cliente' ? '' : 'hidden'}>
        <Painel postId={postId} interno={false} notas={doCliente} cronologico={cronologico} />
      </div>
      <div className={aba === 'interna' ? 'bg-[var(--prazo-hoje-soft)]/30' : 'hidden'}>
        <Painel postId={postId} interno notas={internas} cronologico={cronologico} />
      </div>
    </section>
  );
}

const TIPOS_CLIENTE = new Set<NotaHistorico['tipo']>(['cliente_comentou', 'cliente_alteracao', 'equipe']);

export function quandoNota(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(d);
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const hora = fmt({ hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  if (dia === hoje) return `hoje ${hora}`;
  return `${dia.slice(8)}/${dia.slice(5, 7)} ${hora}`;
}

/** Quem escreveu: Luiza, a pessoa da equipe ou "Cliente". */
export function autorDaNota(n: NotaHistorico): string {
  if (n.tipo === 'cliente_comentou' || n.tipo === 'cliente_alteracao') return 'Cliente';
  if (!n.autor) return 'Equipe';
  if (n.autor === 'oi@lud.digital') return 'Luiza';
  return n.autor.split('@')[0];
}

function Painel({ postId, interno, notas, cronologico = false }: { postId: string; interno: boolean; notas: NotaHistorico[]; cronologico?: boolean }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novas, setNovas] = useState<NotaHistorico[]>([]);
  const lista = [...novas, ...notas].sort((a, b) => (cronologico ? a.quando.localeCompare(b.quando) : b.quando.localeCompare(a.quando)));

  async function enviar() {
    if (texto.trim().length < 2) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/post/${postId}/comentar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: texto.trim(), interno }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`);
      setNovas((n) => [j.nota, ...n]);
      setTexto('');
    } catch (e: any) {
      setErro(e?.message ?? 'Não consegui salvar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2.5 p-4">
        {lista.length === 0 ? (
          <p className="text-[11.5px] leading-[1.5] text-t3">
            {interno ? 'Anotações da equipe: decisões, contexto, pendências. O cliente não vê.' : 'Conversa com o cliente sobre esse post. Fica no post do Notion e no histórico.'}
          </p>
        ) : (
          <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
            {lista.map((n) => (
              <div key={n.id} className="rounded-[12px] bg-white/80 px-3 py-2 text-[12.5px] ring-1 ring-[rgba(21,21,33,0.06)]">
                <b style={{ color: n.tipo === 'cliente_comentou' || n.tipo === 'cliente_alteracao' ? 'var(--cal-agendado)' : undefined }}>{autorDaNota(n)}</b>{' '}
                <span className="text-t3">· {quandoNota(n.quando)}</span>
                <p className="mt-0.5 whitespace-pre-line text-ink">{n.corpo || n.titulo}</p>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviar();
          }}
          rows={3}
          placeholder={interno ? 'Ex.: cliente pediu pra não usar imagem de bebida alcoólica nesse projeto.' : 'Ex.: subimos a nova versão com o corte do reels ajustado.'}
          className="w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] leading-[1.5] text-ink outline-none focus:border-ink"
          disabled={enviando}
        />
        {erro && <p className="rounded-md bg-[var(--prazo-atrasado-soft)] px-2 py-1 text-[11px] text-[var(--prazo-atrasado)]">{erro}</p>}
        {texto.trim().length >= 2 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition disabled:opacity-40 ${interno ? 'border border-[var(--prazo-hoje)] bg-white text-[var(--prazo-hoje)] hover:bg-[var(--prazo-hoje-soft)]' : 'bg-ink text-white hover:opacity-90'}`}
            >
              {enviando ? 'Salvando…' : interno ? 'Salvar nota' : 'Comentar no post'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
