import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { salvarNotaEntrega } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Salva a nota interna da entrega de um projeto (só a equipe vê).
 * POST { projetoId, texto } → { ok, nota }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const email = session.email.trim().toLowerCase();
  if (!env.auth.adminEmails.includes(email)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const projetoId = String(body?.projetoId ?? '').trim();
  const texto = String(body?.texto ?? '').slice(0, 4000);
  if (!projetoId) return NextResponse.json({ error: 'projeto faltando' }, { status: 400 });
  try {
    const nota = await salvarNotaEntrega({
      entregaId: params.id,
      projetoId,
      texto,
      por: email === 'oi@lud.digital' ? 'Luiza' : email,
    });
    return NextResponse.json({ ok: true, nota });
  } catch (e) {
    console.error('[entrega/nota]', e);
    return NextResponse.json({ error: 'não consegui salvar a nota' }, { status: 500 });
  }
}
