import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Rolling session — refresca o cookie `lud_session` toda navegação
 * autenticada. Sem isso, Safari + iOS ITP podem reduzir o TTL do cookie
 * pra ~7 dias mesmo com maxAge=1 ano. Refrescar em cada visita "reseta"
 * o timer do browser e mantém o usuário logado.
 *
 * Só age quando o cookie existe e o JWT é válido — não força login,
 * não muda qualquer outra lógica de auth.
 */

const SESSION_COOKIE = 'lud_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

const secretBytes = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export async function middleware(req: NextRequest) {
  const cookieValue = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookieValue) return NextResponse.next();
  if (!process.env.AUTH_SECRET) return NextResponse.next();

  try {
    const { payload } = await jwtVerify(cookieValue, secretBytes());

    // Refaz JWT e re-seta cookie EM TODA VISITA. Não pode ter shortcut de
    // "só se estiver perto de expirar" — o Safari ITP não olha o maxAge,
    // ele mede "quando foi a última vez que esse cookie foi setado por HTTP".
    // Só rewrite frequente convence o browser que o cookie está "vivo".
    const { iat: _iat, exp: _exp, ...clean } = payload as any;
    const novoToken = await new SignJWT(clean)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_MAX_AGE}s`)
      .sign(secretBytes());

    const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE, novoToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch {
    // JWT inválido — deixa a request seguir. O código downstream vai
    // tratar como não autenticado e redirecionar pro /login.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Aplica em todas as rotas exceto:
     * - _next/static, _next/image (assets)
     * - favicon, arquivos com extensão (imagens, etc)
     * - /api/auth/* (fluxo de login não tem cookie ainda)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2)$).*)',
  ],
};
