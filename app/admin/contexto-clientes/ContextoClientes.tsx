'use client';

import { useState } from 'react';
import type { DocContexto } from '@/lib/contextoClientes';

/** Clientes de social media (mesmas chaves do contexto: sem @ e sem _). */
const CLIENTES = [
  'descubraparis',
  'descobrindoasuica',
  'emanueltransferparis',
  'ligiabueno',
  'nyorquina',
  'resucena',
  'roteirosnaafrica',
  'steguiaveneza',
  'stetravelsofficial',
  'tkracontabilidade',
  'turismoemchicago',
];

const BTN = 'inline-flex h-8 items-center whitespace-nowrap rounded-full border border-[#D6D6D9] bg-white px-3.5 text-[12.5px] font-extrabold text-[#111113] hover:bg-[#F4F4F5] disabled:opacity-40';
const BTN_P = 'inline-flex h-8 items-center whitespace-nowrap rounded-full bg-[#111113] px-3.5 text-[12.5px] font-extrabold text-white hover:bg-[#2C2C30] disabled:opacity-50';
const INP = 'w-full rounded-[10px] border border-[#D6D6D9] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#111113]';
const CAT_COR: Record<string, [string, string]> = {
  'Briefing do cliente': ['#E3ECF7', '#24466B'],
  'Tom de voz': ['#F2D0EA', '#6A2B5F'],
  'Guia de copy': ['#E8E4FA', '#3E2F8F'],
  'Regras de copy (melhoria contínua)': ['#D8EDCF', '#2E5520'],
  Referências: ['#FBEFD9', '#8A5A1F'],
};

const ddmm = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

export function ContextoClientes({ docs: inicial, categorias }: { docs: DocContexto[]; categorias: string[] }) {
  const [docs, setDocs] = useState(inicial);
  const clientes = [...new Set([...CLIENTES, ...docs.map((d) => d.handle)])].sort();
  const [sel, setSel] = useState(clientes.find((c) => docs.some((d) => d.handle === c)) ?? clientes[0]);
  const [aberto, setAberto] = useState<string | 'novo' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const doCliente = docs.filter((d) => d.handle === sel).sort((a, b) => a.ordem - b.ordem);
  const total = doCliente.filter((d) => d.ativo).reduce((s, d) => s + d.texto.length, 0);

  async function salvar(d: Partial<DocContexto>) {
    setMsg(null);
    const r = await fetch('/api/contexto-clientes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: sel, ...d }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg({ ok: false, t: j.error ?? 'Não consegui salvar.' });
    setDocs((ds) => (ds.some((x) => x.id === j.doc.id) ? ds.map((x) => (x.id === j.doc.id ? j.doc : x)) : [...ds, j.doc]));
    setAberto(null);
    setMsg({ ok: true, t: 'Salvo. A Esteira Copy já usa a versão nova.' });
  }
  async function apagar(id: string) {
    if (!window.confirm('Apagar esse documento do contexto?')) return;
    const r = await fetch(`/api/contexto-clientes?id=${id}`, { method: 'DELETE' });
    if (r.ok) setDocs((ds) => ds.filter((x) => x.id !== id));
  }

  return (
    <div className="flex flex-col items-start gap-4 lg:flex-row">
      <div className="flex w-full flex-none flex-col gap-1 rounded-[18px] border border-[#E9E9EB] bg-white p-3 lg:w-[260px]">
        {clientes.map((c) => {
          const n = docs.filter((d) => d.handle === c && d.ativo).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => (setSel(c), setAberto(null), setMsg(null))}
              className={`flex items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px] ${sel === c ? 'bg-[#F3F0FD] font-extrabold' : 'hover:bg-[#FAFAFA]'}`}
            >
              @{c}
              <span className={`rounded-full px-2 text-[11px] font-extrabold ${n ? 'bg-[#F0F0F1] text-[#46464B]' : 'bg-[#FBE3E0] text-[#7E211C]'}`}>{n || 'vazio'}</span>
            </button>
          );
        })}
      </div>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-3 rounded-[18px] border border-[#E9E9EB] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <b className="text-[20px]">@{sel}</b>
            <span className="text-[12px] text-[#636369]">
              {doCliente.length} documentos · {Math.round(total / 1000)} mil caracteres em uso
            </span>
          </div>
          <button type="button" onClick={() => setAberto('novo')} className={BTN_P}>
            + Documento
          </button>
        </div>
        {msg && <span className={`rounded-[10px] px-3 py-2 text-[12.5px] font-bold ${msg.ok ? 'bg-[#D8EDCF] text-[#2E5520]' : 'bg-[#FBE3E0] text-[#7E211C]'}`}>{msg.t}</span>}
        {aberto === 'novo' && <Editor categorias={categorias} onSalvar={salvar} onCancelar={() => setAberto(null)} />}
        {doCliente.length === 0 && aberto !== 'novo' && (
          <span className="rounded-[12px] bg-[#FAFAFA] px-4 py-3 text-[13px] text-[#636369]">
            Nenhum documento ainda. Cole aqui o briefing, o tom de voz e o guia de copy que estão no projeto desse cliente no Claude.
          </span>
        )}
        <div className="flex flex-col divide-y divide-[#EFEFF1] overflow-hidden rounded-[14px] border border-[#EFEFF1]">
          {doCliente.map((d) =>
            aberto === d.id ? (
              <div key={d.id} className="p-3">
                <Editor categorias={categorias} doc={d} onSalvar={salvar} onCancelar={() => setAberto(null)} />
              </div>
            ) : (
              <div key={d.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${d.ativo ? '' : 'opacity-50'}`}>
                <span
                  className="rounded-full px-2.5 py-[2px] text-[11px] font-extrabold"
                  style={{ background: (CAT_COR[d.categoria] ?? ['#F0F0F1', '#46464B'])[0], color: (CAT_COR[d.categoria] ?? ['#F0F0F1', '#46464B'])[1] }}
                >
                  {d.categoria}
                </span>
                <button type="button" onClick={() => setAberto(d.id)} className="min-w-0 flex-1 truncate text-left text-[13.5px] font-bold hover:underline">
                  {d.titulo}
                </button>
                <span className="text-[11.5px] text-[#8A8A90]">
                  {Math.round(d.texto.length / 100) / 10} mil · {d.origem ?? 'Portal'} · {ddmm(d.atualizado_em)}
                </span>
                <button type="button" onClick={() => salvar({ ...d, ativo: !d.ativo })} className="text-[12px] font-bold text-[#636369] hover:text-[#111113]">
                  {d.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button type="button" onClick={() => apagar(d.id)} className="text-[12px] font-bold text-[#B42318] hover:underline">
                  Apagar
                </button>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function Editor({ doc, categorias, onSalvar, onCancelar }: { doc?: DocContexto; categorias: string[]; onSalvar: (d: Partial<DocContexto>) => Promise<void>; onCancelar: () => void }) {
  const [categoria, setCategoria] = useState(doc?.categoria ?? 'Briefing do cliente');
  const [titulo, setTitulo] = useState(doc?.titulo ?? '');
  const [texto, setTexto] = useState(doc?.texto ?? '');
  const [salvando, setSalvando] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${INP} w-auto`}>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ex.: Guia de tom de voz da Zildinha)" className={`${INP} min-w-[240px] flex-1`} />
        <label className={`${BTN} cursor-pointer`}>
          Subir arquivo .md/.txt
          <input
            type="file"
            accept=".md,.txt,text/plain,text/markdown"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setTexto(await f.text());
              if (!titulo) setTitulo(f.name.replace(/\.(md|txt)$/i, ''));
            }}
          />
        </label>
      </div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={18} placeholder="Cole aqui o conteúdo do documento…" className={`${INP} font-mono text-[12.5px] leading-[1.55]`} />
      <span className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className={BTN}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={salvando || !titulo.trim() || !texto.trim()}
          onClick={async () => {
            setSalvando(true);
            await onSalvar({ ...(doc ?? {}), categoria, titulo, texto });
            setSalvando(false);
          }}
          className={BTN_P}
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </span>
    </div>
  );
}
