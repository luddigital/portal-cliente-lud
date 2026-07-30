'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IdeiaEditavel } from '@/app/post/[id]/IdeiaEditavel';
import { LegendaEditavel } from '@/app/post/[id]/LegendaEditavel';

function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim) return 'Sem título';
  if (/^https?:\/\/\S+$/.test(trim) && !trim.includes(' ')) return 'Sem título';
  return trim;
}

function fmtData(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

const FORMATO_LABELS: Record<string, string> = {
  post: 'Carrossel',
  reels: 'Reels',
  story: 'Stories',
  desconhecido: 'Post',
};

type Etapa = 'aprovacao-pauta' | 'construcao-pauta' | 'aprovacao-post' | 'equipe';

const ETAPAS: { id: Etapa; label: string; sub: string; foco: boolean }[] = [
  { id: 'aprovacao-pauta',  label: 'Aprovação pauta',  sub: 'cliente vê a ideia',    foco: true  },
  { id: 'construcao-pauta', label: 'Construção pauta', sub: 'equipe produz',          foco: true  },
  { id: 'aprovacao-post',   label: 'Aprovação post',   sub: 'cliente aprova o post',  foco: false },
  { id: 'equipe',           label: 'Visão da equipe',  sub: 'dashboard completo',     foco: false },
];

export function PainelTeste({
  postId,
  titulo,
  data,
  formatoTipo,
  projetoNome,
  ideia,
  legenda,
  tarefaAprovacaoPautaId,
}: {
  postId: string;
  titulo: string;
  data: string;
  formatoTipo: string;
  projetoNome: string;
  ideia: string;
  legenda: string;
  tarefaAprovacaoPautaId: string | null;
}) {
  const [etapa, setEtapa] = useState<Etapa>('aprovacao-pauta');
  const notionUrl = `https://www.notion.so/${postId.replace(/-/g, '')}`;

  return (
    <div className="min-h-screen bg-bgSoft/40 pb-20">
      <div
        className="border-b px-6 py-2 text-[11px]"
        style={{
          background: 'var(--prazo-hoje-soft)',
          borderColor: 'var(--prazo-hoje)',
          color: 'var(--prazo-hoje)',
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>🧪 <b>Sandbox</b> — escreve direto na sua página de teste do Notion.</div>
          <div className="flex items-center gap-3">
            <Link href="/admin/teste-edicao" className="hover:underline">← trocar página</Link>
            <a href={notionUrl} target="_blank" rel="noreferrer" className="hover:underline">
              abrir no Notion ↗
            </a>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 pt-8 space-y-5">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-t3">
            {projetoNome}
          </div>
          <h1 className="mt-1 text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-ink">
            {tituloSeguro(titulo)}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <InfoCard label="Data de postagem" value={fmtData(data)} />
          <InfoCard label="Status" value="Em Produção" tone="status" />
          <InfoCard label="Formato" value={FORMATO_LABELS[formatoTipo] ?? 'Post'} />
          <InfoCard label="Prazo aprovação" value="Hoje" tone="urgent" />
        </div>

        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Testar layout de etapa
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {ETAPAS.map((e) => {
              const ativo = e.id === etapa;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEtapa(e.id)}
                  className={`relative rounded-xl border p-2.5 text-left transition ${
                    ativo
                      ? 'border-ink bg-ink text-white shadow-sm'
                      : e.foco
                        ? 'border-[rgba(21,21,33,0.12)] bg-white text-ink hover:border-ink/40'
                        : 'border-dashed border-[rgba(21,21,33,0.1)] bg-white/40 text-t3 hover:text-ink'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="text-[12px] font-semibold leading-tight">
                      {e.label}
                    </div>
                    {e.foco && !ativo && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase"
                        style={{
                          background: 'var(--prazo-em-dia-soft)',
                          color: 'var(--prazo-em-dia)',
                        }}
                      >
                        foco
                      </span>
                    )}
                  </div>
                  <div className={`mt-0.5 text-[10px] leading-tight ${
                    ativo ? 'text-white/70' : 'text-t3'
                  }`}>
                    {e.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {etapa === 'aprovacao-pauta' && (
          <ViewAprovacaoPauta
            postId={postId}
            ideia={ideia}
            tarefaId={tarefaAprovacaoPautaId}
          />
        )}
        {etapa === 'construcao-pauta' && (
          <ViewConstrucaoPauta postId={postId} ideia={ideia} />
        )}
        {etapa === 'aprovacao-post' && (
          <ViewAprovacaoPost postId={postId} legenda={legenda} />
        )}
        {etapa === 'equipe' && (
          <ViewEquipe postId={postId} ideia={ideia} legenda={legenda} />
        )}
      </main>
    </div>
  );
}

/* ─────────── Cards de meta ─────────── */

function InfoCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'urgent' | 'status';
}) {
  const bg =
    tone === 'status' ? { background: 'var(--prazo-hoje)' } : undefined;
  const classe =
    tone === 'urgent'
      ? 'bg-hubRed border-transparent text-white'
      : tone === 'status'
        ? 'text-white border-transparent'
        : 'card';
  return (
    <div
      className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 ${classe}`}
      style={bg}
    >
      <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
        tone ? 'text-white/80' : 'text-t3'
      }`}>
        {label}
      </span>
      <span className={`font-mono text-[12px] ${
        tone ? 'text-white font-semibold' : 'text-t1'
      }`}>
        {value}
      </span>
    </div>
  );
}

/* ─────────── ETAPA 1: Aprovação de pauta (cliente) ─────────── */

function ViewAprovacaoPauta({
  postId,
  ideia,
  tarefaId,
}: {
  postId: string;
  ideia: string;
  tarefaId: string | null;
}) {
  const [modo, setModo] = useState<'idle' | 'aprovando' | 'alterando'>('idle');
  const [comentario, setComentario] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function aprovar() {
    if (!tarefaId) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/aprovar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setFeedback({ ok: true, msg: '✓ Pauta aprovada. A tarefa foi fechada no Notion.' });
      setModo('idle');
      setComentario('');
    } catch (e: any) {
      setFeedback({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function pedirAlteracao() {
    if (!tarefaId) return;
    if (!comentario.trim()) {
      setFeedback({ ok: false, msg: 'Escreva o que precisa alterar.' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/alterar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comentario: comentario.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setFeedback({ ok: true, msg: '✓ Alteração solicitada. Volta pra equipe no Notion.' });
      setModo('idle');
      setComentario('');
    } catch (e: any) {
      setFeedback({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ContextBar cor="var(--prazo-chegando)">
        Cliente vê a <b>ideia</b> e decide se aprova ou pede alteração <b>antes</b> da produção.
      </ContextBar>

      <div className="card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          Ideia do post
        </div>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
          {ideia?.trim() || <span className="italic text-t3">— nenhuma ideia escrita ainda —</span>}
        </p>
      </div>

      {!tarefaId ? (
        <div
          className="rounded-xl border p-4 text-[12px] leading-[1.5]"
          style={{
            background: 'var(--prazo-chegando-soft)',
            borderColor: 'var(--prazo-chegando)',
            color: 'var(--prazo-chegando)',
          }}
        >
          <b>Sem tarefa &quot;Aprovação | Pauta&quot; aberta.</b> Pra testar os
          botões de verdade, crie no Notion uma tarefa com título exatamente{' '}
          <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">
            Aprovação | Pauta
          </code>{' '}
          associada a essa página, e recarregue aqui.
        </div>
      ) : modo === 'idle' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setModo('aprovando')}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold text-white transition hover:brightness-110"
            style={{ background: 'var(--prazo-em-dia)' }}
          >
            ✓ Aprovar pauta
          </button>
          <button
            type="button"
            onClick={() => setModo('alterando')}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold text-white transition hover:brightness-110"
            style={{ background: 'var(--prazo-chegando)' }}
          >
            ✏️ Pedir alteração
          </button>
        </div>
      ) : (
        <div className="card p-4 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            {modo === 'aprovando' ? 'Aprovar (comentário opcional)' : 'O que precisa mudar'}
          </div>
          <textarea
            rows={4}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="input resize-y text-[13px] leading-[1.5]"
            placeholder={
              modo === 'aprovando'
                ? 'Ex: aprovado, só ajustar o gancho na hora da copy'
                : 'Explique o que precisa mudar na pauta'
            }
            disabled={loading}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={modo === 'aprovando' ? aprovar : pedirAlteracao}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110"
              style={{
                background:
                  modo === 'aprovando'
                    ? 'var(--prazo-em-dia)'
                    : 'var(--prazo-chegando)',
              }}
            >
              {loading ? 'Enviando…' : modo === 'aprovando' ? 'Confirmar aprovação' : 'Enviar alteração'}
            </button>
            <button
              type="button"
              onClick={() => { setModo('idle'); setComentario(''); }}
              disabled={loading}
              className="btn-ghost"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className="rounded-xl p-3 text-[12px] font-medium"
          style={{
            background: feedback.ok ? 'var(--prazo-em-dia-soft)' : 'rgba(224,49,49,0.08)',
            color: feedback.ok ? 'var(--prazo-em-dia)' : 'var(--hubRed, #E03131)',
          }}
        >
          {feedback.msg}
        </div>
      )}
    </div>
  );
}

/* ─────────── ETAPA 2: Construção pauta (equipe) ─────────── */

function ViewConstrucaoPauta({ postId, ideia }: { postId: string; ideia: string }) {
  return (
    <div className="space-y-4">
      <ContextBar cor="var(--prazo-hoje)">
        Equipe da Lud. constrói o material. <b>Ideia</b> já é editável e escreve
        no Notion. Os outros campos entram na próxima rodada de endpoints.
      </ContextBar>

      <IdeiaEditavel postId={postId} ideiaInicial={ideia} podeEditar={true} />
      <PendenteCard titulo="📣 Informações que precisamos" descricao="editor inline — próxima rodada" />
      <PendenteCard titulo="🎬 Materiais que precisamos"    descricao="editor inline — próxima rodada" />
      <PendenteCard titulo="✋ Roteiro voice over"           descricao="editor inline — próxima rodada" />
      <PendenteCard titulo="🔗 Referências"                  descricao="lista de links + prints — próxima rodada" />
    </div>
  );
}

/* ─────────── ETAPA 3 e 4 — parked ─────────── */

function ViewAprovacaoPost({ postId, legenda }: { postId: string; legenda: string }) {
  return (
    <div className="space-y-4">
      <ContextBar cor="var(--t3)">
        Etapa parada — foco atual está na aprovação de pauta.
      </ContextBar>
      <PendenteCard titulo="Preview do post" descricao="Preview visual do carrossel/reels — próxima rodada" />
      <LegendaEditavel postId={postId} legendaInicial={legenda || ''} />
    </div>
  );
}

function ViewEquipe({ postId, ideia, legenda }: { postId: string; ideia: string; legenda: string }) {
  return (
    <div className="space-y-4">
      <ContextBar cor="var(--t3)">
        Etapa parada — foco atual está na aprovação e construção de pauta.
      </ContextBar>
      <IdeiaEditavel postId={postId} ideiaInicial={ideia} podeEditar={true} />
      <LegendaEditavel postId={postId} legendaInicial={legenda || ''} />
    </div>
  );
}

/* ─────────── Aux ─────────── */

function ContextBar({ children, cor }: { children: React.ReactNode; cor: string }) {
  return (
    <div
      className="rounded-xl border-l-[3px] bg-white/70 px-3.5 py-2 text-[12px] leading-[1.5] text-t2"
      style={{ borderLeftColor: cor }}
    >
      {children}
    </div>
  );
}

function PendenteCard({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          {titulo}
        </div>
        <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[9px] font-medium text-t3">
          próxima rodada
        </span>
      </div>
      <p className="mt-2 text-[12px] italic text-t3">{descricao}</p>
    </div>
  );
}
