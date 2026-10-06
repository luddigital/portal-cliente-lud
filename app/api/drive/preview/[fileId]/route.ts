import { google } from 'googleapis';
import { env } from '@/lib/env';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy de arquivos do Drive — autentica server-side com nossa refresh token,
 * e streama o conteúdo pro browser do cliente. Suporta Range pra video seek.
 *
 * Otimizações pra performance:
 *  1. OAuth client memoizado em escopo de módulo — evita criar a cada call
 *  2. Metadata (mimeType, size) cached em memória por fileId (TTL 1h)
 *  3. Cache-Control public + s-maxage longo — Vercel CDN serve do edge nas
 *     próximas requests (bytes de vídeo são imutáveis). Range requests também
 *     são cached separadamente pelo Vercel quando os headers cooperarem.
 */

// OAuth client singleton (módulo) — refresh token vive aqui, não é recriado.
let _drive: ReturnType<typeof google.drive> | null = null;
function getDrive() {
  if (_drive) return _drive;
  const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
  auth.setCredentials({ refresh_token: env.drive.refreshToken });
  _drive = google.drive({ version: 'v3', auth });
  return _drive;
}

// Cache de metadata in-memory (1h). Suficiente pra carregar vídeo + seek.
type MetaCache = { mimeType: string; size: number | null; ts: number };
const META_TTL_MS = 60 * 60_000;
const metaCache = new Map<string, MetaCache>();

/** Fallback de mimeType pela extensão quando o Drive devolve
 *  application/octet-stream (comum pra arquivos subidos via API). */
function mimeFallbackPelaExtensao(name: string): string | null {
  const nome = name.toLowerCase();
  if (/\.mp3$/.test(nome)) return 'audio/mpeg';
  if (/\.m4a$/.test(nome)) return 'audio/mp4';
  if (/\.wav$/.test(nome)) return 'audio/wav';
  if (/\.ogg$/.test(nome)) return 'audio/ogg';
  if (/\.aac$/.test(nome)) return 'audio/aac';
  if (/\.flac$/.test(nome)) return 'audio/flac';
  if (/\.webm$/.test(nome)) return 'audio/webm';
  if (/\.mp4$/.test(nome)) return 'video/mp4';
  if (/\.mov$/.test(nome)) return 'video/quicktime';
  if (/\.m4v$/.test(nome)) return 'video/x-m4v';
  if (/\.jpe?g$/.test(nome)) return 'image/jpeg';
  if (/\.png$/.test(nome)) return 'image/png';
  if (/\.webp$/.test(nome)) return 'image/webp';
  if (/\.gif$/.test(nome)) return 'image/gif';
  if (/\.heic$/.test(nome)) return 'image/heic';
  return null;
}

async function getMetadataCached(fileId: string): Promise<MetaCache> {
  const hit = metaCache.get(fileId);
  if (hit && Date.now() - hit.ts < META_TTL_MS) return hit;
  const drive = getDrive();
  const res = await drive.files.get({
    fileId,
    fields: 'mimeType,size,name',
    supportsAllDrives: true,
  });
  let mimeType = res.data.mimeType ?? 'application/octet-stream';
  // Se o Drive guardou como octet-stream genérico, infere pela extensão
  // do nome — assim <audio>, <video>, <img> conseguem renderizar sem precisar
  // de um "Save as" manual.
  if (mimeType === 'application/octet-stream' && res.data.name) {
    const inferido = mimeFallbackPelaExtensao(res.data.name);
    if (inferido) mimeType = inferido;
  }
  const meta: MetaCache = {
    mimeType,
    size: res.data.size ? Number(res.data.size) : null,
    ts: Date.now(),
  };
  metaCache.set(fileId, meta);
  return meta;
}

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

  let meta: MetaCache;
  try {
    meta = await getMetadataCached(fileId);
  } catch (err: any) {
    return new Response(`Drive metadata error: ${err?.message ?? err}`, {
      status: 500,
    });
  }

  const range = req.headers.get('range') ?? undefined;

  let driveRes: any;
  try {
    driveRes = await getDrive().files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      {
        responseType: 'stream',
        headers: range ? { Range: range } : undefined,
      },
    );
  } catch (err: any) {
    return new Response(`Drive stream error: ${err?.message ?? err}`, {
      status: 500,
    });
  }

  // Converte node stream pra web ReadableStream
  const nodeStream = driveRes.data as NodeJS.ReadableStream;
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk)),
      );
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      (nodeStream as any).destroy?.();
    },
  });

  // Cache headers — este endpoint é PROTEGIDO POR SESSÃO. `public` faria o CDN
  // da Vercel cachear os bytes do arquivo privado com chave só pelo fileId e
  // servir pra qualquer um (inclusive sem cookie), furando a auth. Usamos
  // `private` (cache só no browser do próprio usuário autenticado).
  const headers: Record<string, string> = {
    'Content-Type': meta.mimeType,
    'Cache-Control': 'private, max-age=3600',
    'Accept-Ranges': 'bytes',
  };
  const respHeaders: Record<string, any> = driveRes.headers ?? {};
  if (respHeaders['content-range'])
    headers['Content-Range'] = String(respHeaders['content-range']);
  if (respHeaders['content-length']) {
    headers['Content-Length'] = String(respHeaders['content-length']);
  } else if (!range && meta.size != null) {
    headers['Content-Length'] = String(meta.size);
  }
  if (respHeaders['accept-ranges'])
    headers['Accept-Ranges'] = String(respHeaders['accept-ranges']);

  const status = range && respHeaders['content-range'] ? 206 : 200;
  return new Response(webStream, { status, headers });
}
