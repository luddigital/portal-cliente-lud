'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WhatsappGrupo, WhatsappPermissao } from '@/lib/supabase';

type ProjetoOpcao = { id: string; label: string };

type Props = {
  grupos: WhatsappGrupo[];
  permissoes: WhatsappPermissao[];
  projetos: ProjetoOpcao[];
};

export function AdminWhatsappPanel({ grupos, permissoes, projetos }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null);

  async function vincularProjeto(grupo: WhatsappGrupo, projetoId: string | null) {
    setErro(null);
    try {
      const res = await fetch('/api/whatsapp/grupo-projeto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupoId: grupo.id, projetoId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'erro');
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      setErro(e?.message ?? 'erro vinculando projeto');
    }
  }

  async function sincronizar() {
    setErro(null);
    setMsg(null);
    try {
      const res = await fetch('/api/whatsapp/sync-groups', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'erro');
      setMsg(`Sincronizado: ${j.novos} novos, ${j.atualizados} atualizados (${j.total} total)`);
      startTransition(() => router.refresh());
    } catch (e: any) {
      setErro(e?.message ?? 'erro sincronizando');
    }
  }

  async function toggleAtivo(grupo: WhatsappGrupo) {
    setErro(null);
    try {
      const res = await fetch('/api/whatsapp/permissoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupoId: grupo.id, ativo: !grupo.ativo }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'erro');
      }
      startTransition(() => router.refresh());
    } catch (e: any) {
      setErro(e?.message ?? 'erro atualizando');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-[rgba(21,21,33,0.08)] bg-white px-4 py-3">
        <div>
          <div className="text-[13px] font-medium text-ink">Sincronizar grupos</div>
          <div className="text-[11px] text-t3">
            Importa todos os grupos do seu WhatsApp. Novos entram desativados — você ativa um por um.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/whatsapp/testar"
            className="rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-bgSoft"
          >
            🧪 Testar envio
          </a>
          <button
            onClick={sincronizar}
            disabled={pending}
            className="rounded-lg bg-navy px-4 py-2 text-[12px] font-medium text-white transition hover:bg-ink disabled:opacity-50"
          >
            {pending ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-hubRed/30 bg-hubRed/5 px-4 py-2 text-[12px] text-hubRed">
          {erro}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-green-500/30 bg-green-50 px-4 py-2 text-[12px] text-green-700">
          {msg}
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="rounded-lg border border-[rgba(21,21,33,0.08)] bg-bgSoft px-6 py-10 text-center">
          <div className="text-[14px] font-medium text-ink">Nenhum grupo sincronizado</div>
          <div className="mt-1 text-[12px] text-t3">
            Clique em "Sincronizar agora" pra puxar os grupos do seu WhatsApp.
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {grupos.map((g) => {
            const permsDoGrupo = permissoes.filter((p) => p.grupo_id === g.id);
            const expandido = grupoExpandido === g.id;
            return (
              <li
                key={g.id}
                className="rounded-lg border border-[rgba(21,21,33,0.08)] bg-white"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                    {g.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.foto_url} alt="" className="h-full w-full rounded-full" />
                    ) : (
                      g.nome.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">{g.nome}</div>
                    <div className="truncate text-[10px] text-t3">{g.id}</div>
                  </div>

                  {/* Dropdown de projeto — vincula o grupo a um projeto do Notion.
                      Essa é a vinculação que o botão "📱 lembrar" usa pra saber
                      onde mandar a mensagem de aprovação. */}
                  <select
                    value={g.projeto_id ?? ''}
                    onChange={(e) =>
                      vincularProjeto(g, e.target.value || null)
                    }
                    disabled={pending}
                    className="max-w-[220px] rounded-md border border-[rgba(21,21,33,0.13)] bg-white px-2 py-1.5 text-[11px] text-ink"
                    title="Vincula o grupo a um projeto do Notion"
                  >
                    <option value="">— sem projeto —</option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 text-[11px] text-t2">
                    <input
                      type="checkbox"
                      checked={g.ativo}
                      onChange={() => toggleAtivo(g)}
                      className="h-4 w-4 accent-navy"
                    />
                    {g.ativo ? 'Ativo' : 'Oculto'}
                  </label>
                  <button
                    onClick={() => setGrupoExpandido(expandido ? null : g.id)}
                    title="Avançado: dar acesso de ver/responder esse grupo via portal pra pessoas específicas"
                    className="rounded-lg border border-[rgba(21,21,33,0.12)] px-2 py-1 text-[10px] text-t3 hover:bg-bgSoft"
                  >
                    {expandido ? 'Fechar' : '⚙'}
                  </button>
                </div>

                {expandido && (
                  <PermissoesGrupo
                    grupoId={g.id}
                    permissoes={permsDoGrupo}
                    onChange={() => startTransition(() => router.refresh())}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PermissoesGrupo({
  grupoId,
  permissoes,
  onChange,
}: {
  grupoId: string;
  permissoes: WhatsappPermissao[];
  onChange: () => void;
}) {
  const [email, setEmail] = useState('');
  const [podeResponder, setPodeResponder] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch('/api/whatsapp/permissoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupoId,
          usuario_email: email.trim(),
          pode_ler: true,
          pode_responder: podeResponder,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'erro');
      }
      setEmail('');
      setPodeResponder(false);
      onChange();
    } catch (e: any) {
      setErro(e?.message ?? 'erro adicionando');
    } finally {
      setSalvando(false);
    }
  }

  async function togglePermissao(p: WhatsappPermissao, campo: 'pode_ler' | 'pode_responder') {
    try {
      const res = await fetch('/api/whatsapp/permissoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupoId,
          usuario_email: p.usuario_email,
          pode_ler: campo === 'pode_ler' ? !p.pode_ler : p.pode_ler,
          pode_responder: campo === 'pode_responder' ? !p.pode_responder : p.pode_responder,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'erro');
      }
      onChange();
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    }
  }

  async function remover(p: WhatsappPermissao) {
    if (!confirm(`Remover acesso de ${p.usuario_email}?`)) return;
    try {
      const res = await fetch(`/api/whatsapp/permissoes?id=${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'erro');
      }
      onChange();
    } catch (e: any) {
      setErro(e?.message ?? 'erro');
    }
  }

  return (
    <div className="border-t border-[rgba(21,21,33,0.08)] bg-bgSoft px-4 py-3">
      <div className="mb-3 rounded border border-[rgba(21,21,33,0.08)] bg-white px-3 py-2 text-[10.5px] leading-[1.5] text-t3">
        <b className="text-t2">Avançado — opcional.</b> Esse painel é da feature
        de &quot;espelhar grupo no portal&quot; (um usuário logado no portal
        consegue ler/responder mensagens do grupo). <b className="text-t2">Não
        precisa preencher pra o botão de lembrete funcionar</b> — a vinculação
        ao projeto (dropdown lá em cima) já basta.
      </div>

      {erro && (
        <div className="mb-2 rounded border border-hubRed/30 bg-hubRed/5 px-3 py-1 text-[11px] text-hubRed">
          {erro}
        </div>
      )}

      <form onSubmit={adicionar} className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@cliente.com"
          className="flex-1 rounded-md border border-[rgba(21,21,33,0.12)] bg-white px-3 py-1.5 text-[12px] outline-none focus:border-navy/40"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-t2">
          <input
            type="checkbox"
            checked={podeResponder}
            onChange={(e) => setPodeResponder(e.target.checked)}
            className="h-3.5 w-3.5 accent-navy"
          />
          Pode responder
        </label>
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? '…' : 'Adicionar'}
        </button>
      </form>

      {permissoes.length === 0 ? (
        <div className="text-[11px] text-t3">Ninguém com acesso a esse grupo ainda.</div>
      ) : (
        <ul className="space-y-1">
          {permissoes.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-md bg-white px-3 py-1.5 text-[12px]"
            >
              <div className="flex-1 truncate text-ink">{p.usuario_email}</div>
              <label className="flex items-center gap-1 text-[10px] text-t2">
                <input
                  type="checkbox"
                  checked={p.pode_ler}
                  onChange={() => togglePermissao(p, 'pode_ler')}
                  className="h-3.5 w-3.5 accent-navy"
                />
                ler
              </label>
              <label className="flex items-center gap-1 text-[10px] text-t2">
                <input
                  type="checkbox"
                  checked={p.pode_responder}
                  onChange={() => togglePermissao(p, 'pode_responder')}
                  className="h-3.5 w-3.5 accent-navy"
                />
                responder
              </label>
              <button
                onClick={() => remover(p)}
                className="text-[10px] text-hubRed hover:underline"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
