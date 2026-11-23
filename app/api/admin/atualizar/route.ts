import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { invalidarDadosDoDia, invalidarTudo } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Força o portal a reler tudo do Notion na hora — limpa todos os caches.
 * Abra /api/admin/atualizar no navegador (logada como admin) quando mexer
 * em algo no Notion e quiser ver na hora.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (
    !session ||
    !env.auth.adminEmails.includes(session.email.trim().toLowerCase())
  ) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  invalidarTudo();

  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>Portal atualizado</title></head>
     <body style="font-family:Inter,system-ui,sans-serif;background:#F8F8F8;color:#151521;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
       <div style="text-align:center;padding:32px;">
         <div style="font-size:40px;">✓</div>
         <div style="font-size:18px;font-weight:600;margin-top:8px;">Portal atualizado</div>
         <div style="font-size:13px;color:#5C5B72;margin-top:6px;">
           Tudo recarregado do Notion.
         </div>
         <a href="/admin" style="display:inline-block;margin-top:20px;background:#151521;
           color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;
           font-size:13px;font-weight:600;">Voltar pro admin</a>
       </div>
     </body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

/** Versão do botão "Atualizar" (fica na tela): relê tarefas e posts e responde JSON. */
export async function POST() {
  const session = await getSession();
  if (!session || !env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  invalidarDadosDoDia();
  revalidateTag('previas');
  // As prévias vão ser recarregadas pelo botão: não precisa ler cada uma sem guardar.
  cookies().delete('lud_post_mudou');
  return NextResponse.json({ ok: true });
}
