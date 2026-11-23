import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { comentarPost, getTarefaComPost, invalidarDadosDoDia, trocarTextoDeGravacao } from '@/lib/notion';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * A cliente editou o texto de gravação na tela de "Materiais para Produção".
 * Troca o texto no post do Notion e deixa um comentário pra equipe ver o que mudou.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sua sessão expirou. Atualiza a página.' }, { status: 401 });
  const { texto } = (await req.json().catch(() => ({}))) as { texto?: string };
  const novo = (texto ?? '').trim();
  if (!novo) return NextResponse.json({ error: 'O texto está vazio.' }, { status: 400 });
  if (novo.length > 10_000) return NextResponse.json({ error: 'Texto grande demais.' }, { status: 400 });

  const data = await getTarefaComPost(params.id);
  if (!data) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 });
  const t = data.tarefa;
  const ehAdmin = env.auth.adminEmails.includes(session.email.trim().toLowerCase());
  if (!ehAdmin && (!t.projetoId || !session.projetoIds.includes(t.projetoId))) {
    return NextResponse.json({ error: 'Sem permissão pra essa tarefa.' }, { status: 403 });
  }

  try {
    const antigo = await trocarTextoDeGravacao(t.postId, novo);
    const partes = [`✏️ O cliente editou o texto de gravação (${t.tarefaTitulo}).`, '', 'Texto novo:', novo];
    if (antigo === null) partes.push('', '(Não achei o bloco do texto no post: atualizar à mão.)');
    else if (antigo) partes.push('', 'Texto antigo:', antigo);
    await comentarPost(t.postId, partes.join('\n').slice(0, 1900));
  } catch (err: any) {
    console.error('[texto-gravacao] erro:', err);
    return NextResponse.json({ error: 'Não deu pra salvar. Tenta de novo.' }, { status: 500 });
  }
  invalidarDadosDoDia();
  revalidateTag(`previa:${t.postId.replace(/-/g, '')}`);
  return NextResponse.json({ ok: true });
}
