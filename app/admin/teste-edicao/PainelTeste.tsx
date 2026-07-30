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

function fmtDataCurta(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const FORMATO_LABELS: Record<string, string> = {
  post: 'Carrossel',
  reels: 'Reels',
  story: 'Stories',
  desconhecido: 'Post',
};

type Aba = 'post' | 'materiais' | 'lud';

/** Sandbox de edição inline. Organização inspirada no Notion (título grande,
 *  propriedades em linha, tabs Post/Materiais/Lud, seções) — visual em cards
 *  do design system do portal. */
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
  const [aba, setAba] = useState<Aba>('lud');
  const notionUrl = `https://www.notion.so/${postId.replace(/-/g, '')}`;

  return (
    <div className="min-h-screen bg-bgSoft/40 pb-16">
      {/* Barra fina do sandbox */}
      <div
        className="border-b px-6 py-2 text-[11px]"
        style={{
          background: 'var(--prazo-hoje-soft)',
          borderColor: 'var(--prazo-hoje)',
          color: 'var(--prazo-hoje)',
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            🧪 <b>Sandbox</b> — edição vai direto na sua página de teste do Notion.
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

      <main className="mx-auto max-w-3xl px-6 pt-10 space-y-6">
        {/* Header — card com título grande + propriedades + tabs */}
        <div className="card p-6">
          <div className="text-[44px] leading-none mb-3">📱</div>
          <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.03em] text-ink">
            {tituloSeguro(titulo)}
          </h1>

          <div className="mt-4 space-y-1.5 text-[13px]">
            <Prop label="Projeto"       valor={projetoNome} />
            <Prop label="Data Postagem" valor={fmtDataCurta(data)} />
            <Prop label="Formato"       valor={FORMATO_LABELS[formatoTipo] ?? 'Post'} />
            <Prop label="Status"        valor="Em Produção" mudo />
          </div>

          <div className="mt-6 flex gap-4 border-b border-[rgba(21,21,33,0.08)]">
            <TabBtn ativo={aba === 'post'}      onClick={() => setAba('post')}>Post</TabBtn>
            <TabBtn ativo={aba === 'materiais'} onClick={() => setAba('materiais')}>Informações e Materiais</TabBtn>
            <TabBtn ativo={aba === 'lud'}       onClick={() => setAba('lud')}>Lud</TabBtn>
          </div>
        </div>

        {aba === 'post' && (
          <>
            <PendenteCard titulo="Vídeo" descricao="Upload/embed do vídeo — ainda vive no Notion nessa rodada." />
            <LegendaEditavel postId={postId} legendaInicial={legenda || ''} />
          </>
        )}

        {aba === 'materiais' && (
          <>
            <PendenteCard
              titulo="📣 Informações que precisamos para o post"
              descricao="editor do callout de informações — próxima rodada"
            />
            <PendenteCard
              titulo="🎬 Materiais que precisamos para o post"
              descricao="editor do callout de materiais — próxima rodada"
            />
            <PendenteCard
              titulo="✋ Texto para gravação de Voice Over"
              descricao="editor do roteiro voice over — próxima rodada"
            />
          </>
        )}

        {aba === 'lud' && (
          <>
            <IdeiaEditavel postId={postId} ideiaInicial={ideia} podeEditar={true} />
            <PendenteCard titulo="Referências para o post" descricao="Bloco de referências — próxima rodada" />
            <PendenteCard titulo="Materiais" descricao="Checklist e links do material — próxima rodada" />
          </>
        )}

        <div className="rounded-lg border border-dashed border-[rgba(21,21,33,0.13)] bg-white/60 p-4 text-[12px] leading-[1.6] text-t3">
          <b className="text-t2">Nessa rodada</b>: Ideia/Briefing e Legenda são editáveis
          (escrevem direto no Notion via API). <b className="text-t2">Próxima</b>: mesmos
          endpoints pros callouts de Informações, Materiais e Roteiro voice over.{' '}
          <b className="text-t2">Depois</b>: título e data (properties do Notion, já
          suportadas) + botão &quot;+ Novo post&quot; que cria no template canônico.
        </div>
      </main>
    </div>
  );
}

function Prop({ label, valor, mudo = false }: { label: string; valor: string; mudo?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-[130px] shrink-0 text-t3">{label}</span>
      <span className={mudo ? 'text-t3' : 'text-ink'}>{valor}</span>
    </div>
  );
}

function TabBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-1 py-2 text-[13px] transition ${
        ativo
          ? 'border-ink font-semibold text-ink'
          : 'border-transparent text-t3 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function PendenteCard({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          {titulo}
        </div>
        <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[10px] font-medium text-t3">
          próxima rodada
        </span>
      </div>
      <p className="mt-3 text-[13px] italic text-t3">{descricao}</p>
    </div>
  );
}
