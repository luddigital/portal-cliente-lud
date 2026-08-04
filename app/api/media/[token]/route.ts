import { google } from 'googleapis';
import { env } from '@/lib/env';
import { verificarMidiaToken } from '@/lib/midiaPublica';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Mídia PÚBLICA do Drive — servida via token assinado (JWT curto), SEM sessão.
 * Existe pra Meta (Instagram/Facebook) conseguir baixar a arte pra publicar.
 * Ao contrário do /api/drive/preview (protegido por sessão), aqui a autorização
 * é o próprio token: expõe só o fileId embutido nele, por tempo limitado.
 */

let _drive: ReturnType<typeof google.drive> | null = null;
function getDrive() {
  if (_drive) return _drive;
  const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
  auth.setCredentials({ refresh_token: env.drive.refreshToken });
  _drive = google.drive({ version: 'v3', auth });
  return _drive;
}

export async function GET(
  req: Request,
  { params }: { params: { token: string } },
): Promise<Response> {
  const fileId = await verificarMidiaToken(params.token);
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new Response('Forbidden', { status: 403 });
  }

  let mimeType = 'application/octet-stream';
  let size: number | null = null;
  try {
    const meta = await getDrive().files.get({
      fileId,
      fields: 'mimeType,size',
      supportsAllDrives: true,
    });
    mimeType = meta.data.mimeType ?? mimeType;
    size = meta.data.size ? Number(meta.data.size) : null;
  } catch (err: any) {
    return new Response(`Drive metadata error: ${err?.message ?? err}`, { status: 404 });
  }

  const range = req.headers.get('range') ?? undefined;
  let driveRes: any;
  try {
    driveRes = await getDrive().files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream', headers: range ? { Range: range } : undefined },
    );
  } catch (err: any) {
    return new Response(`Drive stream error: ${err?.message ?? err}`, { status: 500 });
  }

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

  // Público: o token é a chave de acesso (curto e assinado). Cache curto no CDN
  // acelera o fetch da Meta sem vazar nada além do que o token já autoriza.
  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'Cache-Control': 'public, max-age=600',
    'Accept-Ranges': 'bytes',
  };
  const respHeaders: Record<string, any> = driveRes.headers ?? {};
  if (respHeaders['content-range']) headers['Content-Range'] = String(respHeaders['content-range']);
  if (respHeaders['content-length']) {
    headers['Content-Length'] = String(respHeaders['content-length']);
  } else if (!range && size != null) {
    headers['Content-Length'] = String(size);
  }

  const status = range && respHeaders['content-range'] ? 206 : 200;
  return new Response(webStream, { status, headers });
}
