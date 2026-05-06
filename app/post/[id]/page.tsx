import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth';
import {
  getPostComDetalhes,
  getTarefaComPost,
  findTarefaClienteProntaDoPost,
  type RelacaoItem,
} from '@/lib/notion';
import {
  extractDriveFolderId,
  extractDriveFileId,
  listFolderFiles,
  type DriveFileResumido,
} from '@/lib/drive';
import { PostPreview, type PreviewArquivo } from './PostPreview';
import { AprovacaoSimples } from './AprovacaoSimples';

export const dynamic = 'force-dynamic';

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function diffDias(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.round((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function PostDetalhePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tarefa?: string; from?: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const post = await getPostComDetalhes(params.id);
  if (!post) notFound();
  if (!post.projetoId || !session.projetoIds.includes(post.projetoId)) notFound();

  // Carrega a tarefa específica que originou esse fluxo (se vier no query).
  // Se não vier, tenta auto-detectar a tarefa cliente pendente desse post
  // (` Pronto`=true e título matching com categoria do cliente).
  let tarefaTitulo: string | null = null;
  let tarefaPrazo: string | null = null;
  let tarefaId: string | null = null;
  if (searchParams.tarefa) {
    const t = await getTarefaComPost(searchParams.tarefa);
    if (t && t.tarefa.postId === post.id) {
      tarefaId = t.tarefa.tarefaId;
      tarefaTitulo = t.tarefa.tarefaTitulo;
      tarefaPrazo = t.tarefa.tarefaPrazo;
    }
  } else {
    const auto = await findTarefaClienteProntaDoPost(post.id);
    if (auto) {
      const t = await getTarefaComPost(auto.tarefaId);
      if (t && t.tarefa.postId === post.id) {
        tarefaId = t.tarefa.tarefaId;
        tarefaTitulo = t.tarefa.tarefaTitulo;
        tarefaPrazo = t.tarefa.tarefaPrazo;
      }
    }
  }

  const isStory = post.formatoTipo === 'story';
  const etapaLabel = tarefaTitulo ?? (isStory ? 'Direcionamento de Stories' : 'Aprovação');

  // Resolve arquivos do Drive: se for pasta, lista o conteúdo; se for arquivo, monta um item.
  const arquivos: PreviewArquivo[] = [];
  for (const link of post.driveLinks) {
    const folderId = extractDriveFolderId(link.url);
    if (folderId) {
      try {
        const files = await listFolderFiles(folderId);
        for (const f of files) {
          if (f.isFolder) continue;
          arquivos.push(f);
        }
      } catch (err: any) {
        console.warn('[post] erro listando pasta do Drive:', err?.message);
      }
      continue;
    }
    const fileId = extractDriveFileId(link.url);
    if (fileId) {
      arquivos.push({
        id: fileId,
        name: link.name,
        mimeType: '',
        webViewLink: link.url,
        thumbnailLink: null,
        isFolder: false,
      });
      continue;
    }
    // arquivo direto (Notion CDN, etc) — usa o url como id
    arquivos.push({
      id: link.url,
      name: link.name,
      mimeType: '',
      webViewLink: link.url,
      thumbnailLink: null,
      isFolder: false,
    });
  }

  // Fallback: enquanto o banco Formato do Notion não estiver compartilhado com a integration,
  // tenta inferir Reels/Story pelo padrão dos nomes de arquivo (ex: "sm_reels_*", "*_story_*").
  let formatoTipoDetectado = post.formatoTipo;
  if (formatoTipoDetectado === 'desconhecido' || formatoTipoDetectado === 'post') {
    const nomes = arquivos.map((a) => a.name.toLowerCase()).join(' ');
    if (/(^|[^a-z])reels?([^a-z]|$)/.test(nomes)) {
      formatoTipoDetectado = 'reels';
    } else if (/(^|[^a-z])stor(y|ies|ie)([^a-z]|$)/.test(nomes)) {
      formatoTipoDetectado = 'story';
    }
  }

  const dias = diffDias(tarefaPrazo);
  const prazoLabel =
    !tarefaPrazo
      ? null
      : dias === null
      ? fmtData(tarefaPrazo)
      : dias < 0
      ? `Era pra ${fmtData(tarefaPrazo)}`
      : dias === 0
      ? 'Hoje'
      : dias === 1
      ? 'Amanhã'
      : `Em ${dias} dias`;

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 border-b border-[rgba(21,21,33,0.08)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-mauve transition hover:text-ink"
          >
            ← Voltar
          </Link>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
            {post.projetoNome}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--cal-aprovacao-soft)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--cal-aprovacao)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {etapaLabel}
          </span>
          <FormatoPill formatoTipo={formatoTipoDetectado} qtd={arquivos.length} />
        </div>

        <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-[-0.03em] text-ink">{post.titulo}</h1>

        <div className="grid gap-2 text-[13px] sm:grid-cols-2">
          <InfoCard label="Data de postagem" value={fmtData(post.data)} />
          {prazoLabel && (
            <InfoCard
              label="Prazo de aprovação"
              value={prazoLabel}
              urgent={dias !== null && dias <= 0}
            />
          )}
        </div>

        {(post.formato.length > 0 || post.funil.length > 0 || post.objetivo.length > 0) && (
          <dl className="card divide-y divide-[rgba(21,21,33,0.06)] overflow-hidden">
            {post.formato.length > 0 && <DetalheRow label="Formato" itens={post.formato} />}
            {post.funil.length > 0 && <DetalheRow label="Funil" itens={post.funil} />}
            {post.objetivo.length > 0 && <DetalheRow label="Objetivo" itens={post.objetivo} />}
          </dl>
        )}

        {arquivos.length > 0 && (
          <div>
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Pré-visualização
            </div>
            <PostPreview
              arquivos={arquivos}
              formatoTipo={formatoTipoDetectado}
              tarefaId={tarefaId}
              tarefaTitulo={tarefaTitulo ?? 'Aprovação'}
              legenda={post.legenda}
              voltarPara={searchParams.from ? `/etapa/${searchParams.from}` : '/'}
            />
          </div>
        )}

        {arquivos.length === 0 && (post.bodyCompleto || post.legenda) && (
          <div className="card p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
              Ideia do post
            </div>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.6] text-ink">
              {post.bodyCompleto ?? post.legenda}
            </p>
          </div>
        )}

        {arquivos.length === 0 && tarefaId && (
          <AprovacaoSimples
            tarefaId={tarefaId}
            tarefaTitulo={tarefaTitulo ?? 'Aprovação'}
            voltarPara={searchParams.from ? `/etapa/${searchParams.from}` : '/'}
          />
        )}
      </main>
    </div>
  );
}

function InfoCard({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 flex items-center justify-between ${
        urgent
          ? 'bg-hubRed text-white'
          : 'card'
      }`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
          urgent ? 'text-white/70' : 'text-t3'
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-[12px] ${
          urgent ? 'text-white font-semibold' : 'text-t1'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const FORMATO_PILL: Record<
  'post' | 'reels' | 'story' | 'desconhecido',
  { label: string; bg: string; color: string }
> = {
  post: { label: 'Carrossel', bg: 'var(--cal-agendado-soft)', color: 'var(--cal-agendado)' },
  reels: { label: 'Reels', bg: 'var(--cal-alteracao-soft)', color: 'var(--cal-alteracao)' },
  story: { label: 'Stories', bg: 'var(--cal-aprovacao-soft)', color: 'var(--cal-aprovacao)' },
  desconhecido: { label: 'Post', bg: 'var(--cal-rascunho-soft)', color: 'var(--cal-rascunho)' },
};

function FormatoPill({
  formatoTipo,
  qtd,
}: {
  formatoTipo: 'post' | 'reels' | 'story' | 'desconhecido';
  qtd: number;
}) {
  const info = FORMATO_PILL[formatoTipo];
  const sufixo =
    formatoTipo === 'post'
      ? ` · ${qtd} ${qtd === 1 ? 'card' : 'cards'}`
      : formatoTipo === 'story'
        ? ` · ${qtd} ${qtd === 1 ? 'tela' : 'telas'}`
        : '';
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em]"
      style={{ background: info.bg, color: info.color }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {info.label}
      {sufixo && <span className="font-normal opacity-70">{sufixo}</span>}
    </span>
  );
}

function DetalheRow({ label, itens }: { label: string; itens: RelacaoItem[] }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <dt className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center gap-2">
        {itens.map((it) => (
          <span
            key={it.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(21,21,33,0.04)] px-2.5 py-1 text-[12px] text-ink"
          >
            {it.icon &&
              (it.icon.startsWith('http') ? (
                <Image
                  src={it.icon}
                  alt={it.name}
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 rounded-sm object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-[13px] leading-none">{it.icon}</span>
              ))}
            {it.name}
          </span>
        ))}
      </dd>
    </div>
  );
}
