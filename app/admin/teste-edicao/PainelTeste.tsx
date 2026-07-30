'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IdeiaConstrucao } from './IdeiaConstrucao';

type RascunhoPauta = {
  ideia_texto: string;
  atualizado_em: string;
  publicado_em: string | null;
} | null;

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

type Modo = 'construcao' | 'cliente';

export function PainelTeste({
  postId,
  titulo,
  data,
  formatoTipo,
  projetoNome,
  ideia,
  legenda,
  tarefaAprovacaoPautaId,
  rascunhoPauta,
}: {
  postId: string;
  titulo: string;
  data: string;
  formatoTipo: string;
  projetoNome: string;
  ideia: string;
  legenda: string;
  tarefaAprovacaoPautaId: string | null;
  rascunhoPauta: RascunhoPauta;
}) {
  const [modo, setModo] = useState<Modo>('construcao');
  const notionUrl = `https://www.notion.so/${postId.replace(/-/g, '')}`;

  return (
    <div className="min-h-screen bg-bg pb-20">
      {/* Barra fina de contexto do sandbox */}
      <div
        className="border-b px-6 py-2 text-[11px]"
        style={{
          background: 'var(--prazo-hoje-soft)',
          borderColor: 'var(--prazo-hoje)',
          color: 'var(--prazo-hoje)',
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            🧪 <b>Sandbox</b> — escreve na sua página de teste do Notion.
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/teste-edicao" className="hover:underline">
              ← trocar página
            </Link>
            <a href={notionUrl} target="_blank" rel="noreferrer" className="hover:underline">
              abrir no Notion ↗
            </a>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 pt-8 space-y-5">
        {/* Cabeçalho — projeto + título + toggle de modo */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              {projetoNome}
            </div>
            <h1 className="mt-1 hub-section-title">
              {tituloSeguro(titulo)}
            </h1>
          </div>
          <ToggleModo modo={modo} onChange={setModo} />
        </div>

        {/* Meta em UM card só, usando entrega-meta do design system */}
        <div className="card p-5">
          <div className="entrega-meta">
            <MetaItem
              tone="info"
              icone="📅"
              label="Data postagem"
              value={fmtData(data)}
            />
            <MetaItem
              tone="warning"
              icone="●"
              label="Status"
              value="Em Produção"
            />
            <MetaItem
              icone="🎬"
              label="Formato"
              value={FORMATO_LABELS[formatoTipo] ?? 'Post'}
            />
            <MetaItem
              tone="danger"
              icone="⏰"
              label="Prazo aprovação"
              value="Hoje"
            />
          </div>
        </div>

        {/* Conteúdo — só um dos modos por vez */}
        {modo === 'construcao' ? (
          <ViewConstrucao
            postId={postId}
            ideiaNotion={ideia}
            rascunhoPauta={rascunhoPauta}
          />
        ) : (
          <ViewCliente
            postId={postId}
            ideiaPublicada={ideia}
            tarefaId={tarefaAprovacaoPautaId}
          />
        )}
      </main>
    </div>
  );
}

/* ─────────────── Toggle Construção / Cliente ─────────────── */

function ToggleModo({
  modo,
  onChange,
}: {
  modo: Modo;
  onChange: (m: Modo) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-[10px] border border-[rgba(21,21,33,0.1)] bg-white p-0.5 text-[11px] font-semibold">
      <button
        type="button"
        onClick={() => onChange('construcao')}
        className={`rounded-[8px] px-3 py-1.5 transition ${
          modo === 'construcao' ? 'bg-ink text-white' : 'text-t2 hover:text-ink'
        }`}
      >
        Construção
      </button>
      <button
        type="button"
        onClick={() => onChange('cliente')}
        className={`rounded-[8px] px-3 py-1.5 transition ${
          modo === 'cliente' ? 'bg-ink text-white' : 'text-t2 hover:text-ink'
        }`}
      >
        Ver como cliente
      </button>
    </div>
  );
}

/* ─────────────── Meta item usando classes do design system ─────────────── */

function MetaItem({
  icone,
  label,
  value,
  tone,
}: {
  icone: string;
  label: string;
  value: string;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}) {
  return (
    <div className="entrega-meta-item">
      <div className={`entrega-meta-icon ${tone ?? ''}`}>{icone}</div>
      <div className="min-w-0">
        <div className="entrega-meta-label">{label}</div>
        <div className={`entrega-meta-value ${tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : ''}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Modo Construção (equipe) ─────────────── */

function ViewConstrucao({
  postId,
  ideiaNotion,
  rascunhoPauta,
}: {
  postId: string;
  ideiaNotion: string;
  rascunhoPauta: RascunhoPauta;
}) {
  return (
    <>
      <IdeiaConstrucao
        postId={postId}
        ideiaNotion={ideiaNotion}
        rascunhoInicial={rascunhoPauta}
      />

      <div className="card p-5">
        <div className="label">Próximos campos (próxima rodada)</div>
        <ul className="mt-2 space-y-1.5 text-[12px] text-t2">
          <li>• Informações que precisamos pro post</li>
          <li>• Materiais que precisamos pro post</li>
          <li>• Roteiro voice over</li>
          <li>• Referências</li>
        </ul>
      </div>
    </>
  );
}

/* ─────────────── Modo Cliente (só-leitura + botões) ─────────────── */

function ViewCliente({
  postId,
  ideiaPublicada,
  tarefaId,
}: {
  postId: string;
  ideiaPublicada: string;
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
      setFeedback({ ok: true, msg: '✓ Pauta aprovada — tarefa fechada no Notion.' });
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
      setFeedback({ ok: true, msg: '✓ Alteração solicitada — volta pra equipe.' });
      setModo('idle');
      setComentario('');
    } catch (e: any) {
      setFeedback({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card p-5">
        <div className="label">Ideia do post</div>
        {ideiaPublicada?.trim() ? (
          <p className="mt-2 whitespace-pre-line text-[13px] leading-[1.6] text-ink">
            {ideiaPublicada}
          </p>
        ) : (
          <p className="mt-2 text-[12px] italic text-t3">
            — a equipe ainda não publicou uma ideia pra essa pauta —
          </p>
        )}
      </div>

      {!tarefaId ? (
        <div className="card p-4 text-[12px] leading-[1.5] text-t2">
          <b>Sem tarefa &quot;Aprovação | Pauta&quot; aberta.</b> Pra testar os
          botões de aprovar/pedir alteração, cria no Notion uma tarefa com
          esse título exato associada a essa página.
        </div>
      ) : modo === 'idle' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setModo('aprovando')}
            className="btn-primary justify-center"
          >
            ✓ Aprovar pauta
          </button>
          <button
            type="button"
            onClick={() => setModo('alterando')}
            className="btn-ghost justify-center"
          >
            Pedir alteração
          </button>
        </div>
      ) : (
        <div className="card p-5 space-y-3">
          <div>
            <label className="label">
              {modo === 'aprovando' ? 'Comentário (opcional)' : 'O que precisa mudar'}
            </label>
            <textarea
              rows={4}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="input min-h-[100px] resize-y text-[13px]"
              placeholder={
                modo === 'aprovando'
                  ? 'Algum recado pra equipe?'
                  : 'Explique o que precisa mudar na pauta'
              }
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={modo === 'aprovando' ? aprovar : pedirAlteracao}
              disabled={loading}
              className="btn-primary justify-center"
            >
              {loading
                ? 'Enviando…'
                : modo === 'aprovando'
                  ? 'Confirmar aprovação'
                  : 'Enviar alteração'}
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
        <p
          className={`prazo-pill ${feedback.ok ? 'em-dia' : 'atrasado'}`}
        >
          <span className="prazo-dot"></span>
          {feedback.msg}
        </p>
      )}
    </>
  );
}
