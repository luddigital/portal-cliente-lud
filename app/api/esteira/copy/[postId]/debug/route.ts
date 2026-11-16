import { fetchDoNotion } from '@/lib/notionFetch';
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { lerCopyDoPost } from '@/lib/notion';

export const runtime = 'nodejs';

// Debug: mostra quantos blocos o post tem, quais headings, e o que o
// parser retornou. Usado só pra debugar quando a copy não aparece.
export async function GET(
  _req: Request,
  { params }: { params: { postId: string } },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin) return NextResponse.json({ error: 'só admin' }, { status: 403 });

  const notion = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });

  // Query todos os blocos direto (com paginação)
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: params.postId,
      page_size: 100,
      start_cursor: cursor,
    });
    blocks.push(...(res.results as any[]));
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const headings = blocks
    .filter((b) => b.type?.startsWith('heading_'))
    .map((b) => {
      const rt = b[b.type]?.rich_text;
      const texto = Array.isArray(rt)
        ? rt.map((r: any) => r.plain_text).join('')
        : '';
      return { tipo: b.type, texto };
    });

  const copy = await lerCopyDoPost(params.postId);

  return NextResponse.json({
    totalBlocos: blocks.length,
    tiposDeBloco: blocks.reduce((acc: Record<string, number>, b) => {
      acc[b.type] = (acc[b.type] ?? 0) + 1;
      return acc;
    }, {}),
    headingsEncontrados: headings,
    copyRetornada: {
      voice: copy.voice ? `${copy.voice.length} chars — ${copy.voice.slice(0, 80)}...` : null,
      carrossel: copy.carrossel
        ? `${copy.carrossel.length} chars — ${copy.carrossel.slice(0, 80)}...`
        : null,
      legenda: copy.legenda
        ? `${copy.legenda.length} chars — ${copy.legenda.slice(0, 80)}...`
        : null,
    },
  });
}
