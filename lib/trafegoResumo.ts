/**
 * Resumo de tráfego pago por projeto, a partir do que já existe em
 * lib/metaAds.ts (campanhas mapeadas em META_ADS_CAMPAIGNS ou a conta inteira
 * em META_ADS_ACCOUNTS). Sem integração nova: só junta e guarda em cache.
 *
 * "Rodando" = a campanha gastou alguma coisa nos últimos 7 dias.
 */
import { unstable_cache } from 'next/cache';
import { env } from './env';
import { getMetaAdsCampanhas, getMetaAdsContaCampanhas, type CampanhaAds } from './metaAds';

const DIA = 86_400_000;
const semTraco = (s: string) => s.replace(/-/g, '');

/** Acha a chave do projeto nos mapas da Meta (aceita id com ou sem traço). */
export function chaveMetaDoProjeto(projetoId: string): string | null {
  const alvo = semTraco(projetoId);
  const chaves = [...Object.keys(env.metaAds.campaigns), ...Object.keys(env.metaAds.accounts)];
  return chaves.find((k) => semTraco(k) === alvo) ?? null;
}

/** Conta de anúncios (act_…) ligada ao projeto, se tiver. */
export function contaMetaDoProjeto(projetoId: string): string | null {
  const k = chaveMetaDoProjeto(projetoId);
  return k ? env.metaAds.accounts[k] ?? null : null;
}

/** Campanhas do projeto no período: as mapeadas, ou as que veicularam na conta. */
export async function campanhasDoProjeto(projetoId: string, inicioMs: number, fimMs: number): Promise<CampanhaAds[] | null> {
  const k = chaveMetaDoProjeto(projetoId);
  if (!k) return null;
  if (env.metaAds.campaigns[k]?.length) return getMetaAdsCampanhas(k, inicioMs, fimMs);
  const conta = await getMetaAdsContaCampanhas(k, inicioMs, fimMs);
  return conta ? conta.campanhas : null;
}

export type ResumoTrafego = {
  /** false = projeto sem conta/campanha da Meta ligada no portal. */
  ligado: boolean;
  /** Campanhas que contam (mapeadas, ou que gastaram nos últimos 30 dias). */
  total: number;
  rodando: number;
};

async function _resumo(projetoId: string): Promise<ResumoTrafego> {
  const k = chaveMetaDoProjeto(projetoId);
  if (!k || !env.instagram.graphToken) return { ligado: false, total: 0, rodando: 0 };
  const agora = Date.now();
  const gastou = (c: CampanhaAds) => (c.relatorio?.totais.investimento ?? 0) > 0;
  if (env.metaAds.campaigns[k]?.length) {
    const semana = (await getMetaAdsCampanhas(k, agora - 7 * DIA, agora)) ?? [];
    return { ligado: true, total: env.metaAds.campaigns[k].length, rodando: semana.filter(gastou).length };
  }
  const [mes, semana] = await Promise.all([
    getMetaAdsContaCampanhas(k, agora - 30 * DIA, agora),
    getMetaAdsContaCampanhas(k, agora - 7 * DIA, agora),
  ]);
  return { ligado: true, total: mes?.campanhas.length ?? 0, rodando: semana?.campanhas.filter(gastou).length ?? 0 };
}

const _resumoCached = unstable_cache(_resumo, ['resumo-trafego-v1'], { revalidate: 600 });

export async function resumoTrafegoDoProjeto(projetoId: string): Promise<ResumoTrafego> {
  try {
    return await _resumoCached(projetoId);
  } catch {
    return { ligado: false, total: 0, rodando: 0 };
  }
}
