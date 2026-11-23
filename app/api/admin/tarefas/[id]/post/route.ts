import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { postDaTarefa } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Qual post é o dessa tarefa: o clique numa tarefa abre a prévia (popup) desse post. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  return NextResponse.json({ postId: await postDaTarefa(params.id) });
}
