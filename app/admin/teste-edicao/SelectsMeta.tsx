'use client';

import { useState } from 'react';

type Opcao = { id: string; nome: string };
type OpcaoSelect = { nome: string; cor?: string | null };

type Props = {
  postId: string;
  formatos: Opcao[];
  funis: Opcao[];
  objetivos: Opcao[];
  demandas: OpcaoSelect[];
  formatoIdInicial: string | null;
  funilIdInicial: string | null;
  objetivoIdInicial: string | null;
  demandaInicial: string | null;
};

async function patchProps(
  postId: string,
  body: Record<string, string | null>,
): Promise<void> {
  const res = await fetch(`/api/pauta/${postId}/props`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? `Erro ${res.status}`);
  }
}

/** Cada objetivo Lud. tem um ou mais funis pré-associados. Quando o
 *  usuário troca o objetivo, o funil auto-preenche com o primeiro da
 *  lista (dá pra sobrescrever manualmente depois). */
const OBJETIVO_PARA_FUNIL: Record<string, string[]> = {
  'Antecipação':   ['Fundo'],
  'Infotenimento': ['Topo', 'Meio'],
  'Divulgação':    ['Meio', 'Fundo'],
  'Automação':     ['Fundo'],
  'Autoridade':    ['Topo', 'Meio'],
  'Utilidade':     ['Topo', 'Meio'],
  'Engajamento':   ['Topo'],
  'Awareness':     ['Meio'],
  'Vendas':        ['Fundo'],
  'Comunidade':    ['Meio'],
};

export function SelectsMeta(props: Props) {
  const {
    postId, formatos, funis, objetivos, demandas,
    formatoIdInicial, funilIdInicial, objetivoIdInicial, demandaInicial,
  } = props;

  const [formatoId, setFormatoId] = useState<string | null>(formatoIdInicial);
  const [funilId, setFunilId] = useState<string | null>(funilIdInicial);
  const [objetivoId, setObjetivoId] = useState<string | null>(objetivoIdInicial);
  const [demanda, setDemanda] = useState<string | null>(demandaInicial);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /** Nome do objetivo atual (pra lookup no mapa). Pode ser id (relation) ou
   *  o próprio nome (select) — em ambos os casos vem do array `objetivos`. */
  const objetivoNomeAtual =
    objetivos.find((o) => o.id === objetivoId)?.nome ?? null;
  const funisSugeridos = objetivoNomeAtual
    ? (OBJETIVO_PARA_FUNIL[objetivoNomeAtual] ?? [])
    : [];

  async function trocar<K extends string>(
    campo: K,
    valor: string | null,
    setter: (v: string | null) => void,
  ) {
    const antes = { formatoId, funilId, objetivoId, demanda }[
      campo as 'formatoId' | 'funilId' | 'objetivoId' | 'demanda'
    ];
    setter(valor);
    setSalvando(campo);
    setErro(null);
    try {
      await patchProps(postId, { [campo]: valor } as any);
    } catch (e: any) {
      setErro(e.message);
      // reverte
      setter(antes ?? null);
    } finally {
      setSalvando(null);
    }
  }

  // Emoji só decorativo por nome — heurística leve
  function emojiFormato(nome: string): string {
    const n = nome.toLowerCase();
    if (n.includes('reels') || n.includes('vídeo') || n.includes('video')) return '🎬';
    if (n.includes('carrossel')) return '🔲';
    if (n.includes('stor')) return '📱';
    if (n.includes('foto') || n.includes('imagem') || n.includes('post')) return '📸';
    return '📝';
  }

  return (
    <>
      {/* Formato em pills */}
      <div className="card p-4">
        <div className="label mb-2">
          Formato{' '}
          <span className="normal-case tracking-normal text-t3 font-normal">
            · cada formato tem seu modelo
          </span>
        </div>
        {formatos.length === 0 ? (
          <p className="text-[12px] italic text-t3">
            Nenhum formato cadastrado no Notion.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {formatos.map((f) => {
              const ativo = f.id === formatoId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => trocar('formatoId', ativo ? null : f.id, setFormatoId)}
                  disabled={salvando === 'formatoId'}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${
                    ativo
                      ? 'bg-ink text-white'
                      : 'border border-[rgba(21,21,33,0.1)] bg-white text-t2 hover:text-ink'
                  }`}
                >
                  {emojiFormato(f.nome)} {f.nome}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3 selects */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <SelectItem
          label="O que precisamos de vc"
          value={demanda}
          onChange={(v) => trocar('demandaValor', v, setDemanda)}
          opcoes={demandas.map((d) => ({ id: d.nome, nome: d.nome }))}
          loading={salvando === 'demandaValor'}
        />
        <div>
          <SelectItem
            label="Funil"
            value={funilId}
            onChange={(v) => trocar('funilId', v, setFunilId)}
            opcoes={funis}
            loading={salvando === 'funilId'}
          />
          {funisSugeridos.length > 1 && (
            <div className="mt-1.5 text-[10.5px] text-t3">
              sugerido pelo objetivo:{' '}
              {funisSugeridos.map((nome, i) => {
                const opt = funis.find((f) => f.nome === nome);
                const ativo = opt?.id === funilId;
                return (
                  <span key={nome}>
                    {i > 0 && <span> · </span>}
                    <button
                      type="button"
                      onClick={() => opt && trocar('funilId', opt.id, setFunilId)}
                      disabled={!opt}
                      className={`underline hover:text-ink transition ${ativo ? 'text-ink font-semibold' : ''}`}
                    >
                      {nome}
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <SelectItem
          label="Objetivo"
          value={objetivoId}
          onChange={(v) => {
            trocar('objetivoId', v, setObjetivoId);
            // Auto-preenche o funil com o primeiro sugerido, se ainda não tiver
            // Notion escolhido pelo usuário — respeita override manual
            if (v) {
              const nome = objetivos.find((o) => o.id === v)?.nome;
              const sug = nome ? OBJETIVO_PARA_FUNIL[nome] : undefined;
              if (sug && sug.length > 0) {
                const primeiroOpt = funis.find((f) => f.nome === sug[0]);
                if (primeiroOpt) {
                  trocar('funilId', primeiroOpt.id, setFunilId);
                }
              }
            }
          }}
          opcoes={objetivos}
          loading={salvando === 'objetivoId'}
        />
      </div>

      {erro && (
        <p className="prazo-pill atrasado">
          <span className="prazo-dot"></span>{erro}
        </p>
      )}
    </>
  );
}

function SelectItem({
  label,
  value,
  onChange,
  opcoes,
  loading,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  opcoes: { id: string; nome: string }[];
  loading: boolean;
}) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={loading}
          className="appearance-none w-full text-[12px] text-ink bg-white border border-[rgba(21,21,33,0.1)] rounded-lg pl-3 pr-7 py-2 cursor-pointer focus:outline-none focus:border-navy focus:ring-4 focus:ring-navy/10 disabled:opacity-50"
        >
          <option value="">— não definido —</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-t3">
          {loading ? '…' : '▾'}
        </span>
      </div>
    </div>
  );
}
