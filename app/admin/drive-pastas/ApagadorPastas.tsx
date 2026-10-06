'use client';

import { useEffect, useMemo, useState } from 'react';

type NoPasta = {
  id: string;
  name: string;
  parent: string;
  depth: number;
  createdTime?: string;
  modifiedTime?: string;
};

type ClienteComPosts = NoPasta & {
  posts: (NoPasta & { datas: NoPasta[] })[];
};

export function ApagadorPastas() {
  const [arvore, setArvore] = useState<NoPasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [apagando, setApagando] = useState(false);
  const [feito, setFeito] = useState<{ apagados: number; erros: number } | null>(null);
  const [busca, setBusca] = useState('');

  async function carregar() {
    setLoading(true);
    setErro(null);
    setFeito(null);
    try {
      const res = await fetch('/api/admin/drive-pastas');
      const text = await res.text();
      let j: any = {};
      try {
        j = JSON.parse(text);
      } catch {
        // Resposta não era JSON — pode ser HTML de erro do Vercel
        throw new Error(
          `Resposta inválida (${res.status}): ${text.slice(0, 150)}`,
        );
      }
      if (!res.ok) {
        // Pode vir árvore parcial mesmo com erro — mostra o que deu pra
        // listar antes de falhar.
        if (j.arvoreParcial && Array.isArray(j.arvoreParcial)) {
          setArvore(j.arvoreParcial);
        }
        throw new Error(j.error ?? `Erro ${res.status}`);
      }
      setArvore(j.arvore ?? []);
    } catch (e: any) {
      setErro(e?.message ?? 'erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Agrupa por cliente → posts → datas, respeitando a busca.
  const porCliente = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const clientes = arvore.filter((n) => n.depth === 1);
    return clientes.map((c) => {
      const posts = arvore.filter((n) => n.depth === 2 && n.parent === c.id);
      const postsComDatas = posts.map((p) => ({
        ...p,
        datas: arvore.filter((n) => n.depth === 3 && n.parent === p.id),
      }));
      return { ...c, posts: postsComDatas };
    }).filter((c) => {
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      return c.posts.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.datas.some((d) => d.name.toLowerCase().includes(q)),
      );
    });
  }, [arvore, busca]);

  function alternar(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function marcarCliente(cliente: ClienteComPosts, marcar: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      const ids = [
        cliente.id,
        ...cliente.posts.flatMap((p) => [p.id, ...p.datas.map((d) => d.id)]),
      ];
      for (const id of ids) {
        if (marcar) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function apagar() {
    if (selecionados.size === 0) return;
    const confirmacao = window.confirm(
      `Mover ${selecionados.size} pasta(s) pra lixeira do Drive? ` +
        `Dá pra recuperar depois pelo Drive → Lixeira.`,
    );
    if (!confirmacao) return;

    setApagando(true);
    setErro(null);
    try {
      const res = await fetch('/api/admin/drive-pastas', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selecionados) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setFeito({ apagados: j.apagados?.length ?? 0, erros: j.erros?.length ?? 0 });
      setSelecionados(new Set());
      // Recarrega a lista pra refletir o que sumiu.
      await carregar();
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    } finally {
      setApagando(false);
    }
  }

  function fmtData(iso?: string): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  if (loading) {
    return (
      <div className="card p-6 text-center text-[13px] text-t3">
        Carregando pastas do Drive…
      </div>
    );
  }

  if (erro && arvore.length === 0) {
    return (
      <div className="card p-6 text-center text-[13px] text-[var(--prazo-atrasado)]">
        {erro}
        <button
          type="button"
          onClick={carregar}
          className="ml-3 text-mauve underline hover:text-ink"
        >
          tentar de novo
        </button>
      </div>
    );
  }

  const total = arvore.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar por nome…"
          className="w-full max-w-sm rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[12.5px] text-ink"
        />
        <div className="flex items-center gap-3">
          <span className="text-[11.5px] text-t3">
            {total} pastas · <b className="text-ink">{selecionados.size}</b> marcadas
          </span>
          <button
            type="button"
            onClick={apagar}
            disabled={selecionados.size === 0 || apagando}
            className="rounded-full bg-[var(--prazo-atrasado)] px-4 py-2 text-[12px] font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
          >
            {apagando ? 'Apagando…' : `Apagar ${selecionados.size} selecionadas`}
          </button>
        </div>
      </div>

      {feito && (
        <div className="rounded-lg bg-[var(--prazo-em-dia-soft)] p-3 text-[12px] text-[var(--prazo-em-dia)]">
          ✓ {feito.apagados} pasta(s) enviadas pra lixeira.{' '}
          {feito.erros > 0 && (
            <span className="text-[var(--prazo-atrasado)]">
              ({feito.erros} erro(s))
            </span>
          )}
        </div>
      )}

      {erro && arvore.length > 0 && (
        <div className="rounded-lg bg-[var(--prazo-atrasado-soft)] p-3 text-[12px] text-[var(--prazo-atrasado)]">
          {erro}
        </div>
      )}

      <div className="space-y-4">
        {porCliente.map((cliente) => {
          const totalCliente = 1 + cliente.posts.length + cliente.posts.reduce((s, p) => s + p.datas.length, 0);
          const marcadosCliente = [cliente.id, ...cliente.posts.flatMap((p) => [p.id, ...p.datas.map((d) => d.id)])].filter((id) => selecionados.has(id)).length;
          const todoMarcado = marcadosCliente === totalCliente;
          return (
            <div key={cliente.id} className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-bgSoft/60 px-4 py-2.5">
                <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={todoMarcado}
                    ref={(el) => {
                      if (el) el.indeterminate = marcadosCliente > 0 && !todoMarcado;
                    }}
                    onChange={(e) => marcarCliente(cliente, e.target.checked)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <span className="truncate text-[13px] font-semibold text-ink">
                    {cliente.name}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-t3">
                    {cliente.posts.length} post(s)
                  </span>
                </label>
                <span className="shrink-0 text-[10.5px] text-t3">
                  {marcadosCliente}/{totalCliente}
                </span>
              </div>
              {cliente.posts.length === 0 ? (
                <div className="px-4 py-3 text-[11.5px] text-t3 italic">
                  cliente vazio (pasta sem posts)
                </div>
              ) : (
                <div className="divide-y divide-[rgba(21,21,33,0.06)]">
                  {cliente.posts.map((post) => (
                    <div key={post.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-4 py-2 pl-10 hover:bg-bgSoft/40">
                        <input
                          type="checkbox"
                          checked={selecionados.has(post.id)}
                          onChange={() => alternar(post.id)}
                          className="h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                          {post.name}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-t3">
                          {fmtData(post.modifiedTime || post.createdTime)}
                        </span>
                      </label>
                      {post.datas.map((data) => (
                        <label
                          key={data.id}
                          className="flex cursor-pointer items-center gap-2.5 px-4 py-1.5 pl-16 hover:bg-bgSoft/40"
                        >
                          <input
                            type="checkbox"
                            checked={selecionados.has(data.id)}
                            onChange={() => alternar(data.id)}
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-t2">
                            {data.name}
                          </span>
                          <span className="shrink-0 text-[10.5px] text-t3">
                            {fmtData(data.modifiedTime || data.createdTime)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
