/**
 * Envia mensagem pra um grupo do WhatsApp via Evolution API.
 * Só permite se o usuário logado tem `pode_responder = true` no grupo.
 * Grava no banco com auditoria (quem apertou enviar).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { enviarTexto } from '@/lib/whatsapp';
import { podeResponderNoGrupo, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { grupoId?: string; texto?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const grupoId = body.grupoId?.trim();
  const texto = body.texto?.trim();
  if (!grupoId || !texto) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (texto.length > 4000) {
    return NextResponse.json({ error: 'texto_muito_longo' }, { status: 400 });
  }

  // 1. Permissão
  const pode = await podeResponderNoGrupo(session.email, grupoId);
  if (!pode) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 2. Envia pra Evolution
  let resultado;
  try {
    resultado = await enviarTexto(grupoId, texto);
  } catch (e: any) {
    console.error('[whatsapp/send] falha Evolution:', e?.message);
    return NextResponse.json({ error: 'evolution_falhou' }, { status: 502 });
  }

  // 3. Persiste no banco (com flag de portal + autor)
  const sb = await supabaseAdmin();
  const msgId = resultado?.key?.id ?? `local-${Date.now()}`;
  const { error } = await sb.from('whatsapp_mensagens').upsert(
    {
      id: msgId,
      grupo_id: grupoId,
      remetente_numero: null, // saímos como a Lud. — o número é o da instância
      remetente_nome: 'Lud.',
      conteudo: texto,
      tipo: 'texto',
      enviado_via_portal: true,
      enviado_por_usuario: session.email.toLowerCase(),
      timestamp: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.error('[whatsapp/send] erro persistindo', error);
    // A mensagem já saiu no WhatsApp, então não falhamos o request.
  }

  return NextResponse.json({ ok: true, id: msgId });
}
