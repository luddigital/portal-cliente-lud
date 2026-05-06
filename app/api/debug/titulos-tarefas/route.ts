import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }
  const notion = new Client({ auth: env.notion.token });
  const counts: Record<string, number> = {};
  let cursor: string | undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages++;
    for (const t of res.results as any[]) {
      const titleProp = Object.values(t.properties).find((p: any) => p.type === 'title') as any;
      const titulo = (titleProp?.title?.map((x: any) => x.plain_text).join('') ?? '').trim();
      if (!titulo) continue;
      counts[titulo] = (counts[titulo] ?? 0) + 1;
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    if (pages > 20) break;
  } while (cursor);

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);
  return NextResponse.json({ pages, total: sorted.length, titulos: sorted });
}
