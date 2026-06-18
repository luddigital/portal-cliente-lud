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
  const diasParam = url.searchParams.get('dias');
  const since = url.searchParams.get('since')?.trim();
  const until = url.searchParams.get('until')?.trim();
  // Aceita 1 ano de range customizado (since/until) ou 7-90 dias via 'dias'
  const dias = diasParam
    ? Math.min(365, Math.max(1, parseInt(diasParam, 10) || 30))
    : undefined;

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
    const reISO = /^\d{4}-\d{2}-\d{2}$/;
    const sinceValid = since && reISO.test(since) ? since : undefined;
    const untilValid = until && reISO.test(until) ? until : undefined;
    const analytics = await getIgAnalytics(igId, {
      dias,
      since: sinceValid,
      until: untilValid,
    });
    return NextResponse.json({ analytics });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao buscar dados' },
      { status: 500 },
    );
  }
}
