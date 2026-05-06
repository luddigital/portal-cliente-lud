import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }

  const notion = new Client({ auth: env.notion.token });
  const res = await notion.databases.query({
    database_id: env.notion.projetosDbId,
    page_size: 100,
    filter: {
      property: 'Status Manual',
      status: { equals: 'Ativo' },
    },
  });

  const projetos = (res.results as any[]).map((page) => {
    const title = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
    return {
      id: page.id,
      titulo: title?.title?.map((t: any) => t.plain_text).join('') ?? '(sem nome)',
    };
  });

  return NextResponse.json({ total: projetos.length, projetos });
}
