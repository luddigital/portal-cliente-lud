'use client';

import Link from 'next/link';
import { CampoTextoRascunho } from './CampoTextoRascunho';
import { DataEditavel } from './DataEditavel';
import { IdeiaConstrucao } from './IdeiaConstrucao';
import { SelectsMeta } from './SelectsMeta';

type Opcao = { id: string; nome: string };
type OpcaoSelect = { nome: string; cor?: string | null };
type RascunhoPauta = {
  ideia_texto: string;
  informacoes_texto: string;
  materiais_texto: string;
  atualizado_em: string;
  publicado_em: string | null;
} | null;

function tituloSeguro(t: string): string {
  const trim = t.trim();
  if (!trim || /^post sem t[íi]tulo$/i.test(trim)) return 'Nova pauta';
  if (/^https?:\/\/\S+$/.test(trim) && !trim.includes(' ')) return 'Nova pauta';
  return trim;
}

export function PainelTeste({
  postId,
  titulo,
  data,
  projetoNome,
  ideia,
  rascunhoPauta,
  formatos,
  funis,
  objetivos,
  demandas,
  formatoIdAtual,
  funilIdAtual,
  objetivoIdAtual,
  demandaAtual,
  emModal = false,
}: {
  postId: string;
  titulo: string;
  data: string;
  projetoNome: string;
  ideia: string;
  rascunhoPauta: RascunhoPauta;
  formatos: Opcao[];
  funis: Opcao[];
  objetivos: Opcao[];
  demandas: OpcaoSelect[];
  formatoIdAtual: string | null;
  funilIdAtual: string | null;
  objetivoIdAtual: string | null;
  demandaAtual: string | null;
  emModal?: boolean;
}) {
  const notionUrl = `https://www.notion.so/${postId.replace(/-/g, '')}`;

  return (
    <div className={emModal ? 'pb-8' : 'min-h-screen bg-bg pb-20'}>
      {!emModal && (
        <div
          className="border-b px-6 py-2 text-[11px]"
          style={{
            background: 'var(--prazo-hoje-soft)',
            borderColor: 'var(--prazo-hoje)',
            color: 'var(--prazo-hoje)',
          }}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>🧪 <b>Sandbox</b> — a pauta que você criar é real e vai pro Notion.</div>
            <div className="flex items-center gap-3">
              <Link href="/admin/teste-edicao" className="hover:underline">
                ← voltar ao calendário
              </Link>
              <a href={notionUrl} target="_blank" rel="noreferrer" className="hover:underline">
                abrir no Notion ↗
              </a>
            </div>
          </div>
        </div>
      )}

      <main className={`mx-auto max-w-2xl px-5 space-y-3 ${emModal ? 'pt-10' : 'pt-8'}`}>
        {/* Cabeçalho */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            {projetoNome}
          </div>
          <h1 className="mt-1 hub-section-title">
            {tituloSeguro(titulo)}
          </h1>
          <div className="text-[12px] text-t2 mt-1">
            Data de postagem: <DataEditavel postId={postId} dataInicial={data} />
          </div>
        </div>

        <SelectsMeta
          postId={postId}
          formatos={formatos}
          funis={funis}
          objetivos={objetivos}
          demandas={demandas}
          formatoIdInicial={formatoIdAtual}
          funilIdInicial={funilIdAtual}
          objetivoIdInicial={objetivoIdAtual}
          demandaInicial={demandaAtual}
        />

        <IdeiaConstrucao
          postId={postId}
          ideiaNotion={ideia}
          rascunhoInicial={rascunhoPauta}
        />

        <CampoTextoRascunho
          postId={postId}
          campo="informacoes_texto"
          label="Informações que precisamos pro post"
          placeholder="O que o cliente precisa te contar pra você escrever — ex: como funciona X, quais estações têm o totem, se ele já passou por Y…"
          valorInicial={rascunhoPauta?.informacoes_texto ?? ''}
          atualizadoEmInicial={rascunhoPauta?.atualizado_em ?? null}
        />

        <CampoTextoRascunho
          postId={postId}
          campo="materiais_texto"
          label="Materiais que precisamos pro post"
          placeholder="Fotos, vídeos, prints, áudios — o que a equipe precisa receber do cliente."
          valorInicial={rascunhoPauta?.materiais_texto ?? ''}
          atualizadoEmInicial={rascunhoPauta?.atualizado_em ?? null}
        />

        <div className="card p-4">
          <div className="label mb-1">Próximos campos (próxima rodada)</div>
          <ul className="mt-1 space-y-1 text-[12px] text-t2">
            <li>• Referências (lista de links + prints)</li>
          </ul>
        </div>

        {emModal ? (
          <div className="pt-2 text-center">
            <a
              href={notionUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-medium text-mauve hover:text-ink"
            >
              abrir no Notion ↗
            </a>
            <div className="text-[10.5px] text-t3 mt-1">
              Publicação pro cliente vai ser em lote na Revisão do mês (em breve).
            </div>
          </div>
        ) : (
          <div className="pt-2 flex flex-col items-center gap-2">
            <Link href="/admin/teste-edicao" className="btn-ghost">
              ← Voltar pro calendário do mês
            </Link>
            <div className="text-[10.5px] text-t3">
              A publicação pro cliente é feita no lote na página de Revisão do mês (em breve).
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
