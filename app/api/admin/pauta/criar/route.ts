import { fetchDoNotion } from '@/lib/notionFetch';
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  atualizarDataDoPost,
  atualizarIdeiaDoPost,
  atualizarRelationDoPost,
  atualizarSelectDoPost,
  criarPostVazio,
  invalidarCachesAposMudanca,
  tipoDaPropDoPost,
} from '@/lib/notion';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const notionRaw = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });

/** Relation ou select, detectado pelo tipo da prop no Notion (igual a /api/pauta/[postId]/props). */
async function salvarProp(postId: string, propriedade: string, valor: string | null) {
  const tipo = await tipoDaPropDoPost(propriedade);
  if (tipo === 'relation') await atualizarRelationDoPost(postId, propriedade, valor ? [valor] : []);
  else if (tipo === 'select' || tipo === 'status') await atualizarSelectDoPost(postId, propriedade, valor);
}

/**
 * Nova pauta (criar post · passo 1). Só admin.
 * POST { projetoId, postId?, data, titulo, formatoId?, funilId?, objetivoId?, demanda?, ideia?, referencia? }
 * Com postId atualiza o "Novo Post" que a automação já criou naquele dia; sem postId cria um post novo.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  const email = session.email.trim().toLowerCase();
  if (!env.auth.adminEmails.includes(email)) return NextResponse.json({ error: 'só equipe Lud.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as {
    projetoId?: string;
    postId?: string | null;
    data?: string;
    titulo?: string;
    formatoId?: string | null;
    funilId?: string | null;
    objetivoId?: string | null;
    demanda?: string | null;
    ideia?: string;
    referencia?: string;
  };
  const titulo = (b.titulo ?? '').trim();
  if (!b.projetoId) return NextResponse.json({ error: 'falta o projeto' }, { status: 400 });
  if (!b.data || !/^\d{4}-\d{2}-\d{2}$/.test(b.data)) return NextResponse.json({ error: 'escolha o dia do post' }, { status: 400 });
  if (!titulo) return NextResponse.json({ error: 'escreva o tema' }, { status: 400 });

  try {
    const postId = b.postId || (await criarPostVazio(b.projetoId, b.data)).id;
    if (b.postId) await atualizarDataDoPost(postId, b.data);

    // Título (a prop "title" do banco de posts, qualquer que seja o nome dela).
    const page: any = await notionRaw.pages.retrieve({ page_id: postId });
    const propTitulo = Object.entries(page.properties ?? {}).find(([, v]: any) => v?.type === 'title')?.[0];
    if (propTitulo) {
      await notionRaw.pages.update({
        page_id: postId,
        properties: { [propTitulo]: { title: [{ type: 'text', text: { content: titulo } }] } } as any,
      });
    }

    if ('formatoId' in b) await salvarProp(postId, 'Formato', b.formatoId ?? null);
    if ('funilId' in b) await salvarProp(postId, 'Funil', b.funilId ?? null);
    if ('objetivoId' in b) await salvarProp(postId, 'Objetivo', b.objetivoId ?? null);
    if ('demanda' in b) await salvarProp(postId, env.notion.postProps.demanda, b.demanda ?? null);
    if ((b.ideia ?? '').trim()) await atualizarIdeiaDoPost(postId, b.ideia!.trim());

    // Referências ficam no rascunho da pauta (mesmo lugar da tela de construção).
    if ((b.referencia ?? '').trim()) {
      try {
        const sb = await supabaseAdmin();
        await sb.from('rascunho_pauta').upsert(
          { post_id: postId, referencias_texto: b.referencia!.trim(), atualizado_em: new Date().toISOString(), atualizado_por: email },
          { onConflict: 'post_id' },
        );
      } catch (e: any) {
        console.warn('[pauta/criar] referência:', e?.message);
      }
    }

    invalidarCachesAposMudanca();
    return NextResponse.json({ ok: true, postId, criado: !b.postId });
  } catch (err: any) {
    console.error('[pauta/criar]', err);
    return NextResponse.json({ error: err?.message ?? 'erro ao salvar' }, { status: 500 });
  }
}
