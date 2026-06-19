import { env } from './env';

/**
 * Cliente da API da Hotmart (Payments API v1).
 *
 * Fluxo de auth: OAuth2 client_credentials.
 *   POST https://api-sec-vlc.hotmart.com/security/oauth/token
 *     ?grant_type=client_credentials&client_id=...&client_secret=...
 *   Header: Authorization: Basic <basic token>
 *
 * As credenciais (client_id, client_secret e o token Basic) saem do painel:
 *   Hotmart → Ferramentas → Credenciais da API (Hotmart Developers).
 *
 * Usamos o endpoint de resumo de vendas (sales/summary) pra montar os
 * números de cabeçalho do projeto. Tudo falha de forma graciosa: se algo
 * der errado ou não estiver configurado, devolve null e a página só não
 * mostra a seção.
 */

const AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const API_BASE = 'https://developers.hotmart.com/payments/api/v1';

export type HotmartResumo = {
  periodo: { inicio: string; fim: string };
  moeda: string;
  receitaTotal: number;
  vendas: number;
  ticketMedio: number | null;
};

// ── token cache (módulo) ────────────────────────────────────────────────────
let tokenCache: { token: string; expiraEm: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const { clientId, clientSecret, basic } = env.hotmart;
  if (!clientId || !clientSecret || !basic) return null;

  // reaproveita token enquanto válido (margem de 60s)
  const agora = Date.now();
  if (tokenCache && tokenCache.expiraEm - 60_000 > agora) {
    return tokenCache.token;
  }

  const url = `${AUTH_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(
    clientId,
  )}&client_secret=${encodeURIComponent(clientSecret)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error('[hotmart] falha no token:', res.status, await res.text().catch(() => ''));
    return null;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  tokenCache = {
    token: data.access_token,
    expiraEm: agora + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

function isoDoMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Resumo de vendas de um projeto no período (início/fim em epoch ms).
 * Se o projeto não tem produto mapeado e não há produto default, devolve
 * null (sem seção na página).
 */
export async function getHotmartResumo(
  projetoId: string,
  inicioMs: number,
  fimMs: number,
): Promise<HotmartResumo | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;

    const productId = env.hotmart.products[projetoId] ?? env.hotmart.defaultProductId;
    // Sem produto mapeado e sem default: não dá pra isolar as vendas desse
    // projeto, então não mostramos nada (evita misturar produtos).
    if (!productId) return null;

    const params = new URLSearchParams({
      start_date: String(inicioMs),
      end_date: String(fimMs),
      product_id: productId,
    });

    const res = await fetch(`${API_BASE}/sales/summary?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[hotmart] sales/summary:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = (await res.json()) as { items?: any[] };
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      return {
        periodo: { inicio: isoDoMs(inicioMs), fim: isoDoMs(fimMs) },
        moeda: 'BRL',
        receitaTotal: 0,
        vendas: 0,
        ticketMedio: null,
      };
    }

    // A API agrupa por moeda. Pra simplificar pegamos a moeda com maior
    // receita (normalmente BRL) e somamos o que estiver nela.
    const num = (v: any): number => {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      if (typeof v === 'object' && 'value' in v) return Number(v.value) || 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const porMoeda = new Map<string, { receita: number; vendas: number }>();
    for (const it of items) {
      // A moeda vem dentro de total_value na API atual; mantemos fallbacks.
      const moeda =
        it.total_value?.currency_code ?? it.currency_code ?? it.currency ?? 'BRL';
      const receita = num(it.total_value ?? it.total);
      const vendas = num(it.total_items ?? it.transactions ?? it.total_transactions);
      const atual = porMoeda.get(moeda) ?? { receita: 0, vendas: 0 };
      atual.receita += receita;
      atual.vendas += vendas;
      porMoeda.set(moeda, atual);
    }

    let moedaTop = 'BRL';
    let top = { receita: 0, vendas: 0 };
    for (const [moeda, v] of porMoeda) {
      if (v.receita >= top.receita) {
        top = v;
        moedaTop = moeda;
      }
    }

    return {
      periodo: { inicio: isoDoMs(inicioMs), fim: isoDoMs(fimMs) },
      moeda: moedaTop,
      receitaTotal: top.receita,
      vendas: top.vendas,
      ticketMedio: top.vendas > 0 ? top.receita / top.vendas : null,
    };
  } catch (err) {
    console.error('[hotmart] erro inesperado:', err);
    return null;
  }
}
