import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getColaboradorByEmail, lerCopyDoPost, lerInfoDoPostEsteira } from '@/lib/notion';

export const runtime = 'nodejs';

// Retorna a copy produzida (voice / carrossel / legenda) de um post do
// Notion. Usado pelo painel de revisão da Esteira ao clicar num card.
export async function GET(
  _req: Request,
  { params }: { params: { postId: string } },
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const ehAdmin = env.auth.adminEmails.includes(
      session.email.trim().toLowerCase(),
    );
    let ehColaborador = !!session.colaboradorId;
    if (!ehColaborador && !ehAdmin) {
      try {
        const colab = await getColaboradorByEmail(session.email);
        ehColaborador = !!colab;
      } catch {}
    }
    if (!ehAdmin && !ehColaborador)
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });

    const [copy, info] = await Promise.all([
      lerCopyDoPost(params.postId),
      lerInfoDoPostEsteira(params.postId).catch(() => null),
    ]);
    return NextResponse.json({ ok: true, copy, info });
  } catch (err: any) {
    console.error('[esteira/copy] erro:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro inesperado' },
      { status: 500 },
    );
  }
}
