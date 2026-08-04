import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

/**
 * URLs públicas e assinadas pra mídia do Drive — necessárias porque a Meta
 * (Instagram/Facebook) baixa a imagem/vídeo por conta própria de uma URL
 * pública. O /api/drive/preview é protegido por sessão, então não serve.
 *
 * O token é um JWT curto (assinado com AUTH_SECRET) contendo só o fileId +
 * expiração. Assim expomos UM arquivo por vez, por tempo limitado — não o
 * material inteiro dos clientes.
 */

const secret = () => new TextEncoder().encode(env.auth.secret);

/** Assina um token pra servir `fileId` publicamente por `ttlSeg` segundos. */
export async function assinarMidiaToken(fileId: string, ttlSeg = 60 * 60): Promise<string> {
  return await new SignJWT({ fid: fileId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeg}s`)
    .sign(secret());
}

/** Valida o token e devolve o fileId, ou null se inválido/expirado. */
export async function verificarMidiaToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const fid = (payload as any).fid;
    return typeof fid === 'string' && fid ? fid : null;
  } catch {
    return null;
  }
}

/**
 * Base pública pra montar a URL de mídia. Prefere o domínio do próprio deploy
 * (VERCEL_URL) — assim a URL é sempre self-referente e a Meta a alcança, tanto
 * em preview quanto em produção, sem depender de config manual. Cai no
 * NEXT_PUBLIC_APP_URL/localhost fora da Vercel.
 */
function basePublica(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return env.app.url;
}

/** URL pública completa pra um fileId (assinada e temporária). */
export async function urlMidiaPublica(fileId: string, ttlSeg = 60 * 60): Promise<string> {
  const token = await assinarMidiaToken(fileId, ttlSeg);
  return `${basePublica()}/api/media/${token}`;
}
