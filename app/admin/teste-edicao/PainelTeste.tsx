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

/** Layout inspirado na página do Notion — título grande, propriedades em
 *  linha, tabs (Post / Info & Materiais / Lud), seções com H3 sublinhado
 *  roxo. Edição inline nos campos que já têm endpoint. */
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
    <div className="min-h-screen bg-white">
      {/* Barra fina do sandbox — não é parte do documento, só contexto */}
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

      <main className="mx-auto max-w-3xl px-6 pt-14 pb-24">
        {/* Emoji icon estilo Notion */}
        <div className="mb-3 text-[52px] leading-none">📱</div>

        {/* Título grande */}
        <h1 className="text-[40px] font-bold leading-[1.15] tracking-[-0.03em] text-ink">
          {tituloSeguro(titulo)}
        </h1>

        {/* Propriedades — linha de metadata */}
        <div className="mt-4 space-y-1.5 text-[13px]">
          <Prop label="Projeto"        valor={projetoNome} />
          <Prop label="Data Postagem"  valor={fmtDataCurta(data)} />
          <Prop label="Formato"        valor={FORMATO_LABELS[formatoTipo] ?? 'Post'} />
          <Prop label="Status"         valor="Em Produção" mudo />
        </div>

        {/* Divider */}
        <hr className="my-6 border-[rgba(21,21,33,0.08)]" />

        {/* Tabs estilo Notion (bordinha embaixo do ativo) */}
        <div className="mb-6 flex gap-4 border-b border-[rgba(21,21,33,0.08)]">
          <TabBtn ativo={aba === 'post'}      onClick={() => setAba('post')}>Post</TabBtn>
          <TabBtn ativo={aba === 'materiais'} onClick={() => setAba('materiais')}>Informações e Materiais</TabBtn>
          <TabBtn ativo={aba === 'lud'}       onClick={() => setAba('lud')}>Lud</TabBtn>
        </div>

        {aba === 'post' && (
          <div className="space-y-6">
            <SectionH3>Vídeo</SectionH3>
            <PlaceholderNotion
              texto="Upload/embed do vídeo — ainda vive no Notion nessa rodada."
            />
            <hr className="border-[rgba(21,21,33,0.08)]" />
            <SectionH3>Legenda</SectionH3>
            <NotionField>
              <LegendaEditavel postId={postId} legendaInicial={legenda || ''} />
            </NotionField>
          </div>
        )}

        {aba === 'materiais' && (
          <div className="space-y-6">
            <SectionH3 roxo>Informações que precisamos para o post</SectionH3>
            <NotionCallout icon="📣">
              <PlaceholderInline texto="editor do callout de informações — próxima rodada" />
            </NotionCallout>

            <SectionH3 roxo className="mt-8">Materiais que precisamos para o post</SectionH3>
            <NotionCallout icon="🎬">
              <PlaceholderInline texto="editor do callout de materiais — próxima rodada" />
            </NotionCallout>

            <NotionCallout icon="✋">
              <div className="mb-1 text-[14px] font-semibold text-ink">
                Texto para gravação de Voice Over
              </div>
              <PlaceholderInline texto="editor do roteiro voice over — próxima rodada" />
            </NotionCallout>
          </div>
        )}

        {aba === 'lud' && (
          <div className="space-y-6">
            <SectionH3 roxo>Briefing do Post</SectionH3>
            <NotionField>
              <IdeiaEditavel postId={postId} ideiaInicial={ideia} podeEditar={true} />
            </NotionField>

            <SectionH3 roxo className="mt-8">Referências para o post</SectionH3>
            <PlaceholderNotion texto="Bloco de referências — próxima rodada" />

            <SectionH3 roxo className="mt-8">Materiais</SectionH3>
            <PlaceholderNotion texto="Checklist e links do material — próxima rodada" />
          </div>
        )}

        {/* Nota do que vem por rodada */}
        <div className="mt-16 rounded-lg border border-dashed border-[rgba(21,21,33,0.13)] bg-bgSoft/40 p-4 text-[12px] leading-[1.6] text-t3">
          <b className="text-t2">Nessa rodada</b>: Ideia/Briefing e Legenda são
          editáveis (escrevem direto no Notion via API).{' '}
          <b className="text-t2">Próxima</b>: mesmos endpoints pros callouts de
          Informações, Materiais e Roteiro voice over. <b className="text-t2">Depois</b>:
          título e data (properties do Notion, já suportadas) + botão &quot;+ Novo
          post&quot; que cria no template canônico.
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

function SectionH3({
  children,
  roxo = false,
  className = '',
}: {
  children: React.ReactNode;
  roxo?: boolean;
  className?: string;
}) {
  return (
    <h3
      className={`text-[18px] font-semibold underline decoration-[1.5px] underline-offset-4 ${className}`}
      style={{
        color: roxo ? '#9065B0' : 'var(--ink)',
        textDecorationColor: roxo ? '#9065B0' : 'rgba(21,21,33,0.35)',
      }}
    >
      {children}
    </h3>
  );
}

/** Container transparente pra encaixar os componentes editáveis dentro do
 *  fluxo do documento — remove o "card" visual dos componentes originais. */
function NotionField({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="[&_.card]:!border-none [&_.card]:!bg-transparent [&_.card]:!p-0 [&_.card]:!shadow-none"
    >
      {children}
    </div>
  );
}

function NotionCallout({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-md bg-bgSoft/60 p-4">
      <div className="text-[18px] leading-none">{icon}</div>
      <div className="min-w-0 flex-1 text-[14px] leading-[1.55] text-ink">
        {children}
      </div>
    </div>
  );
}

function PlaceholderNotion({ texto }: { texto: string }) {
  return (
    <p className="rounded-md border border-dashed border-[rgba(21,21,33,0.13)] px-4 py-3 text-[12px] italic text-t3">
      {texto}
    </p>
  );
}

function PlaceholderInline({ texto }: { texto: string }) {
  return (
    <span className="italic text-t3">{texto}</span>
  );
}
