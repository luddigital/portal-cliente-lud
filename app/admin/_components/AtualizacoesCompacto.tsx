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

/** Mapeia o nome do status numa cor — sem precisar bater 1:1 com o Notion. */
function corDoStatus(status: string | null): { bg: string; txt: string } {
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

function IconeMini({ tipo }: { tipo: AtualizacaoRecente['tipo'] }) {
  const cor =
    tipo === 'comentario'
      ? { bg: 'var(--cal-alteracao-soft)', fg: 'var(--cal-alteracao)' }
      : tipo === 'tarefa'
        ? { bg: 'var(--prazo-em-dia-soft)', fg: 'var(--prazo-em-dia)' }
        : { bg: 'var(--cal-agendado-soft)', fg: 'var(--cal-agendado)' };
  return (
    <span
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
      style={{ background: cor.bg, color: cor.fg }}
      aria-hidden
    >
      {tipo === 'comentario' ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z" />
        </svg>
      ) : tipo === 'tarefa' ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h13M3 12h13M3 19h9" />
          <path d="M18 17l2 2 4-4" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      )}
    </span>
  );
}

function StatusPillMini({ status }: { status: string | null }) {
  if (!status) return null;
  const cor = corDoStatus(status);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold"
      style={{ background: cor.bg, color: cor.txt }}
    >
      <span
        className="inline-block h-[5px] w-[5px] rounded-full"
        style={{ background: 'currentColor' }}
      />
      {status}
    </span>
  );
}

function LinhaCompacto({ a }: { a: AtualizacaoRecente }) {
  return (
    <Link
      href={`/post/${a.postId}`}
      className="flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-bgSoft"
    >
      <span className="w-[48px] shrink-0 text-right text-[11px] font-semibold tabular-nums text-t3">
        {tempoRelativo(a.quando)}
      </span>
      <IconeMini tipo={a.tipo} />
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
        <span className="min-w-0 shrink truncate font-medium text-ink">
          {a.postTitulo}
        </span>
        {a.projetoNome && (
          <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-t3 sm:inline">
            · {a.projetoNome}
          </span>
        )}
        {a.tipo === 'comentario' ? (
          <span className="hidden min-w-0 shrink truncate text-[12px] text-t2 sm:inline">
            — {a.resumo}
          </span>
        ) : a.tipo === 'tarefa' ? (
          // Mostra '<tarefa> → <próxima tarefa>'. Ex: 'Aprovação | Arte → Copy'
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-t2 sm:inline-flex">
            {a.tarefaTitulo}
            <span className="text-t3">→</span>
            {a.proximaTarefa ? (
              <span className="font-medium text-ink">{a.proximaTarefa}</span>
            ) : (
              <StatusPillMini status={a.statusGeral ?? a.status} />
            )}
          </span>
        ) : (
          <StatusPillMini status={a.statusGeral ?? a.status} />
        )}
      </div>
    </Link>
  );
}

export async function AtualizacoesCompacto() {
  const itens = await listAtualizacoesRecentes(5);
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
            Atualizações recentes
          </h2>
          <p className="mt-0.5 text-[13px] text-t2">
            Últimas mudanças nos posts.
          </p>
        </div>
        <Link
          href="/admin/notificacoes"
          className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-navy hover:underline"
        >
          Ver todas →
        </Link>
      </div>

      {itens.length === 0 ? (
        <p className="mt-3 text-[13px] text-t3">
          Sem atualizações recentes em posts.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-[rgba(21,21,33,0.08)] bg-white">
          {itens.map((a, i) => (
            <div
              key={a.id}
              className={
                i > 0 ? 'border-t border-[rgba(21,21,33,0.05)]' : undefined
              }
            >
              <LinhaCompacto a={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
