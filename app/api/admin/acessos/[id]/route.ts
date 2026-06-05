import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { removerAcesso } from '@/lib/notion';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  try {
    await removerAcesso(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[acessos DELETE]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro inesperado' },
      { status: 500 },
    );
  }
}
