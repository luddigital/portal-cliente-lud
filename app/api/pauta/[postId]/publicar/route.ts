import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import {
  atualizarIdeiaDoPost,
  getColaboradorByEmail,
  getPostComDetalhes,
  invalidarCachesAposMudanca,
} from '@/lib/notion';

export const runtime = 'nodejs';

/** POST /api/pauta/[postId]/publicar
 *  Lê o rascunho da pauta, escreve no Notion (Ideia do Post) e marca
 *  publicado_em na tabela. Só depois disso o cliente vê o texto novo. */
export async function POST(_req: Request, { params }: { params: { postId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const email = session.email.trim().toLowerCase();
  const ehAdmin = env.auth.adminEmails.includes(email);
  let ehColaborador = !!session.colaboradorId;
  if (!ehColaborador && !ehAdmin) {
    try {
      const c = await getColaboradorByEmail(session.email);
      ehColaborador = !!c;
    } catch { /* mantém false */ }
  }
  if (!ehAdmin && !ehColaborador) {
    return NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 });
  }

  const post = await getPostComDetalhes(params.postId);
  if (!post) return NextResponse.json({ error: 'post não encontrado' }, { status: 404 });

  const sb = await supabaseAdmin();
  const { data: rascunho, error: errRead } = await sb
    .from('rascunho_pauta')
    .select('ideia_texto')
    .eq('post_id', params.postId)
    .maybeSingle();
  if (errRead) return NextResponse.json({ error: errRead.message }, { status: 500 });
  const texto = (rascunho?.ideia_texto ?? '').trim();
  if (!texto) {
    return NextResponse.json({ error: 'rascunho vazio — nada pra publicar' }, { status: 400 });
  }

  try {
    await atualizarIdeiaDoPost(params.postId, texto);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'falha ao escrever no Notion' }, { status: 500 });
  }

  const agora = new Date().toISOString();
  const { error: errMark } = await sb
    .from('rascunho_pauta')
    .update({ publicado_em: agora, publicado_por: email })
    .eq('post_id', params.postId);
  if (errMark) {
    // Notion foi escrito — não deixa o erro de marcação bloquear
    console.error('[publicar] falha ao marcar publicado_em:', errMark.message);
  }

  invalidarCachesAposMudanca();
  return NextResponse.json({ ok: true, publicado_em: agora });
}
