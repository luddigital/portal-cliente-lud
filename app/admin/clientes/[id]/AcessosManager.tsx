'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AcessoCliente } from '@/lib/notion';

export function AcessosManager({
  clienteId,
  iniciais,
}: {
  clienteId: string;
  iniciais: AcessoCliente[];
}) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('');
  const [loading, setLoading] = useState<'add' | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setLoading('add');
    setError(null);
    try {
      const res = await fetch('/api/admin/acessos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          email: email.trim().toLowerCase(),
          nome: nome.trim() || undefined,
          funcao: funcao.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setLista((s) => [...s, data.acesso as AcessoCliente]);
      setEmail('');
      setNome('');
      setFuncao('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function remover(acessoId: string) {
    if (!confirm('Remover esse acesso? A pessoa perde a entrada no portal.')) return;
    setLoading(acessoId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/acessos/${acessoId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setLista((s) => s.filter((a) => a.id !== acessoId));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function copiarLink(emailAlvo: string) {
    setLoading(emailAlvo);
    setError(null);
    try {
      const res = await fetch('/api/admin/gerar-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailAlvo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      await navigator.clipboard.writeText(data.url);
      setCopiado(emailAlvo);
      setTimeout(() => setCopiado(null), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-t2">
        Pra clientes com time grande (tipo TKRA), cadastra aqui cada email que
        precisa de acesso. Todos veem os mesmos posts e podem comentar — mas
        só <b>Aprovar/Reprovar</b> encerram a etapa.
      </p>

      {lista.length === 0 ? (
        <p className="text-[12px] text-t3">
          Nenhum acesso extra cadastrado. Use o formulário abaixo.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[rgba(21,21,33,0.08)]">
          {lista.map((a, i) => (
            <div
              key={a.id}
              className={`flex flex-wrap items-center gap-3 bg-white px-3.5 py-2.5 text-[13px] ${
                i > 0 ? 'border-t border-[rgba(21,21,33,0.05)]' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">
                  {a.nome ? `${a.nome} · ` : ''}
                  <span className="font-mono text-[12px] text-t2">{a.email}</span>
                </div>
                {a.funcao && (
                  <div className="mt-0.5 text-[11px] text-t3">{a.funcao}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => copiarLink(a.email)}
                  disabled={loading === a.email}
                  className="text-[11px] font-medium text-navy hover:underline"
                >
                  {copiado === a.email
                    ? '✓ Copiado'
                    : loading === a.email
                      ? 'Gerando…'
                      : 'Copiar link'}
                </button>
                <button
                  type="button"
                  onClick={() => remover(a.id)}
                  disabled={loading === a.id}
                  className="text-[11px] text-hubRed hover:underline"
                >
                  {loading === a.id ? 'Removendo…' : 'Remover'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={adicionar} className="rounded-xl border border-dashed border-[rgba(21,21,33,0.18)] bg-bgSoft/40 p-4">
        <div className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
            required
            className="input text-[13px]"
          />
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome (opcional)"
            className="input text-[13px]"
          />
          <input
            type="text"
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            placeholder="Função (opcional)"
            className="input text-[13px]"
          />
        </div>
        <div className="mt-3 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={loading === 'add' || !email}
            className="btn-primary text-[12px]"
          >
            {loading === 'add' ? 'Adicionando…' : '+ Adicionar acesso'}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-[12px] font-medium text-hubRed">{error}</p>
      )}
    </div>
  );
}
