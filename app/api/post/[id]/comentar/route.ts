import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { comentarPost, invalidarCachesAposMudanca } from '@/lib/notion';
import { PREFIXO_NOTA_INTERNA } from '@/lib/historico-post';

export const runtime = 'nodejs';

/**
 * Comenta no post (fica no Notion). Só a equipe.
 * POST { comentario, interno? }
 *   interno=false → "Com o cliente": 💬 email + texto (aparece no histórico com o cliente)
 *   interno=true  → "Nota interna": 🔒 Nota interna · email + texto (cliente não vê no portal)
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const email = session.email.trim().toLowerCase();
  const daEquipe = env.auth.adminEmails.includes(email) || !!session.colaboradorId;
  if (!daEquipe) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { comentario?: string; interno?: boolean };
  const comentario = (b.comentario ?? '').trim();
  if (comentario.length < 2) return NextResponse.json({ error: 'Escreve algo no comentário.' }, { status: 400 });
  const texto = b.interno ? `${PREFIXO_NOTA_INTERNA} · ${email}\n\n${comentario}` : `💬 ${email}\n\n${comentario}`;
  try {
    await comentarPost(params.id, texto);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, nota: { id: String(Date.now()), quando: new Date().toISOString(), tipo: b.interno ? 'interna' : 'equipe', titulo: b.interno ? 'Nota interna' : 'Equipe comentou', autor: email, corpo: comentario } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Não consegui comentar.' }, { status: 500 });
  }
}
