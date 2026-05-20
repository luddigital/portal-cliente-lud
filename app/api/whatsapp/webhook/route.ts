/**
 * Webhook da Evolution API.
 * Recebe eventos de mensagens novas e persiste no Supabase.
 *
 * Configurar na Evolution:
 *   WEBHOOK_GLOBAL_URL=https://portal.lud.digital/api/whatsapp/webhook
 *   WEBHOOK_GLOBAL_HEADERS='{"x-lud-webhook-secret":"<EVOLUTION_WEBHOOK_SECRET>"}'
 */
import { NextRequest, NextResponse } from 'next/server';
import { parseMensagemRecebida, validarWebhookSecret, type WebhookPayload } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // 1. Valida que o webhook é legítimo
  const secret = req.headers.get('x-lud-webhook-secret');
  if (!validarWebhookSecret(secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // 2. Eventos de conexão: só logamos (poderíamos disparar push pra Luiza
  // quando a sessão cair — fica como TODO).
  if (payload.event === 'connection.update') {
    console.log('[whatsapp] connection.update', payload.data);
    return NextResponse.json({ ok: true });
  }

  // 3. Mensagens novas
  const msg = parseMensagemRecebida(payload);
  if (!msg) {
    // Ignora eventos que não são mensagem de grupo (DM, status, etc).
    return NextResponse.json({ ok: true, ignored: true });
  }

  const sb = await supabaseAdmin();

  // 4. Só persiste se o grupo está cadastrado e ATIVO no Portal.
  // Conversas pessoais e grupos que não habilitamos são descartadas silenciosamente.
  const { data: grupo, error: errGrupo } = await sb
    .from('whatsapp_grupos')
    .select('id, ativo')
    .eq('id', msg.grupoId)
    .maybeSingle();

  if (errGrupo) {
    console.error('[whatsapp] erro consultando grupo', errGrupo);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
  if (!grupo || !grupo.ativo) {
    return NextResponse.json({ ok: true, ignored: 'grupo_inativo' });
  }

  // 5. Upsert da mensagem (idempotente — webhook pode repetir).
  const { error: errInsert } = await sb.from('whatsapp_mensagens').upsert(
    {
      id: msg.id,
      grupo_id: msg.grupoId,
      remetente_numero: msg.remetenteNumero,
      remetente_nome: msg.remetenteNome,
      conteudo: msg.conteudo,
      tipo: msg.tipo,
      midia_url: msg.midiaUrl,
      midia_mimetype: msg.midiaMimetype,
      citada_id: msg.citadaId,
      timestamp: msg.timestamp.toISOString(),
      // se a mensagem foi disparada por nós pelo Portal, o /send já gravou.
      // Aqui chegamos pelo eco do WhatsApp — não sobrescrevemos os campos
      // `enviado_via_portal` e `enviado_por_usuario` quando já existem.
    },
    { onConflict: 'id', ignoreDuplicates: false },
  );

  if (errInsert) {
    console.error('[whatsapp] erro persistindo mensagem', errInsert);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
