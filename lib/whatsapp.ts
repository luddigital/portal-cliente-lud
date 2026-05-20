/**
 * Lud. Digital — cliente Evolution API
 *
 * A Evolution API roda num VPS próprio e mantém a sessão do WhatsApp Web
 * conectada. Este módulo encapsula as chamadas REST que o Portal faz.
 *
 * Docs: https://doc.evolution-api.com/
 */
import { env } from './env';

type EvolutionResponse<T = any> = T & { error?: string };

function endpoint(path: string): string {
  if (!env.whatsapp.apiUrl) {
    throw new Error('EVOLUTION_API_URL não configurada');
  }
  return `${env.whatsapp.apiUrl.replace(/\/$/, '')}${path}`;
}

function headers(): Record<string, string> {
  if (!env.whatsapp.apiKey) {
    throw new Error('EVOLUTION_API_KEY não configurada');
  }
  return {
    'Content-Type': 'application/json',
    apikey: env.whatsapp.apiKey,
  };
}

async function call<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: any,
): Promise<EvolutionResponse<T>> {
  const res = await fetch(endpoint(path), {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Evolution ${method} ${path} → ${res.status}: ${txt}`);
  }
  return (await res.json()) as EvolutionResponse<T>;
}

// -----------------------------------------------------------------
// Sessão / instância
// -----------------------------------------------------------------

/** Estado da conexão da instância (open = conectada). */
export async function connectionState(): Promise<{
  state: 'open' | 'close' | 'connecting' | string;
}> {
  return call<{ state: string }>('GET', `/instance/connectionState/${env.whatsapp.instance}`);
}

/** Gera novo QR Code (uso pontual, quando precisar religar). */
export async function gerarQrCode(): Promise<{ base64?: string; code?: string }> {
  return call('GET', `/instance/connect/${env.whatsapp.instance}`);
}

// -----------------------------------------------------------------
// Grupos
// -----------------------------------------------------------------

export type EvoGrupo = {
  id: string;          // ex: 1203...@g.us
  subject: string;     // nome do grupo
  pictureUrl?: string;
  size?: number;
  desc?: string;
  participants?: { id: string; admin?: string | null }[];
};

/** Lista todos os grupos que a conta participa. */
export async function listarGruposWhatsApp(): Promise<EvoGrupo[]> {
  const data = await call<EvoGrupo[] | { groups: EvoGrupo[] }>(
    'GET',
    `/group/fetchAllGroups/${env.whatsapp.instance}?getParticipants=false`,
  );
  if (Array.isArray(data)) return data;
  return (data as any).groups ?? [];
}

// -----------------------------------------------------------------
// Envio de mensagens
// -----------------------------------------------------------------

export type EnvioResultado = {
  key: { id: string; remoteJid: string };
  status: string;
};

/** Envia texto pra um grupo (ou contato) — usa o número da instância. */
export async function enviarTexto(
  destinoJid: string,
  texto: string,
): Promise<EnvioResultado> {
  return call('POST', `/message/sendText/${env.whatsapp.instance}`, {
    number: destinoJid,
    text: texto,
  });
}

/** Envia mídia (imagem/audio/video/doc) por URL. */
export async function enviarMidia(
  destinoJid: string,
  midiaUrl: string,
  tipo: 'image' | 'audio' | 'video' | 'document',
  caption?: string,
  fileName?: string,
): Promise<EnvioResultado> {
  return call('POST', `/message/sendMedia/${env.whatsapp.instance}`, {
    number: destinoJid,
    mediatype: tipo,
    media: midiaUrl,
    caption,
    fileName,
  });
}

// -----------------------------------------------------------------
// Webhook payload (entrada)
// -----------------------------------------------------------------

/**
 * Formato do payload que a Evolution dispara no `WEBHOOK_GLOBAL_URL`.
 * Cobrimos só os eventos que importam pro Portal.
 */
export type WebhookPayload = {
  event: string; // ex: 'messages.upsert', 'messages.update', 'connection.update'
  instance: string;
  data: any;
};

/** Normaliza payload de mensagem nova num formato pronto pra persistir. */
export function parseMensagemRecebida(payload: WebhookPayload):
  | {
      id: string;
      grupoId: string;
      remetenteNumero: string | null;
      remetenteNome: string | null;
      conteudo: string | null;
      tipo: 'texto' | 'imagem' | 'audio' | 'video' | 'doc' | 'sticker';
      midiaUrl: string | null;
      midiaMimetype: string | null;
      citadaId: string | null;
      timestamp: Date;
    }
  | null {
  if (payload.event !== 'messages.upsert') return null;
  const msg = payload.data;
  if (!msg || !msg.key) return null;

  const remoteJid: string = msg.key.remoteJid ?? '';
  // só nos importa grupos (terminam em @g.us). Mensagens diretas são ignoradas.
  if (!remoteJid.endsWith('@g.us')) return null;

  const id: string = msg.key.id;
  const remetenteJid: string | undefined = msg.key.participant ?? msg.participant;
  const remetenteNumero = remetenteJid ? remetenteJid.split('@')[0] : null;
  const remetenteNome: string | null = msg.pushName ?? null;

  // tipo de mensagem
  const m = msg.message ?? {};
  let conteudo: string | null = null;
  let tipo: 'texto' | 'imagem' | 'audio' | 'video' | 'doc' | 'sticker' = 'texto';
  let midiaUrl: string | null = null;
  let midiaMimetype: string | null = null;

  if (m.conversation) {
    conteudo = m.conversation;
  } else if (m.extendedTextMessage?.text) {
    conteudo = m.extendedTextMessage.text;
  } else if (m.imageMessage) {
    tipo = 'imagem';
    conteudo = m.imageMessage.caption ?? null;
    midiaUrl = m.imageMessage.url ?? null;
    midiaMimetype = m.imageMessage.mimetype ?? null;
  } else if (m.audioMessage) {
    tipo = 'audio';
    midiaUrl = m.audioMessage.url ?? null;
    midiaMimetype = m.audioMessage.mimetype ?? null;
  } else if (m.videoMessage) {
    tipo = 'video';
    conteudo = m.videoMessage.caption ?? null;
    midiaUrl = m.videoMessage.url ?? null;
    midiaMimetype = m.videoMessage.mimetype ?? null;
  } else if (m.documentMessage) {
    tipo = 'doc';
    conteudo = m.documentMessage.fileName ?? null;
    midiaUrl = m.documentMessage.url ?? null;
    midiaMimetype = m.documentMessage.mimetype ?? null;
  } else if (m.stickerMessage) {
    tipo = 'sticker';
    midiaUrl = m.stickerMessage.url ?? null;
    midiaMimetype = 'image/webp';
  }

  // mensagem citada (reply)
  const citadaId: string | null =
    m.extendedTextMessage?.contextInfo?.stanzaId ?? null;

  const ts = msg.messageTimestamp ?? Date.now() / 1000;
  const timestamp = new Date(typeof ts === 'number' ? ts * 1000 : Date.parse(ts));

  return {
    id,
    grupoId: remoteJid,
    remetenteNumero,
    remetenteNome,
    conteudo,
    tipo,
    midiaUrl,
    midiaMimetype,
    citadaId,
    timestamp,
  };
}

/**
 * Validação do webhook. A Evolution não assina payload por padrão, então usamos
 * um header customizado: o servidor Evolution deve incluir
 * `x-lud-webhook-secret: <EVOLUTION_WEBHOOK_SECRET>`.
 *
 * (Configurar isso no docker via WEBHOOK_GLOBAL_HEADERS — ver README.)
 */
export function validarWebhookSecret(headerValue: string | null): boolean {
  if (!env.whatsapp.webhookSecret) return false;
  return headerValue === env.whatsapp.webhookSecret;
}
