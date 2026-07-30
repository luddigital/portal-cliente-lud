import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  atualizarIdeiaDoPost,
  getColaboradorByEmail,
  getPostComDetalhes,
  invalidarCachesAposMudanca,
} from '@/lib/notion';

export const runtime = 'nodejs';

/**
 * POST /api/post/[id]/ideia { texto }
 * Atualiza a seção 'Ideia do Post' / 'Briefing do Post' do post.
 * Só equipe Lud. (admin OU colaborador) — cliente NÃO edita esse campo.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
    let ehColaborador = !!session.colaboradorId;
    if (!ehColaborador && !ehAdmin) {
      try {
        const c = await getColaboradorByEmail(session.email);
        ehColaborador = !!c;
      } catch {
        /* mantém false */
      }
    }
    if (!ehAdmin && !ehColaborador) {
      return NextResponse.json({ error: 'só equipe Lud. edita a ideia' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { texto?: string };
    const texto = (body.texto ?? '').trim();
    if (!texto) {
      return NextResponse.json({ error: 'texto não pode ficar vazio' }, { status: 400 });
    }

    const post = await getPostComDetalhes(params.id);
    if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 });

    await atualizarIdeiaDoPost(params.id, texto);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[ideia] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
