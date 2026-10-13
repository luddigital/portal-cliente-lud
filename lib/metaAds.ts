import { env } from './env';
import type { RelatorioAds, AdSetRow } from './csvAds';

/**
 * Cliente da Marketing API da Meta (insights de conta de anúncios) — a
 * versão "ao vivo" do que o csvAds.ts faz a partir do CSV exportado.
 *
 * Reaproveita o mesmo token do Instagram (IG_GRAPH_TOKEN, System User do
 * Business Manager). Pra ler anúncios o token precisa da permissão
 * `ads_read` e a conta de anúncios precisa estar atribuída a esse System
 * User. O mapa projetoId -> act_<id> fica em META_ADS_ACCOUNTS.
 *
 * Devolve o mesmo formato RelatorioAds do csvAds, então a renderização é
 * idêntica à do upload manual.
 */

const BASE = 'https://graph.facebook.com';

// action_types da Meta que representam compra (ordem de preferência)
const PURCHASE_TYPES = [
  'purchase',
  'omni_purchase',
  'offsite_conversion.fct.purchase',
];

type InsightsRow = {
  adset_name?: string;
  campaign_name?: string;
  campaign_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
};

const n = (v: string | undefined): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Soma o valor do primeiro action_type que existir, na ordem de PURCHASE_TYPES. */
function valorCompra(
  arr: { action_type: string; value: string }[] | undefined,
): number | null {
  if (!arr || arr.length === 0) return null;
  for (const tipo of PURCHASE_TYPES) {
    const hit = arr.find((a) => a.action_type === tipo);
    if (hit) return n(hit.value);
  }
  return null;
}

/** Soma o valor de todos os action_types presentes na lista informada. */
function somaActions(
  arr: { action_type: string; value: string }[] | undefined,
  tipos: string[],
): number | null {
  if (!arr || arr.length === 0) return null;
  let total = 0;
  let achou = false;
  for (const a of arr) {
    if (tipos.includes(a.action_type)) {
      total += n(a.value);
      achou = true;
    }
  }
  return achou ? total : null;
}

// Conversas iniciadas no WhatsApp/Direct (resultado de campanha de mensagens/tráfego pro WhatsApp)
const CONVERSA_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_conversation_started',
];

const isoDoMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function timeRange(inicioMs: number, fimMs: number): string {
  return JSON.stringify({ since: isoDoMs(inicioMs), until: isoDoMs(fimMs) });
}

/**
 * Busca insights de um "node" da Graph API. O node pode ser uma conta
 * (`act_<id>`) ou uma campanha (id numérico). Quando `level` é omitido, a
 * API devolve o agregado do próprio node (ex: total da campanha).
 */
async function buscarInsights(
  node: string,
  range: string,
  level?: 'account' | 'adset' | 'campaign',
): Promise<InsightsRow[] | null> {
  const token = env.instagram.graphToken;
  if (!token) return null;
  const fields = [
    'spend',
    'impressions',
    'reach',
    'frequency',
    'cpm',
    'clicks',
    'ctr',
    'cpc',
    'actions',
    'action_values',
    ...(level === 'adset' ? ['adset_name'] : []),
    ...(level === 'campaign' ? ['campaign_name', 'campaign_id'] : []),
  ].join(',');

  const url =
    `${BASE}/${env.instagram.graphVersion}/${node}/insights` +
    `?time_range=${encodeURIComponent(range)}` +
    (level ? `&level=${level}` : '') +
    `&fields=${fields}&limit=200&access_token=${token}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    console.error('[metaAds] insights', node, level ?? 'self', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = (await res.json()) as { data?: InsightsRow[] };
  return Array.isArray(data.data) ? data.data : [];
}

function linhaParaAdSet(row: InsightsRow, nomeFallback: string): AdSetRow {
  return {
    nome: row.adset_name ?? nomeFallback,
    veiculacao: '',
    investimento: n(row.spend),
    impressoes: n(row.impressions),
    alcance: n(row.reach),
    frequencia: n(row.frequency),
    cpm: n(row.cpm),
    cliques: row.clicks != null ? n(row.clicks) : null,
    ctr: row.ctr != null ? n(row.ctr) : null,
    cpc: row.cpc != null ? n(row.cpc) : null,
    resultados: null,
    custoPorResultado: null,
    indicadorResultado: null,
    seguidoresIg: null,
    compras: valorCompra(
      row.actions?.filter((a) => PURCHASE_TYPES.includes(a.action_type)),
    ),
    receita: valorCompra(row.action_values),
  };
}

/** Monta o RelatorioAds a partir da linha agregada + conjuntos de uma node. */
function montarRelatorio(
  conta: InsightsRow,
  adsetRows: InsightsRow[] | null,
  inicioMs: number,
  fimMs: number,
): RelatorioAds {
  const adSets: AdSetRow[] = (adsetRows ?? []).map((r, i) =>
    linhaParaAdSet(r, `Conjunto ${i + 1}`),
  );

  const investimento = n(conta.spend);
  const impressoes = n(conta.impressions);
  const alcance = n(conta.reach);
  const cliques = conta.clicks != null ? n(conta.clicks) : null;
  const comprasArr = conta.actions?.filter((a) =>
    PURCHASE_TYPES.includes(a.action_type),
  );
  const compras = valorCompra(comprasArr);
  const receita = valorCompra(conta.action_values);

  const totais: RelatorioAds['totais'] = {
    investimento,
    impressoes,
    alcance,
    cliques,
    cpm: impressoes > 0 ? (investimento / impressoes) * 1000 : 0,
    cpc: cliques && cliques > 0 ? investimento / cliques : null,
    ctr: cliques != null && impressoes > 0 ? (cliques / impressoes) * 100 : null,
    compras,
    receita,
    roas: receita != null && investimento > 0 ? receita / investimento : null,
    custoPorCompra: compras != null && compras > 0 ? investimento / compras : null,
    seguidoresIg: null,
    frequenciaMedia: alcance > 0 ? impressoes / alcance : n(conta.frequency),
  };

  return {
    periodo: { inicio: isoDoMs(inicioMs), fim: isoDoMs(fimMs) },
    adSets,
    totais,
  };
}

/**
 * Relatório de tráfego pago ao vivo de um projeto, nível CONTA inteira.
 * Só é usado quando o projeto NÃO tem campanhas mapeadas (essas são tratadas
 * por getMetaAdsCampanhas, que mostra cada campanha separada). Devolve null se
 * não há conta mapeada, token, ou se a API falhar.
 */
export async function getMetaAdsRelatorio(
  projetoId: string,
  inicioMs: number,
  fimMs: number,
): Promise<RelatorioAds | null> {
  try {
    // Campanhas mapeadas têm seu próprio detalhamento (getMetaAdsCampanhas).
    if (env.metaAds.campaigns[projetoId]?.length) return null;
    const actId = env.metaAds.accounts[projetoId];
    if (!actId || !env.instagram.graphToken) return null;

    const range = timeRange(inicioMs, fimMs);
    const [totalRows, adsetRows] = await Promise.all([
      buscarInsights(actId, range, 'account'),
      buscarInsights(actId, range, 'adset'),
    ]);

    const conta = totalRows?.[0];
    if (!conta) return null;
    return montarRelatorio(conta, adsetRows, inicioMs, fimMs);
  } catch (err) {
    console.error('[metaAds] erro inesperado:', err);
    return null;
  }
}

export type CampanhaAds = {
  id: string;
  nome: string;
  objetivo: string;
  /** true quando a campanha não veiculou nada no período (recém-criada, etc). */
  semDados: boolean;
  relatorio: RelatorioAds | null;
  /** Resultados orientados a tráfego/mensagens (além de compras/ROAS no relatorio). */
  resultado: {
    linkClicks: number | null;
    custoPorLinkClick: number | null;
    conversas: number | null;
    custoPorConversa: number | null;
  };
};

/** Busca nome + objetivo de uma campanha. */
async function buscarCampanhaMeta(
  campanhaId: string,
): Promise<{ name: string; objective: string } | null> {
  const token = env.instagram.graphToken;
  if (!token) return null;
  const url =
    `${BASE}/${env.instagram.graphVersion}/${campanhaId}` +
    `?fields=name,objective&access_token=${token}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    console.error('[metaAds] campanha meta', campanhaId, res.status);
    return null;
  }
  return (await res.json()) as { name: string; objective: string };
}

/**
 * Tráfego pago ao vivo de um projeto, DETALHADO POR CAMPANHA. Devolve um item
 * por campanha mapeada em META_ADS_CAMPAIGNS (cada uma com seu nome, objetivo e
 * resultados). Devolve null se o projeto não tem campanhas mapeadas.
 */
export async function getMetaAdsCampanhas(
  projetoId: string,
  inicioMs: number,
  fimMs: number,
): Promise<CampanhaAds[] | null> {
  const ids = env.metaAds.campaigns[projetoId];
  if (!ids || ids.length === 0 || !env.instagram.graphToken) return null;
  const range = timeRange(inicioMs, fimMs);

  try {
    return await Promise.all(
      ids.map(async (id): Promise<CampanhaAds> => {
        const [meta, totalRows, adsetRows] = await Promise.all([
          buscarCampanhaMeta(id),
          buscarInsights(id, range),
          buscarInsights(id, range, 'adset'),
        ]);
        const conta = totalRows?.[0];
        const relatorio = conta
          ? montarRelatorio(conta, adsetRows, inicioMs, fimMs)
          : null;
        const acts = conta?.actions;
        const investimento = relatorio?.totais.investimento ?? 0;
        const linkClicks = somaActions(acts, ['link_click']);
        const conversas = somaActions(acts, CONVERSA_TYPES);
        return {
          id,
          nome: meta?.name ?? `Campanha ${id}`,
          objetivo: meta?.objective ?? '',
          semDados: !conta,
          relatorio,
          resultado: {
            linkClicks,
            custoPorLinkClick:
              linkClicks && linkClicks > 0 ? investimento / linkClicks : null,
            conversas,
            custoPorConversa:
              conversas && conversas > 0 ? investimento / conversas : null,
          },
        };
      }),
    );
  } catch (err) {
    console.error('[metaAds] erro ao buscar campanhas:', err);
    return null;
  }
}

/** Objetivo de cada campanha da conta (id -> objective), pra rotular os cards. */
async function objetivosDaConta(actId: string): Promise<Map<string, string>> {
  const token = env.instagram.graphToken;
  const mapa = new Map<string, string>();
  if (!token) return mapa;
  try {
    const url =
      `${BASE}/${env.instagram.graphVersion}/${actId}/campaigns` +
      `?fields=id,objective&limit=500&access_token=${token}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return mapa;
    const data = (await res.json()) as {
      data?: { id: string; objective?: string }[];
    };
    for (const c of data.data ?? []) if (c.objective) mapa.set(c.id, c.objective);
  } catch {
    /* rótulo é opcional */
  }
  return mapa;
}

/**
 * Tráfego pago ao vivo da CONTA INTEIRA de um projeto: total + uma entrada por
 * campanha que veiculou no período (descobertas automaticamente via level=campaign,
 * sem precisar mapear cada campanha à mão). Devolve null se o projeto não tem
 * conta mapeada em META_ADS_ACCOUNTS, sem token, ou se a API falhar.
 */
export async function getMetaAdsContaCampanhas(
  projetoId: string,
  inicioMs: number,
  fimMs: number,
): Promise<{ total: RelatorioAds | null; campanhas: CampanhaAds[] } | null> {
  const actId = env.metaAds.accounts[projetoId];
  if (!actId || !env.instagram.graphToken) return null;
  const range = timeRange(inicioMs, fimMs);

  try {
    const [totalRows, campRows, adsetRows, objetivos] = await Promise.all([
      buscarInsights(actId, range, 'account'),
      buscarInsights(actId, range, 'campaign'),
      buscarInsights(actId, range, 'adset'),
      objetivosDaConta(actId),
    ]);

    const conta = totalRows?.[0];
    const total = conta ? montarRelatorio(conta, adsetRows, inicioMs, fimMs) : null;

    const campanhas: CampanhaAds[] = (campRows ?? [])
      .map((row): CampanhaAds => {
        const relatorio = montarRelatorio(row, null, inicioMs, fimMs);
        const investimento = relatorio.totais.investimento;
        const linkClicks = somaActions(row.actions, ['link_click']);
        const conversas = somaActions(row.actions, CONVERSA_TYPES);
        const id = row.campaign_id ?? row.campaign_name ?? '';
        return {
          id,
          nome: row.campaign_name ?? `Campanha ${id}`,
          objetivo: objetivos.get(id) ?? '',
          semDados: false,
          relatorio,
          resultado: {
            linkClicks,
            custoPorLinkClick:
              linkClicks && linkClicks > 0 ? investimento / linkClicks : null,
            conversas,
            custoPorConversa:
              conversas && conversas > 0 ? investimento / conversas : null,
          },
        };
      })
      // só campanhas que realmente gastaram no período, da maior pra menor
      .filter((c) => (c.relatorio?.totais.investimento ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.relatorio?.totais.investimento ?? 0) -
          (a.relatorio?.totais.investimento ?? 0),
      );

    if (!total && campanhas.length === 0) return null;
    return { total, campanhas };
  } catch (err) {
    console.error('[metaAds] erro ao buscar conta/campanhas:', err);
    return null;
  }
}
