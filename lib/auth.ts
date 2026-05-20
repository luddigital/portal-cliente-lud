import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';

const SESSION_COOKIE = 'lud_session';
const MAGIC_COOKIE = 'lud_magic';
const ADMIN_ORIGEM_COOKIE = 'lud_admin_origem';
const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano — login fica lembrado
const ADMIN_ORIGEM_MAX_AGE = 60 * 60 * 8; // 8h — tempo razoável pra sessão "como cliente"

const secret = () => new TextEncoder().encode(env.auth.secret);

export type SessionPayload = {
  email: string;
  projetoIds: string[];
};

export async function signMagicToken(email: string): Promise<string> {
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret());
}

export async function verifyMagicToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const email = (payload as any).email as string | undefined;
    if (!email) return null;
    return { email };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const c = cookies().get(SESSION_COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    return { email: (payload as any).email, projetoIds: (payload as any).projetoIds ?? [] };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}

/**
 * Guarda a sessão admin original num cookie separado antes de "entrar como cliente".
 * Permite restaurar a sessão admin com 1 click depois.
 */
export async function pushAdminOrigem(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_ORIGEM_MAX_AGE}s`)
    .sign(secret());
  cookies().set(ADMIN_ORIGEM_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_ORIGEM_MAX_AGE,
  });
}

export async function getAdminOrigem(): Promise<SessionPayload | null> {
  const c = cookies().get(ADMIN_ORIGEM_COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    return { email: (payload as any).email, projetoIds: (payload as any).projetoIds ?? [] };
  } catch {
    return null;
  }
}

export function clearAdminOrigem(): void {
  cookies().delete(ADMIN_ORIGEM_COOKIE);
}

export const COOKIES = {
  SESSION: SESSION_COOKIE,
  MAGIC: MAGIC_COOKIE,
  ADMIN_ORIGEM: ADMIN_ORIGEM_COOKIE,
};
