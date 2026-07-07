import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTarefaComPost } from '@/lib/notion';
import { ensurePostFolder, uploadFile } from '@/lib/drive';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Upload de UM arquivo por request (evita o limite de 4.5MB do Vercel
// que trunca body silenciosamente). Cliente chama várias vezes em série
// antes de fechar a tarefa com /alterar.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'esperado multipart/form-data' },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const arquivos = form
      .getAll('arquivos')
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (arquivos.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo recebido (pode ter passado do limite de 4MB).' },
        { status: 400 },
      );
    }

    const data = await getTarefaComPost(params.id);
    if (!data)
      return NextResponse.json(
        { error: 'tarefa não encontrada' },
        { status: 404 },
      );
    const t = data.tarefa;
    const ehAdmin = env.auth.adminEmails.includes(
      session.email.trim().toLowerCase(),
    );
    if (
      !ehAdmin &&
      (!t.projetoId || !session.projetoIds.includes(t.projetoId))
    ) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    const folder = await ensurePostFolder({
      cliente: t.projetoNome,
      postTitulo: t.postTitulo,
      dataPostagem: t.postData,
    });

    let subiu = 0;
    for (const file of arquivos) {
      const buf = Buffer.from(await file.arrayBuffer());
      await uploadFile({
        folderId: folder.folderId,
        name: file.name,
        mimeType: file.type,
        buffer: buf,
      });
      subiu++;
    }

    return NextResponse.json({
      ok: true,
      subiu,
      driveLink: folder.webViewLink,
      folderId: folder.folderId,
    });
  } catch (err: any) {
    console.error('[anexar] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) {
      try {
        msg = JSON.parse(err.body).message ?? msg;
      } catch {}
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
