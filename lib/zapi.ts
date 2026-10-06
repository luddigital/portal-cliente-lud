import { env } from './env';

/**
 * Z-API — gateway WhatsApp.
 * Docs: https://developer.z-api.io/message/send-text
 *
 * Precisa de 3 env vars:
 * - ZAPI_INSTANCE_ID
 * - ZAPI_INSTANCE_TOKEN
 * - ZAPI_CLIENT_TOKEN (header de autenticação, obrigatório nas novas instâncias)
 */

export function zapiConfigured(): boolean {
  return !!(env.zapi.instanceId && env.zapi.instanceToken);
}

/**
 * Normaliza um telefone pro formato aceito pelo Z-API:
 * - Só dígitos
 * - Começa com 55 (BR). Se já começar com 55 e tiver 12+ dígitos, mantém.
 * - Nunca inclui "+", espaços, parênteses ou traços.
 *
 * Aceita entradas como "(11) 98765-4321", "+55 11 98765-4321",
 * "11987654321", "5511987654321" — todas viram "5511987654321".
 */
export function normalizarTelefone(raw: string): string | null {
  const soDigito = raw.replace(/\D/g, '');
  if (!soDigito) return null;
  // Já tem código do país?
  if (soDigito.length >= 12 && soDigito.startsWith('55')) return soDigito;
  // 10 ou 11 dígitos — assumindo BR, prepend 55.
  if (soDigito.length === 10 || soDigito.length === 11) return '55' + soDigito;
  // Outros formatos (ex: número de outro país já com DDI) — passa como veio.
  if (soDigito.length >= 11) return soDigito;
  return null;
}

export type ResultadoEnvio =
  | { ok: true; messageId: string }
  | { ok: false; erro: string };

export type GrupoZapi = {
  id: string; // ex: "120363XXXXXXX@g.us"
  name: string;
  pictureUrl: string | null;
};

/**
 * Lista todos os grupos do WhatsApp da instância conectada.
 * Docs: https://developer.z-api.io/chats/list-chats
 *
 * O endpoint retorna todos os chats (contatos + grupos). Filtramos aqui
 * só os que terminam com "@g.us" (grupos).
 */
export async function listarGruposZapi(): Promise<GrupoZapi[]> {
  if (!zapiConfigured()) {
    throw new Error('Z-API não configurado (falta ZAPI_INSTANCE_ID/TOKEN).');
  }

  const headers: Record<string, string> = {};
  if (env.zapi.clientToken) {
    headers['Client-Token'] = env.zapi.clientToken;
  }

  // Paginação: Z-API aceita page/pageSize. 500 por página cobre quase tudo
  // (contas com muito grupo são raras).
  const grupos: GrupoZapi[] = [];
  let page = 1;
  const pageSize = 500;
  for (;;) {
    const url = `https://api.z-api.io/instances/${env.zapi.instanceId}/token/${env.zapi.instanceToken}/chats?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url, { headers });
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(
        `Z-API HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
      );
    }
    let data: any = [];
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new Error('Z-API devolveu resposta inválida: ' + bodyText.slice(0, 200));
    }
    const lista: any[] = Array.isArray(data) ? data : data?.chats ?? [];
    if (lista.length === 0) break;

    for (const c of lista) {
      // Grupos no WhatsApp têm sufixo "@g.us". Z-API expõe isso em `phone`
      // (sim, o nome do campo é confuso) ou `id`, dependendo da versão.
      const id: string = c.phone ?? c.id ?? '';
      if (!id.includes('@g.us') && !c.isGroup) continue;
      grupos.push({
        id,
        name: c.name ?? c.subject ?? '(sem nome)',
        pictureUrl: c.imageUrl ?? c.pictureUrl ?? null,
      });
    }

    if (lista.length < pageSize) break;
    page++;
    if (page > 20) break; // sanity cap pra evitar loop infinito
  }

  return grupos;
}

/**
 * Envia uma mensagem de texto simples via Z-API.
 */
export async function enviarMensagemTexto(
  telefone: string,
  mensagem: string,
): Promise<ResultadoEnvio> {
  if (!zapiConfigured()) {
    return { ok: false, erro: 'Z-API não configurado (falta ZAPI_INSTANCE_ID/TOKEN).' };
  }

  const url = `https://api.z-api.io/instances/${env.zapi.instanceId}/token/${env.zapi.instanceToken}/send-text`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (env.zapi.clientToken) {
    headers['Client-Token'] = env.zapi.clientToken;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: telefone, message: mensagem }),
    });
    const bodyText = await res.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch {
      /* resposta não-JSON — mantém texto bruto */
    }

    if (!res.ok) {
      const erro =
        body?.error ??
        body?.message ??
        bodyText.slice(0, 200) ??
        `Z-API HTTP ${res.status}`;
      return { ok: false, erro: String(erro) };
    }

    // Z-API retorna { messageId, zaapId, id } em sucesso.
    const messageId: string =
      body?.messageId ?? body?.id ?? body?.zaapId ?? 'enviado';
    return { ok: true, messageId };
  } catch (err: any) {
    return {
      ok: false,
      erro: `Falha ao chamar Z-API: ${err?.message ?? err}`,
    };
  }
}
