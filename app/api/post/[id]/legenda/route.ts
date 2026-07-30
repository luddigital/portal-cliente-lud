import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  getColaboradorByEmail,
  getPostComDetalhes,
  atualizarLegendaDoPost,
  invalidarCachesAposMudanca,
} from '@/lib/notion';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { legenda?: string };
    const legenda = (body.legenda ?? '').trim();
    if (!legenda) {
      return NextResponse.json(
        { error: 'A legenda não pode ficar vazia.' },
        { status: 400 },
      );
    }

    const post = await getPostComDetalhes(params.id);
    if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 });

    // Permissão: cliente dono do projeto OU equipe Lud. (admin/colaborador)
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
    const ehClienteDono =
      !!post.projetoId && session.projetoIds.includes(post.projetoId);
    if (!ehAdmin && !ehColaborador && !ehClienteDono) {
      return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
    }

    await atualizarLegendaDoPost(params.id, legenda);
    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, legenda });
  } catch (err: any) {
    console.error('[legenda] erro:', err);
    let msg = err?.message ?? 'Erro inesperado';
    if (err?.body) try { msg = JSON.parse(err.body).message ?? msg; } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
