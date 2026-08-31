import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { postId: string } },
) {
  const secretHeader = req.headers.get('x-cron-secret');
  if (
    !env.auth.cronSecret ||
    secretHeader !== env.auth.cronSecret
  ) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const notion = new Client({ auth: env.notion.token });

  async function listar(blockId: string, depth = 0): Promise<any[]> {
    const out: any[] = [];
    let cursor: string | undefined;
    do {
      const res = await notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: cursor,
      });
      for (const b of res.results as any[]) {
        const rt = b[b.type]?.rich_text;
        const texto = Array.isArray(rt)
          ? rt.map((r: any) => r.plain_text).join('').trim()
          : '';
        const item: any = {
          id: b.id,
          type: b.type,
          texto: texto.slice(0, 100),
          has_children: b.has_children,
        };
        if (b.has_children && depth < 3) {
          item.filhos = await listar(b.id, depth + 1);
        }
        out.push(item);
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
    return out;
  }

  const arvore = await listar(params.postId);
  return NextResponse.json({ arvore });
}
