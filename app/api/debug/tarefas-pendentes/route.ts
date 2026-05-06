import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }

  const notion = new Client({ auth: env.notion.token });

  const TITLES = ['Envio de Conteúdos Prévios', 'Materiais para Produção'];
  const counters: Record<string, { total: number; pronto: number; concluidas: number; outros_status: Record<string, number> }> = {};
  for (const t of TITLES) counters[t] = { total: 0, pronto: 0, concluidas: 0, outros_status: {} };

  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      start_cursor: cursor,
      page_size: 100,
      filter: {
        or: TITLES.map((t) => ({ property: 'Tarefa', title: { equals: t } })),
      },
    });
    for (const tarefa of res.results as any[]) {
      const titleProp = Object.values(tarefa.properties).find((p: any) => p.type === 'title') as any;
      const titulo = titleProp?.title?.map((x: any) => x.plain_text).join('') ?? '';
      const status = tarefa.properties.Status?.status?.name ?? '?';
      const prontoProp = tarefa.properties[env.notion.taskProps.pronto];
      const pronto = prontoProp?.formula?.boolean === true;

      const c = counters[titulo];
      if (!c) continue;
      c.total++;
      if (pronto) c.pronto++;
      if (status === 'Concluído') c.concluidas++;
      else c.outros_status[status] = (c.outros_status[status] ?? 0) + 1;

      // Pronto E não fechado
      if (pronto && !['Concluído', 'Cancelado', 'Reprovado', 'Excluída'].includes(status)) {
        (c as any).cabe_no_dashboard = ((c as any).cabe_no_dashboard ?? 0) + 1;
      }
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return NextResponse.json({
    pronto_prop_configurada: env.notion.taskProps.pronto,
    counters,
  });
}
