'use client';

import Link from 'next/link';
import { IdeiaEditavel } from '@/app/post/[id]/IdeiaEditavel';
import { LegendaEditavel } from '@/app/post/[id]/LegendaEditavel';

function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim) return 'Sem título';
  if (/^https?:\/\/\S+$/.test(trim) && !trim.includes(' ')) return 'Sem título';
  return trim;
}

function fmtDataLonga(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

const FORMATO_LABELS: Record<string, string> = {
  post: 'Carrossel',
  reels: 'Reels',
  story: 'Stories',
  desconhecido: 'Post',
};

/** Painel sandbox: renderiza todos os campos editáveis pra 1 página do Notion.
 *  Cada save escreve direto na página (mesma API que o portal real usa). */
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
  return (
    <div className="min-h-screen bg-bgSoft/40 pb-16">
      <header className="border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-3 px-6 py-4">
          <div>
            <Link href="/admin/teste-edicao" className="text-[11px] text-mauve hover:text-ink">
              ← Sandbox
            </Link>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
              🧪 Editando página de teste
            </h1>
            <p className="text-[11px] text-t3">
              {projetoNome} · {tituloSeguro(titulo)}
            </p>
          </div>
          <a
            href={`https://www.notion.so/${postId.replace(/-/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-medium text-mauve hover:text-ink"
          >
            abrir no Notion ↗
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-5">
        {/* Aviso sandbox */}
        <div
          className="rounded-2xl border border-dashed p-4 text-[12px] leading-[1.6]"
          style={{
            borderColor: 'var(--prazo-hoje)',
            background: 'var(--prazo-hoje-soft)',
            color: 'var(--prazo-hoje)',
          }}
        >
          <b>Ambiente controlado.</b> Toda edição aqui escreve direto na sua página
          de teste do Notion (não em post real). Depois de validar, aplicamos o
          mesmo pattern em produção.
        </div>

        {/* Metadata (readonly por enquanto) */}
        <div className="card p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            Metadata
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MetaField label="Título" valor={tituloSeguro(titulo)} status="Editável na próxima rodada" />
            <MetaField label="Data" valor={fmtDataLonga(data)} status="Editável em /programacao" />
            <MetaField label="Formato" valor={FORMATO_LABELS[formatoTipo] ?? 'Post'} status="Vem do Notion" />
            <MetaField label="Projeto" valor={projetoNome} status="Fixo" />
          </div>
        </div>

        {/* Campos editáveis prontos */}
        <IdeiaEditavel postId={postId} ideiaInicial={ideia} podeEditar={true} />
        <LegendaEditavel postId={postId} legendaInicial={legenda || ''} />

        {/* Placeholders — próximas rodadas */}
        <PendenteCard
          titulo="Roteiro do voice over"
          descricao="Callout com o texto que a cliente lê na gravação. Precisa endpoint novo pra editar o conteúdo do callout específico."
        />
        <PendenteCard
          titulo="Informações que precisamos"
          descricao="Callout com o que a equipe pede ao cliente responder. Editor será igual a Ideia mas mira o callout dessa seção."
        />
        <PendenteCard
          titulo="Materiais que precisamos"
          descricao="Callout com a lista de fotos/vídeos/áudios pedidos. Mesmo pattern."
        />

        <div className="card p-5">
          <h2 className="text-[13px] font-semibold text-ink">O que testar agora</h2>
          <ol className="mt-2 space-y-1.5 text-[12px] leading-[1.55] text-t2">
            <li><b>1.</b> Clica em <b>Editar</b> na Ideia do Post → muda o texto → Salvar.</li>
            <li><b>2.</b> Abre a página no Notion (link no topo) → confere se o texto mudou.</li>
            <li><b>3.</b> Volta e muda de novo — deve permanecer consistente.</li>
            <li><b>4.</b> Faz o mesmo com a Legenda.</li>
            <li><b>5.</b> Se tudo funcionar, sigo com os outros campos.</li>
          </ol>
        </div>
      </main>
    </div>
  );
}

function MetaField({ label, valor, status }: { label: string; valor: string; status: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-t3">
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] font-medium text-ink">{valor}</div>
      <div className="mt-0.5 text-[10px] italic text-t3">{status}</div>
    </div>
  );
}

function PendenteCard({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[rgba(21,21,33,0.15)] bg-bgSoft/30 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
          {titulo}
        </div>
        <span className="rounded-full bg-bgSoft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-t3">
          próxima rodada
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-[1.5] text-t3">{descricao}</p>
    </div>
  );
}
