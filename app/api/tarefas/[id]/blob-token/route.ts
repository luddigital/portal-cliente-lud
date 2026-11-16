import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTarefaComPost } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Autoriza um upload direto do browser pro Vercel Blob.
 *
 * Por que Blob e não Google Drive direto: o Blob fica no EDGE da Vercel
 * (geograficamente perto do cliente), muito mais estável que googleapis.com
 * pra rede oscilante. Depois o servidor (que tem conexão de datacenter)
 * transfere pro Drive.
 *
 * Fluxo:
 *   1. Client chama `upload()` do @vercel/blob/client passando este endpoint
 *   2. Este endpoint valida sessão + tarefa via `onBeforeGenerateToken`
 *   3. Vercel Blob assina uma URL de upload e devolve pro client
 *   4. Client sobe direto pro Blob
 *   5. Client chama /blob-para-drive pra mover pro Drive definitivo
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Autenticação: mesma regra dos outros endpoints da tarefa.
        const session = await getSession();
        if (!session) throw new Error('não autenticado');

        const data = await getTarefaComPost(params.id);
        if (!data) throw new Error('tarefa não encontrada');
        const t = data.tarefa;
        const ehAdmin = env.auth.adminEmails.includes(
          session.email.trim().toLowerCase(),
        );
        if (
          !ehAdmin &&
          (!t.projetoId || !session.projetoIds.includes(t.projetoId))
        ) {
          throw new Error('sem permissão');
        }

        return {
          allowedContentTypes: [
            'image/*',
            'video/*',
            'audio/*',
            'application/pdf',
            'application/octet-stream',
          ],
          // Mesmo teto da tela (450 MB) com folga: acima disso a transferência
          // pro Drive passa dos 5 min da função e falha. Maior que isso vai por link.
          maximumSizeInBytes: 500 * 1024 * 1024,
          // Nome único no Blob (ex: IMG_2246-abc123.MOV) pra evitar colisão
          // quando a cliente retenta ou tem 2 arquivos com mesmo nome.
          // Nome final no Drive continua o original (item.file.name) porque
          // é setado explicitamente em /blob-para-drive.
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            tarefaId: params.id,
            email: session.email,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Não fazemos nada aqui — o client explicitamente chama
        // /blob-para-drive depois de o upload terminar. Isso dá controle
        // e feedback melhor pro usuário (progress claro, erros específicos).
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro' },
      { status: 400 },
    );
  }
}
