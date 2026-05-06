import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }
  const url = new URL(req.url);
  const db = url.searchParams.get('db') ?? 'tarefas';
  const dbId =
    db === 'tarefas'
      ? env.notion.tarefasDbId
      : db === 'postagens'
      ? env.notion.postagensDbId
      : db === 'projetos'
      ? env.notion.projetosDbId
      : env.notion.clientesDbId;

  const notion = new Client({ auth: env.notion.token });
  const data = (await notion.databases.retrieve({ database_id: dbId })) as any;
  const props: Record<string, { type: string; options?: string[] }> = {};
  for (const [name, p] of Object.entries(data.properties as any)) {
    const entry: any = { type: (p as any).type };
    const t = (p as any).type;
    if (t === 'select' || t === 'status') {
      entry.options = ((p as any)[t]?.options ?? []).map((o: any) => o.name);
    }
    props[name] = entry;
  }
  return NextResponse.json({ db, dbId, props });
}
