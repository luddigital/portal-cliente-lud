import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'faltou ?id=POST_ID' }, { status: 400 });

  const notion = new Client({ auth: env.notion.token });
  const page = (await notion.pages.retrieve({ page_id: id })) as any;

  // 1. property "Link do Google Drive" (ou env.notion.postProps.driveLink)
  const propDrive = page.properties?.[env.notion.postProps.driveLink];
  const driveFiles = (propDrive?.files ?? []).map((f: any) => ({
    name: f.name,
    type: f.type,
    external_url: f.external?.url,
    file_url: f.file?.url,
  }));

  // 2. todas as properties do tipo files (pra detectar arquivos em outra prop)
  const todasFilesProps: any[] = [];
  for (const [name, p] of Object.entries(page.properties as any)) {
    if ((p as any).type === 'files') {
      const files = ((p as any).files ?? []).map((f: any) => ({
        name: f.name,
        type: f.type,
      }));
      todasFilesProps.push({ propName: name, count: files.length, files });
    }
  }

  // 3. blocks do body (headings + tipos)
  const blocks = await notion.blocks.children.list({ block_id: id, page_size: 100 });
  const headings: any[] = [];
  const tiposBlocos: Record<string, number> = {};
  for (const b of blocks.results as any[]) {
    const tipo = b.type;
    tiposBlocos[tipo] = (tiposBlocos[tipo] ?? 0) + 1;
    if (tipo === 'heading_1' || tipo === 'heading_2' || tipo === 'heading_3') {
      const text = (b[tipo]?.rich_text ?? []).map((r: any) => r.plain_text).join('');
      headings.push({ tipo, text });
    }
  }

  return NextResponse.json({
    postId: id,
    titulo: ((Object.values(page.properties).find((p: any) => p.type === 'title') as any)
      ?.title ?? [])
      .map((t: any) => t.plain_text)
      .join(''),
    driveLink_prop_lookup: env.notion.postProps.driveLink,
    driveLink_files: driveFiles,
    todas_files_props: todasFilesProps,
    body_total_blocks: blocks.results.length,
    body_tipos_blocos: tiposBlocos,
    body_headings: headings,
  });
}
