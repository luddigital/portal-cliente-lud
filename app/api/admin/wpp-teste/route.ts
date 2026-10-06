import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  enviarMensagemTexto,
  normalizarTelefone,
  zapiConfigured,
} from '@/lib/zapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint SÓ pra teste manual do WhatsApp — admin manda uma mensagem
 * pra um destino arbitrário (número ou group ID) sem passar pelo fluxo
 * de aprovação. Útil pra validar formatação antes de mandar pra cliente real.
 *
 * POST { destino: string, mensagem: string, modo: 'telefone' | 'grupo' }
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  if (!zapiConfigured()) {
    return NextResponse.json(
      { error: 'Z-API não configurado.' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    destino?: string;
    mensagem?: string;
    modo?: 'telefone' | 'grupo';
  };
  const destinoRaw = (body.destino ?? '').trim();
  const mensagem = (body.mensagem ?? '').trim();
  const modo = body.modo === 'grupo' ? 'grupo' : 'telefone';

  if (!destinoRaw) {
    return NextResponse.json({ error: 'destino obrigatório' }, { status: 400 });
  }
  if (!mensagem) {
    return NextResponse.json({ error: 'mensagem obrigatória' }, { status: 400 });
  }

  // Normaliza conforme o modo escolhido
  let destino: string;
  if (modo === 'grupo') {
    // Group ID já vem no formato "120363XXXX@g.us". Aceita só o número
    // interno também — adiciona @g.us se faltar.
    destino = destinoRaw.includes('@g.us') ? destinoRaw : `${destinoRaw}@g.us`;
  } else {
    const tel = normalizarTelefone(destinoRaw);
    if (!tel) {
      return NextResponse.json(
        { error: 'Telefone inválido. Use DDD + número.' },
        { status: 400 },
      );
    }
    destino = tel;
  }

  const resultado = await enviarMensagemTexto(destino, mensagem);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: `Falha ao enviar: ${resultado.erro}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    destino,
    modo,
    messageId: resultado.messageId,
  });
}
