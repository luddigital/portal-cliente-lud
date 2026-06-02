import Link from 'next/link';
import { listAtualizacoesRecentes, type AtualizacaoRecente } from '@/lib/notion';

function tempoDesde(iso: string): string {
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

function IconeEvento({ tipo }: { tipo: AtualizacaoRecente['tipo'] }) {
  if (tipo === 'comentario') {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--cal-alteracao-soft)', color: 'var(--cal-alteracao)' }}
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{ background: 'var(--cal-agendado-soft)', color: 'var(--cal-agendado)' }}
      aria-hidden
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </span>
  );
}

function LinhaAtualizacao({ a }: { a: AtualizacaoRecente }) {
  return (
    <Link
      href={`/post/${a.postId}`}
      className="flex items-start gap-3 rounded-xl border border-[rgba(21,21,33,0.06)] bg-white px-3 py-2.5 transition hover:border-navy/30 hover:bg-bgSoft"
    >
      <IconeEvento tipo={a.tipo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink">
              {a.postTitulo}
            </div>
            {a.projetoNome && (
              <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                {a.projetoNome}
              </div>
            )}
          </div>
          <span className="shrink-0 text-[10px] font-mono text-t3">
            {tempoDesde(a.quando)}
          </span>
        </div>
        <p
          className={`mt-1 text-[12px] leading-snug ${
            a.tipo === 'comentario' ? 'text-ink' : 'text-t2'
          }`}
        >
          {a.tipo === 'comentario' ? (
            <>
              <span className="text-t3">💬 </span>
              {a.resumo}
            </>
          ) : (
            a.resumo
          )}
        </p>
      </div>
    </Link>
  );
}

export async function AtualizacoesRecentes() {
  const itens = await listAtualizacoesRecentes(15);
  if (itens.length === 0) {
    return (
      <p className="text-[13px] text-t3">
        Sem atualizações recentes em posts.
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {itens.map((a) => (
        <LinhaAtualizacao key={a.id} a={a} />
      ))}
    </div>
  );
}
