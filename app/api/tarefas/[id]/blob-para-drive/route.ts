import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { del } from '@vercel/blob';
import { getSession } from '@/lib/auth';
import { getTarefaComPost } from '@/lib/notion';
import { ensurePastaMateriaisDoPost, uploadFileFromStream } from '@/lib/drive';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Datacenter Vercel → Drive: ~5MB/s típico. 500 MB em ~2 min.
// 5 min cobre com folga.
export const maxDuration = 300;

/**
 * Move um arquivo do Vercel Blob (onde o cliente subiu) pro Google Drive
 * (onde tudo é armazenado permanentemente). O Blob é temporário — apagamos
 * assim que o Drive confirma o arquivo.
 *
 * POST { blobUrl, nome, mimeType, tamanho }
 * Returns { ok, driveLink, folderId }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      blobUrl?: string;
      nome?: string;
      mimeType?: string;
      tamanho?: number;
    };
    const blobUrl = (body.blobUrl ?? '').trim();
    const nome = (body.nome ?? '').trim();
    const mimeType = (body.mimeType ?? '').trim() || 'application/octet-stream';

    if (!blobUrl || !nome) {
      return NextResponse.json(
        { error: 'blobUrl e nome obrigatórios' },
        { status: 400 },
      );
    }

    // Sanity: só aceita URLs do próprio Vercel Blob (evita virar proxy pra
    // qualquer URL externa).
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(blobUrl)) {
      return NextResponse.json(
        { error: 'URL de blob inválida' },
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

    const folder = await ensurePastaMateriaisDoPost({
      cliente: t.projetoNome,
      postTitulo: t.postTitulo,
      dataPostagem: t.postData,
    });

    // Puxa do Blob e stream direto pro Drive — sem baixar tudo em RAM.
    // Blob pode ter latência de propagação logo após upload (CDN propaga
    // em segundos). Tenta até 3x com backoff curto antes de desistir.
    let blobRes: Response | null = null;
    let ultimoStatus = 0;
    for (let tent = 0; tent < 3; tent++) {
      const r = await fetch(blobUrl, { cache: 'no-store' });
      if (r.ok && r.body) {
        blobRes = r;
        break;
      }
      ultimoStatus = r.status;
      console.warn(
        `[blob-para-drive] fetch tentativa ${tent + 1} retornou ${r.status} pra ${blobUrl}`,
      );
      if (tent < 2) await new Promise((res) => setTimeout(res, 1500));
    }
    if (!blobRes || !blobRes.body) {
      return NextResponse.json(
        {
          error: `Blob não respondeu (${ultimoStatus}). URL: ${blobUrl.slice(0, 80)}...`,
        },
        { status: 502 },
      );
    }
    const nodeStream = Readable.fromWeb(blobRes.body as any);

    const uploaded = await uploadFileFromStream({
      folderId: folder.folderId,
      name: nome,
      mimeType,
      body: nodeStream,
    });

    // Blob transferido com sucesso — apaga do storage temporário.
    // Se der erro aqui, o arquivo já está no Drive, então logamos e seguimos.
    try {
      await del(blobUrl);
    } catch (err) {
      console.warn('[blob-para-drive] falha ao apagar blob:', err);
    }

    return NextResponse.json({
      ok: true,
      driveLink: folder.webViewLink,
      folderId: folder.folderId,
      driveFileId: uploaded.id,
    });
  } catch (err: any) {
    console.error('[blob-para-drive] erro:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro ao transferir pro Drive' },
      { status: 500 },
    );
  }
}
