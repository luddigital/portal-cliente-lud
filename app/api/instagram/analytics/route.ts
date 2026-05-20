import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getIgAnalytics, igConfigured } from '@/lib/instagram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  if (!igConfigured()) {
    return NextResponse.json({ error: 'não configurado' }, { status: 200 });
  }

  const url = new URL(req.url);
  const isAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  const dias = Math.min(90, Math.max(7, parseInt(url.searchParams.get('dias') ?? '30', 10) || 30));

  let igId = url.searchParams.get('igId') ?? '';

  if (!isAdmin) {
    // Cliente só vê a conta de um projeto que pertence à sessão dele.
    const projetoId = url.searchParams.get('projetoId') ?? '';
    if (!projetoId || !session.projetoIds.includes(projetoId)) {
      return NextResponse.json({ error: 'acesso restrito' }, { status: 403 });
    }
    igId = env.instagram.accounts[projetoId] ?? '';
    if (!igId) {
      return NextResponse.json(
        { error: 'projeto sem conta Instagram vinculada' },
        { status: 404 },
      );
    }
  }

  if (!igId) {
    return NextResponse.json({ error: 'igId obrigatório' }, { status: 400 });
  }

  try {
    const analytics = await getIgAnalytics(igId, dias);
    return NextResponse.json({ analytics });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao buscar dados' },
      { status: 500 },
    );
  }
}
