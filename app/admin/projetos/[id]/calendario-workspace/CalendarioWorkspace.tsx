'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarioWorkspace, CalendarioVersao } from '@/lib/supabase';

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

type HistoricoItem = {
  ano: number;
  mes: number;
  atualizadoEm: string | null;
  versoesCount: number;
  temRascunho: boolean;
};

type Props = {
  projetoId: string;
  projetoNome: string;
  clienteNome: string;
  ano: number;
  mes: number;
  inicial: CalendarioWorkspace | null;
  historico: HistoricoItem[];
};

export function CalendarioWorkspace({
  projetoId, projetoNome, clienteNome, ano, mes, inicial, historico,
}: Props) {
  const [briefingLivre, setBriefingLivre] = useState(inicial?.briefingLivre ?? '');
  const [rascunho, setRascunho] = useState(inicial?.rascunho ?? '');
  const [feedbacks, setFeedbacks] = useState(inicial?.feedbacks ?? '');
  const [projectClaudeUrl, setProjectClaudeUrl] = useState(inicial?.projectClaudeUrl ?? '');
  const [versoes, setVersoes] = useState<CalendarioVersao[]>(inicial?.versoes ?? []);
  const [salvandoStatus, setSalvandoStatus] = useState<'ocioso' | 'salvando' | 'salvo' | 'erro'>('ocioso');
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(inicial?.atualizadoEm ?? null);
  const [copiado, setCopiado] = useState(false);

  // Debounced auto-save — qualquer alteração em briefing/rascunho/feedbacks/url
  // dispara um salvamento 1500ms depois. Evita hit por tecla.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiroRender = useRef(true);
  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSalvandoStatus('salvando');
    timeoutRef.current = setTimeout(async () => {
      try {
        const r = await fetch('/api/calendario-workspace/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projetoId, ano, mes,
            briefingLivre, rascunho, feedbacks,
            projectClaudeUrl: projectClaudeUrl.trim() || null,
          }),
        });
        const data = await r.json();
        if (r.ok) {
          setSalvandoStatus('salvo');
          setAtualizadoEm(data.atualizadoEm ?? new Date().toISOString());
        } else {
          setSalvandoStatus('erro');
        }
      } catch {
        setSalvandoStatus('erro');
      }
    }, 1500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [briefingLivre, rascunho, feedbacks, projectClaudeUrl, projetoId, ano, mes]);

  const temProject = projectClaudeUrl.trim().length > 0;
  const nomeMes = MESES_PT[mes - 1];

  // Prompt que vai pro Claude — compõe briefing livre + rascunho atual + feedbacks.
  const promptParaClaude = useMemo(() => {
    const partes: string[] = [];
    partes.push(
      `Trabalhando no calendário de **${nomeMes} de ${ano}** pro cliente **${clienteNome}** (projeto: ${projetoNome}).`,
      '',
    );
    if (briefingLivre.trim()) {
      partes.push('## Contexto / Briefing', briefingLivre.trim(), '');
    }
    if (rascunho.trim()) {
      partes.push('## Rascunho atual do calendário', '```', rascunho.trim(), '```', '');
    } else {
      partes.push(
        'Começa do zero. Roda `/planejamento-mensal` se tiver essa skill, senão o pipeline manual: `agente-inteligencia` → `especialista-em-datas` → `estrategista-instagram`.',
        'Lê o briefing do cliente em `Clientes/' + clienteNome + '/Estrategia/` e o `regras-aprendidas.md` dele antes.',
        '',
      );
    }
    if (feedbacks.trim()) {
      partes.push('## Feedbacks pra próxima rodada', feedbacks.trim(), '');
    }
    partes.push(
      '---',
      'Me entrega a nova versão do calendário em markdown — uma linha por post com data, formato (Carrossel/Reels/Stories), título e ideia curta — pronto pra eu colar de volta no portal.',
    );
    return partes.join('\n');
  }, [nomeMes, ano, clienteNome, projetoNome, briefingLivre, rascunho, feedbacks]);

  async function abrirNoClaude() {
    if (temProject) {
      try {
        await navigator.clipboard.writeText(promptParaClaude);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 4000);
      } catch {
        /* segue abrindo mesmo sem clipboard */
      }
      window.open(projectClaudeUrl.trim(), '_blank', 'noopener,noreferrer');
    } else {
      const url = `https://claude.ai/new?q=${encodeURIComponent(promptParaClaude)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async function salvarVersao() {
    if (!rascunho.trim()) {
      alert('Não há rascunho pra salvar. Cola o calendário que o Claude gerou primeiro.');
      return;
    }
    setSalvandoStatus('salvando');
    const r = await fetch('/api/calendario-workspace/versao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projetoId, ano, mes }),
    });
    const data = await r.json();
    if (r.ok) {
      setVersoes(data.versoes);
      setSalvandoStatus('salvo');
    } else {
      setSalvandoStatus('erro');
      alert('Não consegui salvar a versão: ' + (data.error ?? 'erro'));
    }
  }

  function trocarMes(novoAno: number, novoMes: number) {
    const ym = `${novoAno}-${String(novoMes).padStart(2, '0')}`;
    window.location.href = `/admin/projetos/${projetoId}/calendario-workspace?mes=${ym}`;
  }

  function restaurarVersao(v: CalendarioVersao) {
    if (!confirm(`Restaurar v${v.numero}? O rascunho atual será sobrescrito (mas as versões salvas ficam).`)) return;
    setRascunho(v.rascunho);
    setFeedbacks(v.feedbacks);
  }

  return (
    <div className="mt-3">
      {/* Título + status de save */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
            Workspace de calendário
          </h1>
          <p className="mt-0.5 text-[13px] text-t2">
            {clienteNome} · {nomeMes} de {ano}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SelectorMes ano={ano} mes={mes} onTrocar={trocarMes} />
          <StatusSalvo status={salvandoStatus} atualizadoEm={atualizadoEm} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ─────────── Sidebar: contexto ─────────── */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100dvh_-_40px)] lg:overflow-y-auto lg:pr-2">
          {/* Project URL */}
          <div className="card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Project no claude.ai
            </div>
            <input
              type="url"
              value={projectClaudeUrl}
              onChange={(e) => setProjectClaudeUrl(e.target.value)}
              placeholder="https://claude.ai/project/..."
              className="mt-2 w-full rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 text-[12px] text-ink"
            />
            <p className="mt-1.5 text-[10.5px] text-t3">
              Fica salvo. Quando preenchido, o botão "Continuar no Claude" abre o Project e copia o prompt pro clipboard.
            </p>
          </div>

          {/* Briefing livre */}
          <div className="card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
                Briefing & especificações
              </div>
              <span className="text-[10px] text-t3">auto-save</span>
            </div>
            <textarea
              value={briefingLivre}
              onChange={(e) => setBriefingLivre(e.target.value)}
              placeholder="Cola aqui o briefing do cliente, pilares de conteúdo, tom de voz, formatos preferidos, horário de postagem, histórico recente, ou qualquer coisa que o Claude precisa saber sempre que você for criar um calendário desse cliente."
              rows={14}
              className="mt-2 w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2 font-mono text-[11.5px] leading-[1.5] text-ink"
            />
          </div>

          {/* Histórico de calendários */}
          <div className="card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
              Últimos calendários desse projeto
            </div>
            {historico.length === 0 ? (
              <p className="mt-2 text-[12px] text-t3">Nenhum ainda — esse é o primeiro.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {historico.map((h) => {
                  const atual = h.ano === ano && h.mes === mes;
                  return (
                    <li key={`${h.ano}-${h.mes}`}>
                      <button
                        type="button"
                        onClick={() => (atual ? null : trocarMes(h.ano, h.mes))}
                        disabled={atual}
                        className={`block w-full rounded-md px-2 py-1.5 text-left text-[12px] transition ${
                          atual
                            ? 'bg-bgSoft font-semibold text-ink'
                            : 'text-t2 hover:bg-bgSoft hover:text-ink'
                        }`}
                      >
                        <span>
                          {MESES_PT[h.mes - 1]} {h.ano}
                        </span>
                        <span className="ml-2 text-[10.5px] text-t3">
                          {h.temRascunho ? `${h.versoesCount} versão${h.versoesCount === 1 ? '' : 'ões'}` : 'vazio'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ─────────── Main: criação ─────────── */}
        <main className="space-y-4">
          {/* Rascunho */}
          <div className="card p-5">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">Rascunho atual</h2>
                <p className="mt-0.5 text-[11.5px] text-t3">
                  Cola aqui o calendário que o Claude te mandar. Você pode editar à vontade — tudo é salvo automaticamente.
                </p>
              </div>
              <span className="text-[10px] text-t3">auto-save</span>
            </div>
            <textarea
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              placeholder="Ex:&#10;01/11 - Reels - &quot;Melhores spots pra fotos em Veneza&quot;&#10;03/11 - Carrossel - &quot;5 restaurantes escondidos em Paris&quot;&#10;..."
              rows={18}
              className="mt-3 w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2.5 font-mono text-[12.5px] leading-[1.6] text-ink"
            />
          </div>

          {/* Feedbacks */}
          <div className="card p-5">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">Feedbacks pra próxima rodada</h2>
                <p className="mt-0.5 text-[11.5px] text-t3">
                  O que mudar? Quais posts tirar? Adicionar? Isso vai pro Claude na próxima vez que você abrir o Project.
                </p>
              </div>
              <span className="text-[10px] text-t3">auto-save</span>
            </div>
            <textarea
              value={feedbacks}
              onChange={(e) => setFeedbacks(e.target.value)}
              placeholder="Ex:&#10;- Tirar o post do dia 05 (muito parecido com o de outubro)&#10;- Trocar o Reels do 12 por um Carrossel sobre X&#10;- Adicionar algo pra o lançamento do roteiro Y no dia 20"
              rows={8}
              className="mt-3 w-full resize-y rounded-lg border border-[rgba(21,21,33,0.13)] bg-white px-3 py-2.5 text-[12.5px] leading-[1.6] text-ink"
            />
          </div>

          {/* Ações */}
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={abrirNoClaude}
                className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
              >
                {temProject ? '📋 Copiar prompt + abrir Project →' : '→ Abrir no Claude'}
              </button>
              <button
                type="button"
                onClick={salvarVersao}
                className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-4 py-2 text-[12px] font-medium text-t2 transition hover:text-ink"
              >
                💾 Salvar como nova versão
              </button>
              {copiado && (
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ background: 'var(--prazo-em-dia-soft)', color: 'var(--prazo-em-dia)' }}
                >
                  ✓ Prompt copiado — Cmd+V dentro do Project
                </span>
              )}
            </div>
          </div>

          {/* Histórico de versões */}
          {versoes.length > 0 && (
            <div className="card p-5">
              <h2 className="text-[14px] font-semibold text-ink">Versões salvas</h2>
              <p className="mt-0.5 text-[11.5px] text-t3">
                Snapshots do rascunho + feedbacks de cada vez que você apertou "Salvar como nova versão".
              </p>
              <div className="mt-3 divide-y divide-[rgba(21,21,33,0.06)]">
                {[...versoes].reverse().map((v) => (
                  <details key={v.id} className="group py-3">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
                      <div>
                        <span className="text-[13px] font-semibold text-ink">v{v.numero}</span>
                        <span className="ml-3 text-[11.5px] text-t3">
                          {new Date(v.criado_em).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); restaurarVersao(v); }}
                        className="rounded-full border border-[rgba(21,21,33,0.13)] bg-white px-3 py-1 text-[11px] font-medium text-t2 transition hover:text-ink"
                      >
                        Restaurar
                      </button>
                    </summary>
                    <div className="mt-3 space-y-3 pl-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">Rascunho</div>
                        <pre className="mt-1 max-h-[280px] overflow-auto whitespace-pre-wrap rounded-md bg-bgSoft p-3 font-mono text-[11px] leading-[1.5] text-t2">
                          {v.rascunho || '(vazio)'}
                        </pre>
                      </div>
                      {v.feedbacks.trim() && (
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">Feedbacks</div>
                          <pre className="mt-1 max-h-[160px] overflow-auto whitespace-pre-wrap rounded-md bg-bgSoft p-3 text-[11px] leading-[1.5] text-t2">
                            {v.feedbacks}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* Preview do prompt — fica no fim, discreto */}
          <details className="card p-5">
            <summary className="cursor-pointer text-[12px] font-semibold text-mauve transition hover:text-ink">
              Ver o prompt que vai pro Claude
            </summary>
            <pre className="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg bg-bgSoft p-4 font-mono text-[11px] leading-[1.6] text-t2">
              {promptParaClaude}
            </pre>
          </details>
        </main>
      </div>
    </div>
  );
}

function SelectorMes({
  ano, mes, onTrocar,
}: {
  ano: number; mes: number; onTrocar: (ano: number, mes: number) => void;
}) {
  function nav(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    onTrocar(novoAno, novoMes);
  }
  return (
    <div className="flex items-center gap-1 rounded-full bg-bgSoft p-1">
      <button
        type="button"
        onClick={() => nav(-1)}
        className="rounded-full px-2.5 py-1 text-[12px] text-ink transition hover:bg-white"
      >
        ‹
      </button>
      <span className="min-w-[130px] px-2 text-center text-[12px] font-semibold text-ink">
        {MESES_PT[mes - 1]} {ano}
      </span>
      <button
        type="button"
        onClick={() => nav(1)}
        className="rounded-full px-2.5 py-1 text-[12px] text-ink transition hover:bg-white"
      >
        ›
      </button>
    </div>
  );
}

function StatusSalvo({
  status, atualizadoEm,
}: {
  status: 'ocioso' | 'salvando' | 'salvo' | 'erro';
  atualizadoEm: string | null;
}) {
  if (status === 'salvando') return <span className="text-[11px] text-t3">Salvando…</span>;
  if (status === 'erro') return <span className="text-[11px] text-[var(--prazo-atrasado)]">Erro ao salvar</span>;
  if (status === 'salvo' || (status === 'ocioso' && atualizadoEm)) {
    return (
      <span className="text-[11px] text-t3">
        Salvo
        {atualizadoEm && ` · ${new Date(atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
      </span>
    );
  }
  return <span className="text-[11px] text-t3">—</span>;
}
