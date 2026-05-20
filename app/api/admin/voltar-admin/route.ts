import { NextResponse } from 'next/server';
import { getAdminOrigem, createSession, clearAdminOrigem } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Restaura a sessão admin original (salva antes de "entrar como cliente").
 * Apaga o cookie de origem e redireciona pra /admin.
 */
export async function GET(req: Request): Promise<Response> {
  const origem = await getAdminOrigem();
  if (!origem) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  await createSession(origem);
  clearAdminOrigem();
  return NextResponse.redirect(new URL('/admin', req.url));
}
