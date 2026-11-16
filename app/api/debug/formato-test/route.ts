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
  const id = url.searchParams.get('id') ?? '328d04d2-3b4a-8014-9110-eaac7ac8e7b9';
  const notion = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });

  try {
    const post = (await notion.pages.retrieve({ page_id: id })) as any;
    const props: any[] = [];
    for (const [name, p] of Object.entries(post.properties as any)) {
      const tp = (p as any).type;
      const entry: any = { name, type: tp };
      if (tp === 'relation') entry.relation = (p as any).relation.map((r: any) => r.id);
      if (tp === 'select') entry.select = (p as any).select?.name ?? null;
      if (tp === 'multi_select')
        entry.multi_select = ((p as any).multi_select ?? []).map((s: any) => s.name);
      if (tp === 'rollup') {
        const r = (p as any).rollup;
        entry.rollup_type = r?.type;
        entry.rollup_value =
          r?.type === 'array'
            ? r.array.map((x: any) => x.title?.map((t: any) => t.plain_text).join('') ?? x[x.type])
            : r?.[r.type];
      }
      if (tp === 'title') entry.title = ((p as any).title ?? []).map((t: any) => t.plain_text).join('');
      props.push(entry);
    }
    return NextResponse.json({ postId: id, props });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
