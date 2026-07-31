'use client';

import { useState } from 'react';

export function BotaoCriarProps() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (!confirm('Criar as propriedades Funil e Objetivo (como SELECT) na DB de posts do Notion?\n\nSó cria se ainda não existirem. Nada existente é apagado.')) {
      return;
    }
    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const res = await fetch('/api/admin/criar-props', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erros?.join(', ') ?? `Erro ${res.status}`);
      setResultado(data);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5 mb-4" style={{ background: 'var(--prazo-em-dia-soft)' }}>
      <div className="text-[13px] font-semibold text-ink mb-2">
        🔧 Criar Funil e Objetivo agora
      </div>
      <p className="text-[12px] leading-[1.5] text-t2 mb-3">
        Cria as duas propriedades como <b>select</b> na sua DB de posts, já com
        todas as opções: Topo/Meio/Fundo no Funil e os 10 objetivos.
        Se já existirem, não mexe.
      </p>
      <button
        type="button"
        onClick={criar}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Criando…' : 'Criar Funil e Objetivo'}
      </button>

      {resultado && (
        <pre className="mt-3 text-[11px] font-mono whitespace-pre-wrap bg-white/60 rounded p-3 text-t1">
{JSON.stringify(resultado, null, 2)}
        </pre>
      )}
      {erro && (
        <p className="mt-3 text-[12px] font-medium text-hubRed">{erro}</p>
      )}
    </div>
  );
}
