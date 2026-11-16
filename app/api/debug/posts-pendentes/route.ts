import { fetchDoNotion } from '@/lib/notionFetch';
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }

  const notion = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });
  const projetosComPosts = new Map<string, { count: number; posts: string[] }>();

  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.postagensDbId,
      start_cursor: cursor,
      page_size: 100,
      filter: {
        or: [
          { property: env.notion.postProps.demanda, select: { equals: 'Informação' } },
          { property: env.notion.postProps.demanda, select: { equals: 'Produção Material' } },
          { property: env.notion.postProps.demanda, select: { equals: 'Informação & Produção de Material' } },
        ],
      },
    });

    for (const page of res.results as any[]) {
      const status = page.properties[env.notion.postProps.status]?.status?.name;
      if (['Postado', 'Cancelado', 'Excluída'].includes(status)) continue;
      const projetoRel = page.properties[env.notion.postProps.projeto]?.relation ?? [];
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      const titulo = titleProp?.title?.map((t: any) => t.plain_text).join('') ?? '';
      for (const rel of projetoRel) {
        const entry = projetosComPosts.get(rel.id) ?? { count: 0, posts: [] };
        entry.count++;
        entry.posts.push(titulo);
        projetosComPosts.set(rel.id, entry);
      }
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Resolver nomes dos projetos
  const out: Array<{ id: string; nome: string; count: number; posts: string[] }> = [];
  for (const [id, data] of projetosComPosts) {
    try {
      const page = (await notion.pages.retrieve({ page_id: id })) as any;
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      const nome = titleProp?.title?.map((t: any) => t.plain_text).join('') ?? '(sem nome)';
      out.push({ id, nome, count: data.count, posts: data.posts.slice(0, 5) });
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    total_projetos_com_posts_pendentes: out.length,
    projetos: out.sort((a, b) => b.count - a.count),
  });
}
