import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { montarSemana } from '@/app/admin/_ui/semanaHome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Posts de uma semana pro calendário da home (as setas trocam só o calendário). GET ?semana=N */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !env.auth.adminEmails.includes(s.email.trim().toLowerCase())) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const n = Number(new URL(req.url).searchParams.get('semana')) || 0;
  return NextResponse.json(await montarSemana(n));
}
