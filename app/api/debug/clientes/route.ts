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
  const filterEmail = url.searchParams.get('filter');

  const notion = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });
  const res = await notion.databases.query({
    database_id: env.notion.clientesDbId,
    page_size: 50,
    ...(filterEmail
      ? {
          filter: {
            property: env.notion.clienteProps.email,
            email: { equals: filterEmail },
          },
        }
      : {}),
  });

  const clientes = (res.results as any[]).map((page) => {
    const props = page.properties;
    const title = Object.values(props).find((p: any) => p.type === 'title') as any;
    const emailProps: Record<string, string | null> = {};
    for (const [name, p] of Object.entries(props)) {
      if ((p as any).type === 'email') {
        emailProps[name] = (p as any).email ?? null;
      }
    }
    const projetosRel = (props[env.notion.clienteProps.projetos] as any)?.relation ?? [];
    return {
      id: page.id,
      archived: page.archived,
      titulo: title?.title?.map((t: any) => t.plain_text).join('') ?? '',
      emails: emailProps,
      projetos_count: projetosRel.length,
    };
  });

  return NextResponse.json({
    total: clientes.length,
    property_email_configurada: env.notion.clienteProps.email,
    clientes,
  });
}
