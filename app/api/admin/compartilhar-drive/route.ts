import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin força o compartilhamento da pasta raiz do Drive com todos os admins
 * configurados. Útil pra pastas que foram criadas antes do auto-share.
 * Idempotente — se o email já tem acesso, Google retorna erro que a gente
 * ignora.
 *
 * POST (sem body)
 * Returns: { compartilhadosCom: string[], erros: {email, msg}[] }
 */
export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
  auth.setCredentials({ refresh_token: env.drive.refreshToken });
  const drive = google.drive({ version: 'v3', auth });

  const compartilhadosCom: string[] = [];
  const erros: { email: string; msg: string }[] = [];

  for (const email of env.auth.adminEmails) {
    try {
      await drive.permissions.create({
        fileId: env.drive.rootFolderId,
        requestBody: { role: 'writer', type: 'user', emailAddress: email },
        sendNotificationEmail: false,
        supportsAllDrives: true,
      });
      compartilhadosCom.push(email);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        compartilhadosCom.push(email + ' (já tinha)');
      } else {
        erros.push({ email, msg: msg.slice(0, 200) });
      }
    }
  }

  return NextResponse.json({
    rootFolderId: env.drive.rootFolderId,
    compartilhadosCom,
    erros,
  });
}
