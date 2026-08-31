import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import { listarTarefasDoPost } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin lê os rascunhos de aprovação salvos pelos usuários (cliente ou equipe)
 * pra qualquer tarefa relacionada a um post. Útil pra diagnosticar quando o
 * cliente diz "coloquei o que ajustar em cada card" mas o comentário no
 * Notion veio vazio — o rascunho pode ter ficado só no Supabase.
 *
 * GET /api/admin/rascunhos-post/[postId] → { rascunhos: [...] }
 */
export async function GET(
  _req: Request,
  { params }: { params: { postId: string } },
): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  if (!env.auth.adminEmails.includes(session.email.trim().toLowerCase())) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  }

  const postId = params.postId?.trim();
  if (!postId) return NextResponse.json({ error: 'postId obrigatório' }, { status: 400 });

  // Descobre todas as tarefas desse post (Notion) e busca rascunhos por
  // tarefa_id no Supabase.
  const tarefas = await listarTarefasDoPost(postId).catch(() => []);
  const tarefaIds = tarefas.map((t) => t.tarefaId);
  if (tarefaIds.length === 0) {
    return NextResponse.json({ rascunhos: [], tarefaIds: [] });
  }

  const sb = await supabaseAdmin();
  const { data, error } = await sb
    .from('rascunho_aprovacao')
    .select('tarefa_id, email, comentario_geral, marcacoes, atualizado_em')
    .in('tarefa_id', tarefaIds)
    .order('atualizado_em', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tarefasPorId = new Map(tarefas.map((t) => [t.tarefaId, t]));
  const rascunhos = (data ?? []).map((r: any) => {
    const t = tarefasPorId.get(r.tarefa_id);
    return {
      tarefaId: r.tarefa_id,
      tarefaTitulo: t?.titulo ?? '(?)',
      tarefaStatus: t?.status ?? null,
      tarefaAberta: t?.aberta ?? null,
      email: r.email,
      comentarioGeral: r.comentario_geral,
      marcacoes: r.marcacoes,
      atualizadoEm: r.atualizado_em,
    };
  });

  return NextResponse.json({
    postId,
    totalTarefas: tarefaIds.length,
    totalRascunhos: rascunhos.length,
    rascunhos,
  });
}
