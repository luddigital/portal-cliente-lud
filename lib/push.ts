import webpush from 'web-push';
import { fetchDoNotion } from './notionFetch';
import { Client } from '@notionhq/client';
import { env } from './env';

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const notion = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });
const PUSH_PROP = 'Push Subscriptions';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  if (!env.push.vapidPublic || !env.push.vapidPrivate) {
    throw new Error('VAPID keys não configuradas (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)');
  }
  webpush.setVapidDetails(env.push.vapidSubject, env.push.vapidPublic, env.push.vapidPrivate);
  vapidConfigured = true;
}

/**
 * Subscriptions são persistidas no banco Clientes do Notion na property
 * "Push Subscriptions" (rich_text JSON). Sobrevive a cold starts do lambda.
 */
async function findClienteByEmail(emailNorm: string): Promise<any | null> {
  const res = await notion.databases.query({
    database_id: env.notion.clientesDbId,
    page_size: 1,
    filter: {
      property: env.notion.clienteProps.email,
      email: { equals: emailNorm },
    },
  });
  return (res.results[0] as any) ?? null;
}

function lerSubsDoCliente(cliente: any): PushSubscription[] {
  const rt = cliente?.properties?.[PUSH_PROP]?.rich_text ?? [];
  const raw = rt.map((r: any) => r.plain_text).join('').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

async function salvarSubsNoCliente(clienteId: string, subs: PushSubscription[]): Promise<void> {
  const json = JSON.stringify(subs);
  // Notion rich_text limit: 2000 chars por chunk. Quebra se necessário.
  const chunks: string[] = [];
  let i = 0;
  while (i < json.length) {
    chunks.push(json.slice(i, i + 1900));
    i += 1900;
  }
  await notion.pages.update({
    page_id: clienteId,
    properties: {
      [PUSH_PROP]: {
        rich_text: chunks.map((c) => ({ type: 'text', text: { content: c } })),
      },
    },
  });
}

export async function addSubscription(email: string, sub: PushSubscription): Promise<void> {
  const norm = email.trim().toLowerCase();
  const cliente = await findClienteByEmail(norm);
  if (!cliente) {
    console.warn('[push] cliente não encontrado pra', norm);
    return;
  }
  const existing = lerSubsDoCliente(cliente);
  if (existing.some((s) => s.endpoint === sub.endpoint)) return;
  existing.push(sub);
  await salvarSubsNoCliente(cliente.id, existing);
}

export async function removeSubscription(email: string, endpoint: string): Promise<void> {
  const norm = email.trim().toLowerCase();
  const cliente = await findClienteByEmail(norm);
  if (!cliente) return;
  const existing = lerSubsDoCliente(cliente);
  const filtered = existing.filter((s) => s.endpoint !== endpoint);
  if (filtered.length === existing.length) return;
  await salvarSubsNoCliente(cliente.id, filtered);
}

export async function getSubscriptions(email: string): Promise<PushSubscription[]> {
  const norm = email.trim().toLowerCase();
  const cliente = await findClienteByEmail(norm);
  if (!cliente) return [];
  return lerSubsDoCliente(cliente);
}

// === Send ===
export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPush(
  email: string,
  payload: PushPayload,
): Promise<{ enviados: number; falhas: number }> {
  ensureVapid();
  const subs = await getSubscriptions(email);
  if (subs.length === 0) return { enviados: 0, falhas: 0 };

  const data = JSON.stringify(payload);
  let enviados = 0;
  let falhas = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub as any, data);
        enviados++;
      } catch (err: any) {
        falhas++;
        // Subscription expirou (410) ou inválida (404) — remove
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await removeSubscription(email, sub.endpoint).catch(() => {});
        }
        console.warn('[push] falha pra', sub.endpoint.slice(0, 40), '...', err?.statusCode);
      }
    }),
  );

  return { enviados, falhas };
}
