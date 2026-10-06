'use client';

import { useState } from 'react';

type GrupoResumo = { id: string; nome: string };

const MENSAGEM_PADRAO = [
  'Teste do portal da Lud. ✨',
  '',
  'Essa é só uma mensagem de teste pra validar que o envio tá funcionando.',
  '',
  'Pode ignorar.',
].join('\n');

export function TestarWppForm({ grupos }: { grupos: GrupoResumo[] }) {
  const [modo, setModo] = useState<'telefone' | 'grupo'>('telefone');
  const [destino, setDestino] = useState('');
  const [grupoSelecionado, setGrupoSelecionado] = useState('');
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    setSucesso(null);
    const dest =
      modo === 'grupo'
        ? grupoSelecionado || destino.trim()
        : destino.trim();
    if (!dest) {
      setErro(
        modo === 'grupo'
          ? 'Escolhe um grupo ou cola o group ID.'
          : 'Digita o telefone.',
      );
      return;
    }
    if (!mensagem.trim()) {
      setErro('Mensagem não pode ficar vazia.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/wpp-teste', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ destino: dest, mensagem, modo }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setSucesso(
        `✓ Enviado pra ${modo === 'grupo' ? 'grupo' : 'telefone'} ${j.destino}`,
      );
    } catch (e: any) {
      setErro(e?.message ?? 'erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Modo */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
          Mandar pra
        </div>
        <div className="flex gap-2 rounded-full bg-bgSoft p-1">
          <button
            type="button"
            onClick={() => setModo('telefone')}
            className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              modo === 'telefone'
                ? 'bg-white text-ink shadow-sm'
                : 'text-t3 hover:text-ink'
            }`}
          >
            📱 Telefone (PV)
          </button>
          <button
            type="button"
            onClick={() => setModo('grupo')}
            className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              modo === 'grupo'
                ? 'bg-white text-ink shadow-sm'
                : 'text-t3 hover:text-ink'
            }`}
          >
            👥 Grupo
          </button>
        </div>
      </div>

      {/* Destino */}
      {modo === 'telefone' ? (
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
            Telefone (seu número ou qualquer um pra testar)
          </label>
          <input
            type="tel"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="(11) 98765-4321"
            className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
          />
          <p className="mt-1 text-[10.5px] text-t3">
            Pode usar o formato que quiser — DDD + número é suficiente.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Escolher um grupo sincronizado
            </label>
            <select
              value={grupoSelecionado}
              onChange={(e) => {
                setGrupoSelecionado(e.target.value);
                if (e.target.value) setDestino('');
              }}
              className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
            >
              <option value="">
                {grupos.length === 0
                  ? 'Nenhum grupo sincronizado — sincroniza em /admin/whatsapp'
                  : 'Escolha…'}
              </option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="text-center text-[10.5px] text-t3">— ou —</div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Colar group ID manualmente
            </label>
            <input
              type="text"
              value={destino}
              onChange={(e) => {
                setDestino(e.target.value);
                if (e.target.value) setGrupoSelecionado('');
              }}
              placeholder="120363XXXXXXX@g.us"
              className="w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 font-mono text-[12px] text-ink"
            />
          </div>
        </div>
      )}

      {/* Mensagem */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
          Mensagem
        </label>
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={7}
          className="w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] leading-[1.55] text-ink"
        />
        <div className="mt-1 flex items-center justify-between text-[10.5px] text-t3">
          <span>Formato WhatsApp: *negrito*, _itálico_, ~tachado~</span>
          <button
            type="button"
            onClick={() => setMensagem(MENSAGEM_PADRAO)}
            className="text-mauve transition hover:text-ink"
          >
            restaurar padrão
          </button>
        </div>
      </div>

      {/* Botão + feedback */}
      {erro && (
        <div className="rounded-lg bg-[var(--prazo-atrasado-soft)] p-3 text-[12px] text-[var(--prazo-atrasado)]">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-lg bg-[var(--prazo-em-dia-soft)] p-3 text-[12px] text-[var(--prazo-em-dia)]">
          {sucesso}
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Enviando…' : 'Enviar teste'}
        </button>
      </div>
    </div>
  );
}
