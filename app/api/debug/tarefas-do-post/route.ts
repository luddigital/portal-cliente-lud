import { fetchDoNotion } from '@/lib/notionFetch';
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }

  const url = new URL(req.url);
  const postId = url.searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'faltou ?postId=' }, { status: 400 });

  const notion = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });
  const post = (await notion.pages.retrieve({ page_id: postId })) as any;
  const titleProp = Object.values(post.properties).find((p: any) => p.type === 'title') as any;
  const tarefasRel = post.properties[env.notion.postProps.tarefas]?.relation ?? [];

  const tarefas = [];
  for (const rel of tarefasRel) {
    try {
      const t = (await notion.pages.retrieve({ page_id: rel.id })) as any;
      const tTitle = Object.values(t.properties).find((p: any) => p.type === 'title') as any;
      const prontoProp = t.properties[env.notion.taskProps.pronto];
      tarefas.push({
        id: t.id,
        titulo: tTitle?.title?.map((x: any) => x.plain_text).join('') ?? '',
        status: t.properties.Status?.status?.name ?? null,
        finalizada_em: t.properties['Finalizada em ']?.date?.start ?? null,
        all_props: Object.entries(t.properties).map(([name, p]: any) => ({
          name,
          type: p.type,
          formula_type: p.formula?.type,
          formula_value: p.formula?.[p.formula?.type],
        })),
      });
    } catch (e: any) {
      tarefas.push({ id: rel.id, error: e.message });
    }
  }

  return NextResponse.json({
    post_titulo: titleProp?.title?.map((x: any) => x.plain_text).join('') ?? '',
    post_status: post.properties.Status?.status?.name ?? null,
    total_tarefas: tarefas.length,
    tarefas,
  });
}
