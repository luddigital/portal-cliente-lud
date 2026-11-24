import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { grupoSoNumero } from '@/lib/zapi-mensagens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook do Z-API ("ao receber", com "enviadas por mim" ligado).
 * Guarda só mensagens de GRUPO: o texto, quem mandou e quando. Serve pra
 * conferir o que já foi mandado no grupo antes da reaprovação automática.
 */
export async function POST(req: Request) {
  const k = new URL(req.url).searchParams.get('k');
  if (!process.env.CRON_SECRET || k !== process.env.CRON_SECRET) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  const b: any = await req.json().catch(() => null);
  if (!b || !b.isGroup || !b.phone || !b.messageId) return NextResponse.json({ ok: true, ignorado: true });
  const texto = b.text?.message ?? b.image?.caption ?? b.video?.caption ?? b.document?.caption ?? null;
  const momento = new Date(typeof b.momment === 'number' ? b.momment : Date.now()).toISOString();
  try {
    const sb = await supabaseAdmin();
    await sb.from('zapi_mensagens').upsert({
      id: String(b.messageId),
      grupo_id: grupoSoNumero(String(b.phone)),
      from_me: !!b.fromMe,
      remetente: b.senderName ?? b.participantPhone ?? null,
      texto,
      momento,
    });
  } catch (e: any) {
    console.warn('[zapi-webhook]', e?.message);
  }
  return NextResponse.json({ ok: true });
}
