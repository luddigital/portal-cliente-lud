import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTarefaComPost } from '@/lib/notion';
import { criarUploadSession, ensurePastaMateriaisDoPost } from '@/lib/drive';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cria uma sessão RESUMABLE do Drive pro browser fazer upload direto.
 * Escapa do limite de 4.5 MB por request do Vercel — arquivo passa direto
 * do browser pro Google, sem tocar no serverless.
 *
 * POST /api/tarefas/[id]/upload-init
 * Body: { nome: string, mimeType: string, tamanho: number }
 * Retorna: { uploadUrl, nomeFinal, folderId }
 *
 * Fluxo no client:
 *   1. POST aqui pra pegar `uploadUrl` (~200 ms)
 *   2. PUT o arquivo raw direto em `uploadUrl` (browser → Google)
 *   3. Chama /submit com finalize=true e o totalAcumulado
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
      nome?: string;
      mimeType?: string;
      tamanho?: number;
    };
    const nome = (body.nome ?? '').trim();
    const mimeType = (body.mimeType ?? '').trim() || 'application/octet-stream';
    const tamanho = Number(body.tamanho);
    if (!nome) return NextResponse.json({ error: 'nome obrigatório' }, { status: 400 });
    if (!Number.isFinite(tamanho) || tamanho <= 0) {
      return NextResponse.json({ error: 'tamanho inválido' }, { status: 400 });
    }
    // Teto de 5 GB por segurança (Drive suporta bem mais, mas evita abuso).
    if (tamanho > 5 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo passa de 5 GB — use link externo (Drive/WeTransfer).' },
        { status: 400 },
      );
    }

    const data = await getTarefaComPost(params.id);
    if (!data)
      return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 });
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

    const { uploadUrl, nomeFinal } = await criarUploadSession({
      folderId: folder.folderId,
      name: nome,
      mimeType,
      size: tamanho,
    });

    return NextResponse.json({
      uploadUrl,
      nomeFinal,
      folderId: folder.folderId,
      driveLink: folder.webViewLink,
    });
  } catch (err: any) {
    console.error('[upload-init] erro:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro inesperado' },
      { status: 500 },
    );
  }
}
