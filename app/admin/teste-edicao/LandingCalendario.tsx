'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { criarPautaNaData } from './actions';

const LS_CLIENTE = 'lud:sandbox:clienteId';
const LS_PROJETO = 'lud:sandbox:projetoId';

type Projeto = {
  id: string;
  nome: string;
  clienteId: string;
  clienteNome: string;
};

type PostChip = {
  id: string;
  projetoId: string;
  data: string;    // YYYY-MM-DD
  titulo: string;
  cor: 'publicado' | 'agendado' | 'aprovacao' | 'alteracao' | 'aguardando' | 'rascunho';
};

const COR_CHIP: Record<PostChip['cor'], { bg: string; fg: string; dot: string }> = {
  publicado:  { bg: '#E4EBDF', fg: '#3B4A33', dot: '#3B4A33' },
  agendado:   { bg: '#DCE8F3', fg: '#436F95', dot: '#436F95' },
  aprovacao:  { bg: '#E8EBF5', fg: '#313D65', dot: '#313D65' },
  alteracao:  { bg: '#FFD5D6', fg: '#642223', dot: '#642223' },
  aguardando: { bg: '#FFD5D6', fg: '#642223', dot: '#642223' },
  rascunho:   { bg: '#EEF0F4', fg: '#6A7464', dot: '#6A7464' },
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '·';
}

export function LandingCalendario({
  projetos,
  posts,
  ano,
  mes,
  clienteId,
  projetoId,
  hojeISO,
}: {
  projetos: Projeto[];
  posts: PostChip[];
  ano: number;
  mes: number;        // 0-11
  clienteId: string | null;
  projetoId: string | null;
  hojeISO: string;
}) {
  const [pendingDia, setPendingDia] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Restaura cliente/projeto do localStorage se a URL veio vazia
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (clienteId) {
      // Persiste a escolha atual pra próxima vez
      window.localStorage.setItem(LS_CLIENTE, clienteId);
      if (projetoId) window.localStorage.setItem(LS_PROJETO, projetoId);
      else window.localStorage.removeItem(LS_PROJETO);
      return;
    }
    // URL veio sem clienteId — tenta restaurar do storage
    const lsCliente = window.localStorage.getItem(LS_CLIENTE);
    if (lsCliente) {
      const lsProjeto = window.localStorage.getItem(LS_PROJETO);
      const params = new URLSearchParams(window.location.search);
      params.set('clienteId', lsCliente);
      if (lsProjeto) params.set('projetoId', lsProjeto);
      window.location.href = `/admin/teste-edicao?${params.toString()}`;
    }
  }, [clienteId, projetoId]);

  // Agrupa projetos por cliente
  const clientes = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; projetos: Projeto[] }>();
    for (const p of projetos) {
      const bucket = map.get(p.clienteId) ?? {
        id: p.clienteId, nome: p.clienteNome, projetos: [],
      };
      bucket.projetos.push(p);
      map.set(p.clienteId, bucket);
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [projetos]);

  const clienteAtual = clientes.find((c) => c.id === clienteId) ?? null;
  const projetosDoCliente = clienteAtual?.projetos ?? [];
  const projetoAtual = projetosDoCliente.find((p) => p.id === projetoId) ?? projetosDoCliente[0] ?? null;

  // Grid do mês (semana começa domingo)
  const dias = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const offsetInicio = primeiro.getDay(); // 0=dom
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    const total = Math.ceil((offsetInicio + ultimoDia) / 7) * 7;
    const arr: { data: Date; noMes: boolean; iso: string }[] = [];
    for (let i = 0; i < total; i++) {
      const dia = i - offsetInicio + 1;
      const data = new Date(ano, mes, dia);
      arr.push({ data, noMes: data.getMonth() === mes, iso: ymd(data) });
    }
    return arr;
  }, [ano, mes]);

  const postsPorDia = useMemo(() => {
    const m = new Map<string, PostChip[]>();
    for (const p of posts) {
      const list = m.get(p.data) ?? [];
      list.push(p);
      m.set(p.data, list);
    }
    return m;
  }, [posts]);

  function navParams(overrides: Record<string, string | null>): string {
    const params = new URLSearchParams();
    const base: Record<string, string | null> = {
      clienteId, projetoId, mes: `${ano}-${String(mes + 1).padStart(2, '0')}`,
    };
    for (const [k, v] of Object.entries({ ...base, ...overrides })) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `?${s}` : '';
  }

  function irParaMes(delta: number): string {
    const d = new Date(ano, mes + delta, 1);
    return navParams({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  }

  function criarNaData(iso: string) {
    if (!projetoAtual) return;
    setPendingDia(iso);
    const fd = new FormData();
    fd.set('projetoId', projetoAtual.id);
    fd.set('data', iso);
    startTransition(() => {
      criarPautaNaData(fd).catch((e) => {
        alert(`Erro: ${e.message}`);
        setPendingDia(null);
      });
    });
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div
        className="border-b px-6 py-2 text-[11px]"
        style={{
          background: 'var(--prazo-hoje-soft)',
          borderColor: 'var(--prazo-hoje)',
          color: 'var(--prazo-hoje)',
        }}
      >
        <div className="mx-auto max-w-2xl">
          🧪 <b>Sandbox</b> — cada card criado é uma pauta de verdade no Notion.
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 pt-8 space-y-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Sandbox
          </div>
          <h1 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-ink">
            Criar pauta pra testar
          </h1>
          <p className="text-[12px] text-t2 mt-1">
            Escolhe o cliente e clica num dia pra criar o card.
          </p>
        </div>

        {/* Cliente + Projeto */}
        <div className="card flex items-center gap-5 px-4 py-3 flex-wrap">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Cliente
            </div>
            <div className="mt-1 relative">
              <select
                value={clienteId ?? ''}
                onChange={(e) => {
                  const c = e.target.value;
                  window.location.href = c
                    ? `/admin/teste-edicao?clienteId=${c}`
                    : `/admin/teste-edicao`;
                }}
                className="appearance-none bg-transparent border-none pr-6 text-[13px] font-medium text-ink cursor-pointer focus:outline-none"
              >
                <option value="">— escolha —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[11px] text-t3">▾</span>
            </div>
          </div>

          {clienteAtual && projetosDoCliente.length > 0 && (
            <>
              <div className="self-stretch w-px bg-[rgba(21,21,33,0.08)]" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                  Projeto
                </div>
                {projetosDoCliente.length === 1 ? (
                  <div className="mt-1 text-[13px] font-medium text-ink">
                    {projetosDoCliente[0].nome}
                  </div>
                ) : (
                  <div className="mt-1 relative">
                    <select
                      value={projetoAtual?.id ?? ''}
                      onChange={(e) =>
                        window.location.href = `/admin/teste-edicao?clienteId=${clienteId}&projetoId=${e.target.value}`
                      }
                      className="appearance-none bg-transparent border-none pr-6 text-[13px] font-medium text-ink cursor-pointer focus:outline-none"
                    >
                      {projetosDoCliente.map((p) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[11px] text-t3">▾</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Calendário — só depois de escolher cliente */}
        {!clienteAtual ? (
          <div className="card p-8 text-center text-[13px] text-t2">
            👆 escolha um cliente pra ver o calendário
          </div>
        ) : !projetoAtual ? (
          <div className="card p-8 text-center text-[13px] text-t2">
            Esse cliente ainda não tem projeto ativo no Notion.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(21,21,33,0.06)]">
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
                {MESES[mes]} {ano}
              </div>
              <div className="flex gap-1">
                <Link
                  href={irParaMes(-1)}
                  className="w-7 h-7 border border-[rgba(21,21,33,0.1)] rounded-lg text-t2 hover:text-ink flex items-center justify-center text-[12px]"
                >‹</Link>
                <Link
                  href={irParaMes(1)}
                  className="w-7 h-7 border border-[rgba(21,21,33,0.1)] rounded-lg text-t2 hover:text-ink flex items-center justify-center text-[12px]"
                >›</Link>
              </div>
            </div>

            <div className="grid grid-cols-7 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3 px-1 pt-2">
              {WEEKDAYS.map((w) => (
                <div key={w} className="px-2 py-1.5">{w}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-[rgba(21,21,33,0.06)] border-t border-[rgba(21,21,33,0.06)]">
              {dias.map(({ data, noMes, iso }) => {
                const doMes = noMes;
                const postsHoje = postsPorDia.get(iso) ?? [];
                const ehHoje = iso === hojeISO;
                const loading = pendingDia === iso && isPending;

                if (!doMes) {
                  return (
                    <div key={iso} className="min-h-[78px] bg-bgSoft p-1.5">
                      <div className="text-[11px] font-mono text-t3">{data.getDate()}</div>
                    </div>
                  );
                }
                return (
                  <div
                    key={iso}
                    className="group min-h-[78px] bg-white p-1.5 flex flex-col gap-1 relative"
                    style={ehHoje ? { boxShadow: 'inset 0 0 0 1.5px var(--prazo-hoje)' } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="text-[11px] font-mono"
                        style={ehHoje ? { color: 'var(--prazo-hoje)', fontWeight: 700 } : { color: 'var(--t2)' }}
                      >
                        {data.getDate()}
                      </div>
                      {ehHoje && (
                        <div
                          className="text-[9px] font-semibold uppercase tracking-[0.04em]"
                          style={{ color: 'var(--prazo-hoje)' }}
                        >hoje</div>
                      )}
                    </div>
                    {postsHoje.slice(0, 3).map((p) => {
                      const c = COR_CHIP[p.cor];
                      return (
                        <Link
                          key={p.id}
                          href={`/admin/teste-edicao?postId=${p.id}`}
                          className="text-[10px] font-medium truncate rounded px-1.5 py-0.5 hover:brightness-95"
                          style={{ background: c.bg, color: c.fg }}
                          title={`Abrir ${p.titulo}`}
                        >
                          {p.titulo}
                        </Link>
                      );
                    })}
                    {postsHoje.length > 3 && (
                      <div className="text-[9px] text-t3">+{postsHoje.length - 3}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => criarNaData(iso)}
                      disabled={loading}
                      className="mt-auto self-start opacity-0 group-hover:opacity-100 focus:opacity-100 transition flex items-center gap-1 text-[10px] font-semibold text-ink disabled:opacity-50"
                      title="Criar nova pauta nesse dia"
                    >
                      {loading ? (
                        'criando…'
                      ) : (
                        <>
                          <span className="w-4 h-4 rounded bg-ink text-white inline-flex items-center justify-center text-[11px] leading-none">+</span>
                          {postsHoje.length === 0 ? 'criar' : 'outra'}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-[11px] text-t3 text-center pt-2">
          Dias com posts são só contexto — clique num dia vazio pra criar.
        </div>
      </main>
    </div>
  );
}
