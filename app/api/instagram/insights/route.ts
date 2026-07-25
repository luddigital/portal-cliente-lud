import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { getIgAnalytics, igConfigured } from '@/lib/instagram';
import { getMetaAdsRelatorio, getMetaAdsCampanhas } from '@/lib/metaAds';
import { getProjetoConfig } from '@/lib/notion';
import { parseNumBR } from '@/lib/num';
import { gerarInsightsAnalise, type InsightAcionavel } from '@/lib/insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache em memória — insight de IA custa token, então guardamos por 12h por
// (conta + período). O botão "Atualizar" no front manda refresh=1 pra furar.
const cache = new Map<string, { exp: number; data: InsightAcionavel[] }>();
const TTL_MS = 12 * 60 * 60 * 1000;

function periodoMs(
  dias: number | undefined,
  since: string | undefined,
  until: string | undefined,
): { inicioMs: number; fimMs: number } {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (since && until && re.test(since) && re.test(until)) {
    return {
      inicioMs: new Date(`${since}T00:00:00`).getTime(),
      fimMs: new Date(`${until}T23:59:59`).getTime(),
    };
  }
  const fimMs = Date.now();
  return { inicioMs: fimMs - (dias ?? 30) * 86400000, fimMs };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }
  if (!igConfigured()) {
    return NextResponse.json({ error: 'não configurado' }, { status: 200 });
  }
  if (!env.anthropic.apiKey) {
    return NextResponse.json(
      { error: 'Insights de IA ainda não configurados (falta ANTHROPIC_API_KEY).' },
      { status: 200 },
    );
  }

  const url = new URL(req.url);
  const isAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  const diasParam = url.searchParams.get('dias');
  const since = url.searchParams.get('since')?.trim() || undefined;
  const until = url.searchParams.get('until')?.trim() || undefined;
  const refresh = url.searchParams.get('refresh') === '1';
  const dias = diasParam
    ? Math.min(365, Math.max(1, parseInt(diasParam, 10) || 30))
    : undefined;

  let igId = url.searchParams.get('igId') ?? '';
  let projetoId = url.searchParams.get('projetoId') ?? '';

  if (!isAdmin) {
    // Cliente: só o próprio projeto da sessão.
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
  } else if (!igId && projetoId) {
    igId = env.instagram.accounts[projetoId] ?? '';
  }

  if (!igId) {
    return NextResponse.json({ error: 'igId obrigatório' }, { status: 400 });
  }

  const audiencia = isAdmin ? 'interno' : 'cliente';
  const chave = `${audiencia}|${igId}|${dias ?? ''}|${since ?? ''}|${until ?? ''}`;
  if (!refresh) {
    const hit = cache.get(chave);
    if (hit && hit.exp > Date.now()) {
      return NextResponse.json({ insights: hit.data, audiencia, cache: true });
    }
  }

  try {
    const analytics = await getIgAnalytics(igId, { dias, since, until });

    // Tráfego pago do projeto (se houver): monta um resumo pro insight.
    let temTrafegoPago = false;
    let adsResumo: string | undefined;
    if (projetoId) {
      temTrafegoPago = Boolean(
        env.metaAds.accounts[projetoId] || env.metaAds.campaigns[projetoId]?.length,
      );
      if (temTrafegoPago) {
        const { inicioMs, fimMs } = periodoMs(dias, since, until);
        const [rel, camps] = await Promise.all([
          getMetaAdsRelatorio(projetoId, inicioMs, fimMs).catch(() => null),
          getMetaAdsCampanhas(projetoId, inicioMs, fimMs).catch(() => null),
        ]);
        if (rel) {
          const t = rel.totais;
          adsResumo = `Tráfego ativo — investimento R$${Math.round(t.investimento)}, alcance ${t.alcance}${t.compras != null ? `, ${t.compras} compras` : ''}${t.roas != null ? `, ROAS ${t.roas.toFixed(2)}` : ''}.`;
        } else if (camps && camps.length) {
          const nomes = camps.map((c) => c.nome).slice(0, 4).join(', ');
          adsResumo = `${camps.length} campanha(s) ativa(s): ${nomes}.`;
        }
      }
    }

    // Objetivo + progresso rumo às metas do mês (do Notion) → contexto pro insight.
    let metaContexto: string | undefined;
    if (projetoId) {
      const config = await getProjetoConfig(projetoId).catch(() => null);
      if (config) {
        const partes: string[] = [];
        if (config.objetivo?.trim()) partes.push(`Objetivo: ${config.objetivo.trim()}`);
        const linhas: string[] = [];
        const segMeta = parseNumBR(config.metas.seguidores.meta);
        if (segMeta) {
          const at = analytics.account.followersCount;
          linhas.push(`Seguidores ${at}/${segMeta} (${Math.round((at / segMeta) * 100)}%)`);
        }
        const engMeta = parseNumBR(config.metas.engajamento.meta);
        if (engMeta) {
          const at = analytics.taxaEngajamento * 100;
          linhas.push(`Engajamento ${at.toFixed(1)}%/${engMeta}% (${Math.round((at / engMeta) * 100)}%)`);
        }
        const alcMeta = parseNumBR(config.metas.alcance.meta);
        if (alcMeta) {
          const at = analytics.atual.reach;
          linhas.push(`Alcance ${at}/${alcMeta} (${Math.round((at / alcMeta) * 100)}%)`);
        }
        if (linhas.length) partes.push(`Progresso rumo às metas — ${linhas.join('; ')}`);
        if (partes.length) metaContexto = partes.join('. ') + '.';
      }
    }

    const insights = await gerarInsightsAnalise({
      a: analytics,
      clienteNome: analytics.account.name || analytics.account.username,
      temTrafegoPago,
      adsResumo,
      audiencia,
      metaContexto,
    });

    cache.set(chave, { exp: Date.now() + TTL_MS, data: insights });
    return NextResponse.json({ insights, audiencia, cache: false });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'erro ao gerar insights' },
      { status: 500 },
    );
  }
}
