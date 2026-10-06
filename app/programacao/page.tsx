import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  getPostComDetalhes,
  listAllProjetos,
  listPostsDoMes,
} from '@/lib/notion';
import { extractDriveFolderId, listFolderFiles } from '@/lib/drive';
import { classificarProjeto } from '@/lib/projetoServico';
import { ProgramacaoView } from './ProgramacaoView';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SERVICOS_SOCIAL = new Set(['Instagram', 'TikTok', 'Stories']);

/** Traz thumb + legenda do post numa passada só (aproveita o getPostComDetalhes,
 *  que já vem cacheado). */
async function postExtras(
  postId: string,
): Promise<{ fileId: string | null; legenda: string | null }> {
  try {
    const detail = await getPostComDetalhes(postId);
    if (!detail) return { fileId: null, legenda: null };
    const legenda = detail.legenda ?? null;
    let fileId: string | null = null;
    if (detail.driveLinks?.length) {
      for (const link of detail.driveLinks) {
        const folderId = extractDriveFolderId(link.url);
        if (!folderId) continue;
        const files = await listFolderFiles(folderId);
        const imagem = files.find(
          (f) => !f.isFolder && (f.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name)),
        );
        if (imagem) { fileId = imagem.id; break; }
        const primeiro = files.find((f) => !f.isFolder);
        if (primeiro) { fileId = primeiro.id; break; }
      }
    }
    return { fileId, legenda };
  } catch {
    return { fileId: null, legenda: null };
  }
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: {
    projetoId?: string;
    anchor?: string;
  };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const colab = await getColaboradorByEmail(session.email);
      ehColaborador = !!colab;
    } catch {
      /* mantém false */
    }
  }
  if (!ehAdmin && !ehColaborador) redirect('/');

  const projetos = (await listAllProjetos()).filter((p) =>
    SERVICOS_SOCIAL.has(classificarProjeto(p.nome)),
  );
  if (projetos.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-[18px] font-semibold text-ink">
          Nenhum projeto de social media ativo
        </h1>
        <p className="mt-2 text-[13px] text-t2">
          A programação só cobre projetos de Instagram, TikTok e Stories.
        </p>
      </main>
    );
  }

  // 'todos' = ver posts de todos os projetos de social (só admin/colab
  // consegue enxergar isso). Outro valor = fallback pra 1º projeto.
  const paramProjeto = searchParams.projetoId?.trim();
  const verTodos = paramProjeto === 'todos';
  const projetoIdSelecionado = verTodos
    ? 'todos'
    : (paramProjeto && projetos.find((p) => p.id === paramProjeto)?.id) || projetos[0].id;

  const hoje = new Date();

  // Anchor = qualquer dia da semana que se quer ver. Default = hoje.
  const anchorStr = searchParams.anchor?.trim();
  const anchor = anchorStr && /^\d{4}-\d{2}-\d{2}$/.test(anchorStr)
    ? new Date(anchorStr + 'T00:00:00')
    : hoje;

  // Range da semana (Seg → Dom). Semana no portal SEMPRE começa na segunda.
  const weekStart = new Date(anchor);
  const diffSeg = (anchor.getDay() + 6) % 7; // 0 = segunda, 6 = domingo
  weekStart.setDate(anchor.getDate() - diffSeg);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Tiles/tabelas/legenda seguem o mês da anchor (mês "de referência").
  const year = anchor.getFullYear();
  const month = anchor.getMonth() + 1;

  const idsBuscar = verTodos ? projetos.map((p) => p.id) : [projetoIdSelecionado];

  // Busca o mês inteiro da anchor + o mês da weekEnd se a semana cruza meses.
  // Posts do mês alimentam tiles + tabelas; posts filtrados pela semana
  // alimentam o calendário (feito no cliente).
  const meses = new Set<string>();
  meses.add(`${year}-${month}`);
  meses.add(`${weekStart.getFullYear()}-${weekStart.getMonth() + 1}`);
  meses.add(`${weekEnd.getFullYear()}-${weekEnd.getMonth() + 1}`);
  const buscas = await Promise.all(
    Array.from(meses).map((k) => {
      const [y, m] = k.split('-').map(Number);
      return listPostsDoMes(idsBuscar, y, m);
    }),
  );
  const seen = new Set<string>();
  const posts = buscas.flat().filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Batch: thumb + legenda por post em paralelo. Cacheado por post via
  // getPostComDetalhes — recarregar o mesmo mês é instantâneo.
  const extras = await Promise.all(
    posts.map(async (p) => [p.id, await postExtras(p.id)] as const),
  );
  const thumbnails: Record<string, string | null> = Object.fromEntries(
    extras.map(([id, e]) => [id, e.fileId]),
  );
  const legendas: Record<string, string | null> = Object.fromEntries(
    extras.map(([id, e]) => [id, e.legenda]),
  );

  return (
    <ProgramacaoView
      projetos={projetos}
      projetoIdSelecionado={projetoIdSelecionado}
      year={year}
      month={month}
      anchor={toIso(anchor)}
      weekStart={toIso(weekStart)}
      weekEnd={toIso(weekEnd)}
      posts={posts}
      thumbnails={thumbnails}
      legendas={legendas}
    />
  );
}
