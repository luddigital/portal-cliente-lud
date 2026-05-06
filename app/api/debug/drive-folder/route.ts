import { NextResponse } from 'next/server';
import { listFolderFiles } from '@/lib/drive';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'só em dev' }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'faltou ?id=FOLDER_ID' }, { status: 400 });

  try {
    const files = await listFolderFiles(id);
    return NextResponse.json({ folderId: id, count: files.length, files });
  } catch (err: any) {
    return NextResponse.json(
      { folderId: id, error: err?.message ?? String(err), code: err?.code, response: err?.response?.data },
      { status: 500 },
    );
  }
}
