import Link from 'next/link';
import { listAtualizacoesRecentes, type AtualizacaoRecente } from '@/lib/notion';

function tempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'agora';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const sem = Math.floor(d / 7);
  if (sem < 4) return `${sem}sem`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function dataAbsoluta(iso: string): string {
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = d
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes} ${hh}:${mm}`;
}

/** Mapeia o nome do status numa cor — sem precisar bater 1:1 com o Notion. */
function corDoStatus(status: string | null): {
  bg: string;
  txt: string;
} {
  const s = (status ?? '').toLowerCase();
  if (s.includes('aprovad') || s.includes('ok do cliente')) {
    return { bg: 'var(--prazo-em-dia-soft)', txt: 'var(--prazo-em-dia)' };
  }
  if (s.includes('publicad') || s.includes('no ar')) {
    return { bg: '#E3F5E8', txt: '#2F7A47' };
  }
  if (s.includes('aguard') || s.includes('aprovação') || s.includes('aprovacao')) {
    return { bg: 'var(--cal-aprovacao-soft)', txt: 'var(--cal-aprovacao)' };
  }
  if (s.includes('produ') || s.includes('andamento')) {
    return { bg: '#FFF4DA', txt: '#B07A14' };
  }
  if (s.includes('alteraç') || s.includes('alterac') || s.includes('ajuste')) {
    return { bg: 'var(--cal-alteracao-soft)', txt: 'var(--cal-alteracao)' };
  }
  if (s.includes('agendad') || s.includes('programad')) {
    return { bg: 'var(--cal-agendado-soft)', txt: 'var(--cal-agendado)' };
  }
  return { bg: 'var(--bgSoft)', txt: 'var(--t2)' };
}

function IconeEdicao() {
  return (
    <span
      className="mt-[1px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
      style={{ background: 'var(--cal-agendado-soft)', color: 'var(--cal-agendado)' }}
      aria-hidden
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </span>
  );
}

function IconeComentario() {
  return (
    <span
      className="mt-[1px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
      style={{ background: 'var(--cal-alteracao-soft)', color: 'var(--cal-alteracao)' }}
      aria-hidden
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z" />
      </svg>
    </span>
  );
}

function IconeTarefa() {
  return (
    <span
      className="mt-[1px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
      style={{ background: 'var(--prazo-em-dia-soft)', color: 'var(--prazo-em-dia)' }}
      aria-hidden
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h13M3 12h13M3 19h9" />
        <path d="M18 17l2 2 4-4" />
      </svg>
    </span>
  );
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  const cor = corDoStatus(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: cor.bg, color: cor.txt }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: 'currentColor' }}
      />
      {status}
    </span>
  );
}

function LinhaAtualizacao({ a }: { a: AtualizacaoRecente }) {
  const corBarra =
    a.tipo === 'comentario'
      ? 'var(--cal-alteracao-soft)'
      : a.tipo === 'tarefa'
        ? 'var(--prazo-em-dia-soft)'
        : 'var(--cal-agendado-soft)';
  return (
    <Link
      href={`/post/${a.postId}`}
      className="flex items-start gap-3.5 px-4 py-3.5 transition hover:bg-bgSoft sm:px-5"
    >
      {/* Coluna da data — sempre à esquerda */}
      <div className="w-[58px] shrink-0 pt-[2px] text-right sm:w-[80px]">
        <div className="text-[12px] font-semibold text-ink tabular-nums">
          {tempoRelativo(a.quando)}
        </div>
        <div className="mt-0.5 hidden font-mono text-[10px] text-t3 sm:block">
          {dataAbsoluta(a.quando)}
        </div>
      </div>

      {/* Barra vertical separadora */}
      <div
        className="w-[3px] self-stretch rounded-full"
        style={{ background: corBarra }}
      />

      {a.tipo === 'comentario' ? (
        <IconeComentario />
      ) : a.tipo === 'tarefa' ? (
        <IconeTarefa />
      ) : (
        <IconeEdicao />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink">
          {a.postTitulo}
        </div>
        {a.projetoNome && (
          <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            {a.projetoNome}
          </div>
        )}
        <div className="mt-1.5 text-[13px] leading-snug">
          {a.tipo === 'comentario' ? (
            <span className="text-ink">💬 {a.resumo}</span>
          ) : a.tipo === 'tarefa' ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-ink">
                {a.tarefaTitulo}
              </span>
              {a.tarefaStatus && (
                <>
                  <span className="text-t3">→</span>
                  <StatusPill status={a.tarefaStatus} />
                </>
              )}
            </span>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusPill status={a.statusGeral ?? a.status} />
              <span className="text-[11px] text-t3">post atualizado</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export async function AtualizacoesRecentes({ limit = 15 }: { limit?: number } = {}) {
  const itens = await listAtualizacoesRecentes(limit);
  if (itens.length === 0) {
    return (
      <p className="text-[13px] text-t3">
        Sem atualizações recentes em posts.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(21,21,33,0.08)] bg-white">
      {itens.map((a, i) => (
        <div
          key={a.id}
          className={
            i > 0 ? 'border-t border-[rgba(21,21,33,0.05)]' : undefined
          }
        >
          <LinhaAtualizacao a={a} />
        </div>
      ))}
    </div>
  );
}
