import { google } from 'googleapis';
import { env } from '@/lib/env';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Proxy de arquivos do Drive — autentica server-side com nossa refresh token,
 * e streama o conteúdo pro browser do cliente. Suporta Range pra video seek.
 */
export async function GET(
  req: Request,
  { params }: { params: { fileId: string } },
): Promise<Response> {
  // Trava: precisa ter sessão no portal (qualquer cliente logado)
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const fileId = params.fileId;
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new Response('Bad fileId', { status: 400 });
  }

  const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
  auth.setCredentials({ refresh_token: env.drive.refreshToken });
  const drive = google.drive({ version: 'v3', auth });

  // Lê metadata
  let mimeType = 'application/octet-stream';
  try {
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType,size',
      supportsAllDrives: true,
    });
    if (meta.data.mimeType) mimeType = meta.data.mimeType;
  } catch (err: any) {
    return new Response(`Drive metadata error: ${err?.message ?? err}`, { status: 500 });
  }

  const range = req.headers.get('range') ?? undefined;

  let driveRes: any;
  try {
    driveRes = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      {
        responseType: 'stream',
        headers: range ? { Range: range } : undefined,
      },
    );
  } catch (err: any) {
    return new Response(`Drive stream error: ${err?.message ?? err}`, { status: 500 });
  }

  // Converte node stream pra web ReadableStream
  const nodeStream = driveRes.data as NodeJS.ReadableStream;
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      (nodeStream as any).destroy?.();
    },
  });

  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'Cache-Control': 'private, max-age=3600',
    'Accept-Ranges': 'bytes',
  };
  const respHeaders: Record<string, any> = driveRes.headers ?? {};
  if (respHeaders['content-range']) headers['Content-Range'] = String(respHeaders['content-range']);
  if (respHeaders['content-length'])
    headers['Content-Length'] = String(respHeaders['content-length']);
  if (respHeaders['accept-ranges']) headers['Accept-Ranges'] = String(respHeaders['accept-ranges']);

  const status = range && respHeaders['content-range'] ? 206 : 200;
  return new Response(webStream, { status, headers });
}
