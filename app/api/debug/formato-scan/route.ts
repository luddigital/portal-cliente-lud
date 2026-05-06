import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }
  const notion = new Client({ auth: env.notion.token });

  // IG | @roteirosnaafrica projeto id (descoberto antes nos logs)
  const PROJETO_IG = '1e0d04d2-3b4a-8052-ab3f-ffb9f9387db1';

  let cursor: string | undefined;
  const comFormato: any[] = [];
  const semFormato: any[] = [];
  do {
    const res = await notion.databases.query({
      database_id: env.notion.postagensDbId,
      start_cursor: cursor,
      page_size: 100,
      filter: {
        property: 'Projeto',
        relation: { contains: PROJETO_IG },
      },
    });
    for (const page of res.results as any[]) {
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      const titulo = titleProp?.title?.map((x: any) => x.plain_text).join('') ?? '';
      const formatoRel = (page.properties?.Formato?.relation ?? []).map((r: any) => r.id);
      const data = page.properties?.['Data Postagem']?.date?.start ?? null;
      const item = { id: page.id, titulo, data, formatoIds: formatoRel };
      if (formatoRel.length > 0) comFormato.push(item);
      else semFormato.push(item);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return NextResponse.json({
    total: comFormato.length + semFormato.length,
    comFormato: comFormato.length,
    semFormato: semFormato.length,
    exemplosComFormato: comFormato.slice(0, 10),
    exemplosSemFormato: semFormato.slice(0, 5),
  });
}
