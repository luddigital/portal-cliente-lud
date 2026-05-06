import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  const redirectUri = `${env.app.url}/api/setup/google/callback`;
  const oauth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret, redirectUri);
  const url = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/userinfo.email'],
  });
  return NextResponse.redirect(url);
}
