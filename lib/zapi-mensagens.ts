import { env } from './env';
import { supabaseAdmin } from './supabase';

/** Id do grupo só com o número (Z-API manda "1203...-group" ou "1203...@g.us"). */
export function grupoSoNumero(id: string): string {
  return (id ?? '').split(/[@-]/)[0].replace(/\D/g, '');
}

/** Endereço do webhook do Z-API, com a chave pra ninguém de fora gravar mensagens. */
export function urlDoWebhookZapi(): string {
  return `${env.app.url}/api/whatsapp/zapi-webhook?k=${encodeURIComponent(process.env.CRON_SECRET ?? '')}`;
}

function base(): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.zapi.clientToken) headers['Client-Token'] = env.zapi.clientToken;
  return { url: `https://api.z-api.io/instances/${env.zapi.instanceId}/token/${env.zapi.instanceToken}`, headers };
}

export async function zapiGet(caminho: string): Promise<any> {
  const b = base();
  const r = await fetch(`${b.url}${caminho}`, { headers: b.headers, cache: 'no-store' });
  return r.json().catch(() => ({ status: r.status }));
}
export async function zapiPut(caminho: string, corpo: unknown): Promise<any> {
  const b = base();
  const r = await fetch(`${b.url}${caminho}`, { method: 'PUT', headers: b.headers, body: JSON.stringify(corpo) });
  return r.json().catch(() => ({ status: r.status }));
}

/** Mensagens do grupo desde `desde` (as que a Lud mandou e as do cliente). */
export async function mensagensDoGrupoDesde(grupoId: string, desde: string): Promise<{ texto: string; fromMe: boolean; momento: string }[]> {
  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('zapi_mensagens')
    .select('texto, from_me, momento')
    .eq('grupo_id', grupoSoNumero(grupoId))
    .gte('momento', desde)
    .order('momento', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: any) => ({ texto: m.texto ?? '', fromMe: !!m.from_me, momento: m.momento }));
}

/** Quando começou a gravar mensagens (a conferência só vale daí pra frente). */
export async function inicioDaLeitura(): Promise<string | null> {
  const sb = await supabaseAdmin();
  const { data } = await sb.from('zapi_mensagens').select('momento').order('momento', { ascending: true }).limit(1);
  return (data?.[0] as any)?.momento ?? null;
}
