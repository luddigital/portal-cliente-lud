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
  const res = await notion.databases.query({
    database_id: 'caed36b4-07f3-40d3-a805-e2b8aebe7cdd',
    page_size: 50,
  });
  const formatos = (res.results as any[]).map((page) => {
    const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
    return {
      id: page.id,
      titulo: titleProp?.title?.map((x: any) => x.plain_text).join('') ?? '',
      icon_raw: page.icon,
    };
  });
  return NextResponse.json({ total: formatos.length, formatos });
}
