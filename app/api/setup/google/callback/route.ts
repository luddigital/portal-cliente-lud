import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(new URL(`/setup?err=${encodeURIComponent(errorParam)}`, url));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/setup?err=missing_code', url));
  }

  const redirectUri = `${env.app.url}/api/setup/google/callback`;
  const oauth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret, redirectUri);

  let tokens;
  try {
    const res = await oauth.getToken(code);
    tokens = res.tokens;
  } catch {
    return NextResponse.redirect(new URL('/setup?err=exchange_failed', url));
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(new URL('/setup?err=no_refresh_token', url));
  }

  oauth.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth });
  const me = await oauth2.userinfo.get();
  const email = me.data.email?.toLowerCase() ?? '';

  if (!env.auth.adminEmails.includes(email)) {
    return NextResponse.redirect(new URL('/setup?err=unauthorized', url));
  }

  return NextResponse.redirect(new URL(`/setup?token=${encodeURIComponent(tokens.refresh_token)}`, url));
}
