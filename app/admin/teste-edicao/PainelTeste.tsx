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

const ETAPAS: { id: Etapa; label: string; sub: string }[] = [
  { id: 'aprovacao-pauta',  label: 'Aprovação pauta',      sub: 'cliente vê a ideia' },
  { id: 'construcao-pauta', label: 'Construção pauta',     sub: 'equipe produz' },
  { id: 'aprovacao-post',   label: 'Aprovação post',       sub: 'cliente aprova o post' },
  { id: 'equipe',           label: 'Visão da equipe',      sub: 'dashboard completo' },
];

export function PainelTeste({
  postId,
  titulo,
  data,
  formatoTipo,
  projetoNome,
  ideia,
  legenda,
}: {
  postId: string;
  titulo: string;
  data: string;
  formatoTipo: string;
  projetoNome: string;
  ideia: string;
  legenda: string;
}) {
  const [etapa, setEtapa] = useState<Etapa>('aprovacao-pauta');
  const notionUrl = `https://www.notion.so/${postId.replace(/-/g, '')}`;

  return (
    <div className="min-h-screen bg-bgSoft/40 pb-20">
      {/* Barra fina do sandbox */}
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
        {/* Título + projeto */}
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-t3">
            {projetoNome}
          </div>
          <h1 className="mt-1 text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-ink">
            {tituloSeguro(titulo)}
          </h1>
        </div>

        {/* Meta em grid compacto — data primeiro, status prioritário */}
        <div className="grid grid-cols-2 gap-2.5">
          <InfoCard label="Data de postagem" value={fmtData(data)} />
          <InfoCard label="Status" value="Em Produção" tone="status" />
          <InfoCard label="Formato" value={FORMATO_LABELS[formatoTipo] ?? 'Post'} />
          <InfoCard label="Prazo aprovação" value="Hoje" tone="urgent" />
        </div>

        {/* Seletor de etapa — 4 chips grandes com sublabel */}
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
                  className={`rounded-xl border p-2.5 text-left transition ${
                    ativo
                      ? 'border-ink bg-ink text-white shadow-sm'
                      : 'border-[rgba(21,21,33,0.1)] bg-white text-ink hover:border-ink/40'
                  }`}
                >
                  <div className="text-[12px] font-semibold leading-tight">{e.label}</div>
                  <div
                    className={`mt-0.5 text-[10px] leading-tight ${
                      ativo ? 'text-white/70' : 'text-t3'
                    }`}
                  >
                    {e.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Views por etapa */}
        {etapa === 'aprovacao-pauta' && (
          <ViewAprovacaoPauta postId={postId} ideia={ideia} />
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

/* ─────────── Cards de meta reaproveitando o estilo do /post/[id] ─────────── */

function InfoCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'urgent' | 'status';
}) {
  const styles = {
    base: 'card',
    urgent: 'bg-hubRed border-transparent text-white',
    status: 'text-white border-transparent',
  };

  const bg =
    tone === 'status'
      ? { background: 'var(--prazo-hoje)' } // laranja "em produção"
      : undefined;

  return (
    <div
      className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 ${
        tone === 'urgent' ? styles.urgent : tone === 'status' ? styles.status : styles.base
      }`}
      style={bg}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
          tone ? 'text-white/80' : 'text-t3'
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-[12px] ${
          tone ? 'text-white font-semibold' : 'text-t1'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────────── Views por etapa ─────────────────────────── */

/** ETAPA 1 — Aprovação de pauta: cliente vê a ideia e aprova antes de produzir. */
function ViewAprovacaoPauta({ postId, ideia }: { postId: string; ideia: string }) {
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

      <div className="grid grid-cols-2 gap-2.5">
        <BotaoAcao cor="var(--prazo-em-dia)" icon="✓">Aprovar pauta</BotaoAcao>
        <BotaoAcao cor="var(--prazo-chegando)" icon="✏️">Pedir alteração</BotaoAcao>
      </div>

      <PendenteCard titulo="Comentários" descricao="Histórico dos comentários da pauta" />
    </div>
  );
}

/** ETAPA 2 — Construção da pauta pra equipe: campos editáveis pra time da Lud. */
function ViewConstrucaoPauta({ postId, ideia }: { postId: string; ideia: string }) {
  return (
    <div className="space-y-4">
      <ContextBar cor="var(--prazo-hoje)">
        Equipe da Lud. constrói o material. Todos os campos abaixo são <b>editáveis</b> e escrevem no Notion.
      </ContextBar>

      <IdeiaEditavel postId={postId} ideiaInicial={ideia} podeEditar={true} />
      <PendenteCard titulo="📣 Informações que precisamos" descricao="editor inline — próxima rodada" />
      <PendenteCard titulo="🎬 Materiais que precisamos"    descricao="editor inline — próxima rodada" />
      <PendenteCard titulo="✋ Roteiro voice over"           descricao="editor inline — próxima rodada" />
      <PendenteCard titulo="🔗 Referências"                  descricao="lista de links + prints — próxima rodada" />
    </div>
  );
}

/** ETAPA 3 — Aprovação do post cliente: preview + legenda, cliente aprova o post final. */
function ViewAprovacaoPost({ postId, legenda }: { postId: string; legenda: string }) {
  return (
    <div className="space-y-4">
      <ContextBar cor="var(--prazo-chegando)">
        Cliente vê o <b>post pronto</b> (preview + legenda) e aprova antes de programar.
      </ContextBar>

      <PendenteCard titulo="Preview do post" descricao="Preview visual do carrossel/reels — próxima rodada" />
      <LegendaEditavel postId={postId} legendaInicial={legenda || ''} />

      <div className="grid grid-cols-2 gap-2.5">
        <BotaoAcao cor="var(--prazo-em-dia)" icon="✓">Aprovar post</BotaoAcao>
        <BotaoAcao cor="var(--prazo-chegando)" icon="✏️">Pedir alteração</BotaoAcao>
      </div>

      <PendenteCard titulo="Comentários" descricao="Histórico de comentários no post" />
    </div>
  );
}

/** ETAPA 4 — Visão da equipe: dashboard interno com tudo. */
function ViewEquipe({ postId, ideia, legenda }: { postId: string; ideia: string; legenda: string }) {
  return (
    <div className="space-y-4">
      <ContextBar cor="var(--ink)">
        Dashboard interno — a equipe vê tudo (briefing, materiais, preview, legenda, tarefas, status).
      </ContextBar>

      <IdeiaEditavel postId={postId} ideiaInicial={ideia} podeEditar={true} />
      <LegendaEditavel postId={postId} legendaInicial={legenda || ''} />

      <div className="grid grid-cols-2 gap-3">
        <PendenteCard titulo="📣 Informações" descricao="—" />
        <PendenteCard titulo="🎬 Materiais"   descricao="—" />
        <PendenteCard titulo="✋ Roteiro VO"  descricao="—" />
        <PendenteCard titulo="🔗 Referências" descricao="—" />
      </div>

      <PendenteCard titulo="✅ Tarefas do post" descricao="Kanban das tarefas atuais — próxima rodada" />
      <PendenteCard titulo="💬 Comentários"     descricao="Histórico completo — próxima rodada" />
    </div>
  );
}

/* ────────────────────────── Componentes auxiliares ────────────────────────── */

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

function BotaoAcao({
  children,
  cor,
  icon,
}: {
  children: React.ReactNode;
  cor: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold text-white transition hover:brightness-110"
      style={{ background: cor }}
      disabled
      title="preview visual — sem ação nessa rodada"
    >
      <span>{icon}</span> {children}
    </button>
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
