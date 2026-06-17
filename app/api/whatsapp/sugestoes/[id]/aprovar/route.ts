/**
 * Aprova uma sugestão da Claude e ENVIA pro grupo via Evolution.
 * Aceita `texto` no body pra enviar uma versão editada do rascunho.
 * Só permite se o usuário tem `pode_responder = true` no grupo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { enviarTexto } from '@/lib/whatsapp';
import { podeResponderNoGrupo, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { texto?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body opcional — sem edição, usa o texto original da sugestão
  }

  const sb = await supabaseAdmin();
  const { data: sug, error: errSug } = await sb
    .from('whatsapp_sugestoes')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (errSug) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
  if (!sug) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (sug.status !== 'pendente') {
    return NextResponse.json({ error: 'ja_resolvida' }, { status: 409 });
  }

  const pode = await podeResponderNoGrupo(session.email, sug.grupo_id);
  if (!pode) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const texto = (body.texto ?? sug.texto)?.trim();
  if (!texto) {
    return NextResponse.json({ error: 'texto_vazio' }, { status: 400 });
  }
  if (texto.length > 4000) {
    return NextResponse.json({ error: 'texto_muito_longo' }, { status: 400 });
  }

  // 1. Envia pra Evolution
  let resultado;
  try {
    resultado = await enviarTexto(sug.grupo_id, texto);
  } catch (e: any) {
    console.error('[whatsapp/sugestoes/aprovar] falha Evolution:', e?.message);
    return NextResponse.json({ error: 'evolution_falhou' }, { status: 502 });
  }

  const msgId = resultado?.key?.id ?? `local-${Date.now()}`;

  // 2. Persiste a mensagem enviada (auditoria igual ao /send)
  await sb.from('whatsapp_mensagens').upsert(
    {
      id: msgId,
      grupo_id: sug.grupo_id,
      remetente_numero: null,
      remetente_nome: 'Lud.',
      conteudo: texto,
      tipo: 'texto',
      enviado_via_portal: true,
      enviado_por_usuario: session.email.toLowerCase(),
      timestamp: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  // 3. Marca a sugestão como aprovada
  await sb
    .from('whatsapp_sugestoes')
    .update({
      status: 'aprovada',
      texto,
      enviada_mensagem_id: msgId,
      aprovada_por: session.email.toLowerCase(),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', params.id);

  return NextResponse.json({ ok: true, id: msgId });
}
