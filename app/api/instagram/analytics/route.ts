import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getIgAnalytics, igConfigured } from '@/lib/instagram';
import { getTitulosPorData } from '@/lib/notion';

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
  const projetoId = url.searchParams.get('projetoId') ?? '';

  if (!isAdmin) {
    // Cliente só vê a conta de um projeto que pertence à sessão dele.
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

    // Casa cada post do Instagram com o título do Notion, por data de publicação.
    if (projetoId) {
      const fimMs = untilValid
        ? new Date(`${untilValid}T23:59:59`).getTime()
        : Date.now();
      const inicioMs = sinceValid
        ? new Date(`${sinceValid}T00:00:00`).getTime()
        : fimMs - (dias ?? 30) * 86400000;
      try {
        const titulos = await getTitulosPorData(projetoId, inicioMs, fimMs);
        const desloca = (iso: string, dias: number) => {
          const d = new Date(`${iso}T12:00:00`);
          d.setDate(d.getDate() + dias);
          return d.toISOString().slice(0, 10);
        };
        let casados = 0;
        for (const c of analytics.conteudos) {
          const dia = (c.timestamp || '').slice(0, 10);
          if (!dia) continue;
          // Casa por data, com tolerância de ±2 dias (fuso horário / agendamento).
          const t =
            titulos[dia] ||
            titulos[desloca(dia, -1)] ||
            titulos[desloca(dia, 1)] ||
            titulos[desloca(dia, -2)] ||
            titulos[desloca(dia, 2)];
          if (t) {
            c.tituloNotion = t;
            casados += 1;
          }
        }
        // Diagnóstico só pro admin — ajuda a entender por que um casamento falhou.
        if (isAdmin) {
          analytics.debugTitulos = {
            projetoId,
            titulosNoPeriodo: Object.keys(titulos).length,
            postsCasados: casados,
            totalPosts: analytics.conteudos.length,
            amostraDatasNotion: Object.keys(titulos).sort().slice(0, 6),
            amostraDatasIg: analytics.conteudos
              .map((c) => (c.timestamp || '').slice(0, 10))
              .filter(Boolean)
              .slice(0, 6),
          };
        }
      } catch {
        /* título do Notion é opcional — segue sem */
      }
    }

    return NextResponse.json({ analytics });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao buscar dados' },
      { status: 500 },
    );
  }
}
