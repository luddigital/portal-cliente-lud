'use client';

import { useEffect, useMemo, useState } from 'react';

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function proximoMes(): { ano: number; mes: number } {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export function CriarCalendarioForm({
  projetoId,
  projetoNome,
  clienteNome,
}: {
  projetoId: string;
  projetoNome: string;
  clienteNome: string;
}) {
  const prox = proximoMes();
  const [ano, setAno] = useState(prox.ano);
  const [mes, setMes] = useState(prox.mes);
  const [objetivo, setObjetivo] = useState('');
  const [datas, setDatas] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [preview, setPreview] = useState(false);
  const [projectUrl, setProjectUrl] = useState('');
  const [status, setStatus] = useState<null | 'copiado' | 'erro-copiar'>(null);

  // Carrega o URL do Project no claude.ai salvo pra esse projeto específico.
  // Fica em localStorage por projetoId — Safari ITP ou aba anônima pode zerar;
  // é só uma conveniência, nunca segredo.
  const storageKey = `claude_project_url__${projetoId}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setProjectUrl(saved);
    } catch {
      /* storage bloqueado — tudo bem, segue sem preencher */
    }
  }, [storageKey]);
  function salvarProjectUrl(v: string) {
    setProjectUrl(v);
    try {
      if (v.trim()) localStorage.setItem(storageKey, v.trim());
      else localStorage.removeItem(storageKey);
    } catch {
      /* idem */
    }
  }

  const prompt = useMemo(() => {
    const nomeMes = MESES_PT[mes - 1];
    const partes: string[] = [];
    partes.push(
      `Oi! Preciso montar o calendário editorial de ${nomeMes} de ${ano} pro cliente **${clienteNome}** (projeto: ${projetoNome}).`,
      '',
      'Roda o `/planejamento-mensal` se tiver essa skill ativa. Se não, faz o pipeline manual:',
      '`agente-inteligencia` → `especialista-em-datas` → `estrategista-instagram` → calendário final.',
      '',
      'Antes de montar o calendário, lê o briefing do cliente em `Clientes/' + clienteNome + '/Estrategia/` e o `regras-aprendidas.md` dele.',
    );
    if (objetivo.trim()) {
      partes.push('', '**Objetivo do mês:**', objetivo.trim());
    }
    if (datas.trim()) {
      partes.push('', '**Datas comemorativas / eventos relevantes:**', datas.trim());
    }
    if (observacoes.trim()) {
      partes.push('', '**Observações extras:**', observacoes.trim());
    }
    partes.push(
      '',
      'Me entrega o calendário final formatado em markdown — uma linha por post com data, formato (Carrossel/Reels/Stories), título e ideia curta — pronto pra eu copiar e colar no portal.',
    );
    return partes.join('\n');
  }, [ano, mes, clienteNome, projetoNome, objetivo, datas, observacoes]);

  const temProject = projectUrl.trim().length > 0;
  // Sem Project: usa `/new?q=` nativo do claude.ai (pre-fill automático).
  // Com Project: abre a URL do Project (claude.ai não suporta ?q= dentro de
  // Projects), e copia o prompt pro clipboard pra Luiza colar com Cmd+V.
  const urlNovaConversa = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;

  async function abrirNoClaude() {
    if (temProject) {
      try {
        await navigator.clipboard.writeText(prompt);
        setStatus('copiado');
      } catch {
        setStatus('erro-copiar');
      }
      window.open(projectUrl.trim(), '_blank', 'noopener,noreferrer');
    } else {
      window.open(urlNovaConversa, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="space-y-5">
      {/* URL do Project no claude.ai */}
      <div className="card p-5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
          Project do Claude pra esse cliente
        </label>
        <p className="mt-1 text-[11.5px] text-t3">
          Cola aqui o link do <b>Project no claude.ai</b> onde moram as skills de calendário desse cliente.
          Fica salvo nesse navegador — você só precisa colar uma vez.
        </p>
        <input
          type="url"
          value={projectUrl}
          onChange={(e) => salvarProjectUrl(e.target.value)}
          placeholder="https://claude.ai/project/..."
          className="mt-2 w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
        />
        {!temProject && (
          <p className="mt-2 text-[11px] text-t3">
            Deixa em branco e eu abro uma conversa nova genérica no claude.ai com o briefing já no campo de digitação.
          </p>
        )}
      </div>

      {/* Mês/ano */}
      <div className="card p-5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
          Mês do calendário
        </label>
        <div className="mt-2 flex gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
          >
            {MESES_PT.map((m, i) => (
              <option key={m} value={i + 1}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-24 rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
          />
        </div>
      </div>

      {/* Objetivo */}
      <div className="card p-5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
          Objetivo do mês
        </label>
        <p className="mt-1 text-[11.5px] text-t3">
          Ex: lançamento de produto novo, aumentar engajamento, divulgar serviço X.
        </p>
        <textarea
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="O que queremos conquistar esse mês?"
          rows={3}
          className="mt-2 w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
        />
      </div>

      {/* Datas */}
      <div className="card p-5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
          Datas comemorativas / eventos
        </label>
        <p className="mt-1 text-[11.5px] text-t3">
          Uma por linha. Ex: <i>15/11 - Proclamação da República</i>. Pode deixar em branco que
          o <code className="rounded bg-bgSoft px-1 py-0.5 text-[11px]">especialista-em-datas</code> vai sugerir.
        </p>
        <textarea
          value={datas}
          onChange={(e) => setDatas(e.target.value)}
          placeholder="15/11 - Proclamação da República&#10;20/11 - Consciência Negra"
          rows={4}
          className="mt-2 w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
        />
      </div>

      {/* Observações */}
      <div className="card p-5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-t3">
          Observações extras
        </label>
        <p className="mt-1 text-[11.5px] text-t3">
          Qualquer contexto que o Claude precisa saber. Pautas que o cliente pediu, assuntos pra
          evitar, referências, campanhas em paralelo etc.
        </p>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Priorizar Reels nessa semana (performance maior). Evitar o tema X por..."
          rows={4}
          className="mt-2 w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[13px] text-ink"
        />
      </div>

      {/* Preview do prompt (toggle) */}
      <div className="card p-5">
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="text-[12px] font-semibold text-mauve transition hover:text-ink"
        >
          {preview ? '▾' : '▸'} Ver o prompt que vai pro Claude
        </button>
        {preview && (
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg bg-bgSoft p-4 font-mono text-[11px] leading-[1.6] text-t2">
            {prompt}
          </pre>
        )}
      </div>

      {/* Botões */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={abrirNoClaude}
          className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
        >
          {temProject ? 'Abrir no Project + copiar prompt →' : 'Abrir no Claude →'}
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setStatus('copiado');
            } catch {
              setStatus('erro-copiar');
            }
          }}
          className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-2 text-[12px] font-medium text-t2 transition hover:text-ink"
        >
          Copiar prompt
        </button>
        <span className="text-[11px] text-t3">
          {temProject
            ? 'Abre o Project numa aba nova. Prompt já no clipboard — cola com Cmd+V.'
            : 'Abre uma conversa nova no claude.ai com o briefing preenchido.'}
        </span>
      </div>

      {status === 'copiado' && (
        <div
          className="rounded-lg px-4 py-2 text-[12px]"
          style={{ background: 'var(--prazo-em-dia-soft)', color: 'var(--prazo-em-dia)' }}
        >
          ✓ Prompt copiado pro clipboard.
        </div>
      )}
      {status === 'erro-copiar' && (
        <div
          className="rounded-lg px-4 py-2 text-[12px]"
          style={{ background: 'var(--prazo-atrasado-soft)', color: 'var(--prazo-atrasado)' }}
        >
          Não consegui copiar automaticamente — usa o botão "Copiar prompt" ou copia do preview acima.
        </div>
      )}
    </div>
  );
}
