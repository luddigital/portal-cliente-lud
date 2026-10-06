import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { salvarMensagens } from '@/lib/mensagens-padrao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PUT { textos: { [chave]: texto | null } } — null volta pro padrão. */
export async function PUT(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const email = session.email.trim().toLowerCase();
  if (!env.auth.adminEmails.includes(email)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    textos?: Record<string, unknown>;
  };
  const textos: Record<string, string | null> = {};
  for (const [chave, v] of Object.entries(body.textos ?? {})) {
    if (v === null) textos[chave] = null;
    else if (typeof v === 'string') textos[chave] = v.slice(0, 2000);
  }

  try {
    await salvarMensagens(textos, email);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'erro ao salvar' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
