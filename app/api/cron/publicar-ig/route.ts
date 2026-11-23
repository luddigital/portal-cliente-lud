import { NextResponse } from 'next/server';
import { atualizarStatusPost, getPostComDetalhes, invalidarCachesAposMudanca, listAllProjetos } from '@/lib/notion';
import { contaIgDoProjeto } from '@/lib/instagram';
import { publicarNoFB } from '@/lib/facebookPublish';
import { lerConfigProgramacao } from '@/lib/supabase';
import { resolverMidiaDoPost } from '@/lib/postMedia';
import { publicarNoIG } from '@/lib/instagramPublish';
import {
  listarIGVencidos,
  marcarIGResultado,
  reivindicarIG,
} from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron de publicação no Instagram. Roda de X em X minutos (vercel.json), acha os
 * posts na fila cuja hora chegou e publica. A Vercel injeta o header
 * `Authorization: Bearer <CRON_SECRET>` nas chamadas agendadas.
 *
 * Publica poucos por execução — Reels tem processamento de vídeo que pode ser
 * lento; o resto pega na próxima rodada.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const agora = new Date().toISOString();
  const vencidos = await listarIGVencidos(agora, 5);
  const relatorio: any[] = [];

  for (const item of vencidos) {
    // Reivindica atomicamente (evita publicar 2x se crons se sobrepõem).
    const ganhou = await reivindicarIG(item.postId);
    if (!ganhou) continue;

    // Fila antiga sem conta: tenta achar agora pelo @ do projeto.
    if (!item.conta) {
      const post = await getPostComDetalhes(item.postId).catch(() => null);
      const nome = post?.projetoNome ?? (await listAllProjetos().catch(() => [])).find((p) => post?.projetoId && p.id.replace(/-/g, '') === post.projetoId.replace(/-/g, ''))?.nome;
      item.conta = (await contaIgDoProjeto(post?.projetoId, nome)) ?? '';
    }
    if (!item.conta) {
      await marcarIGResultado(item.postId, { ok: false, erro: 'projeto sem conta de Instagram mapeada (IG_ACCOUNTS)' });
      relatorio.push({ postId: item.postId, ok: false, erro: 'sem conta IG' });
      continue;
    }

    try {
      const midia = await resolverMidiaDoPost(item.postId);
      if ('erro' in midia) {
        await marcarIGResultado(item.postId, { ok: false, erro: midia.erro });
        relatorio.push({ postId: item.postId, ok: false, erro: midia.erro });
        continue;
      }
      // Legenda editada na programação tem prioridade sobre a do Notion.
      const caption = item.legenda?.trim() || midia.legenda;
      const r = await publicarNoIG({
        igUserId: item.conta,
        formato: midia.formato,
        itens: midia.itens,
        caption,
      });
      // Facebook: se a programação pediu, publica na Página ligada ao mesmo Instagram.
      let fb: any = null;
      const cfg = await lerConfigProgramacao(item.postId).catch(() => null);
      if (cfg?.plataformas?.includes('facebook')) {
        fb = await publicarNoFB({ igUserId: item.conta, formato: midia.formato, itens: midia.itens, caption });
        console.log('[publicar-fb]', item.postId, JSON.stringify(fb));
      }
      if (r.ok) {
        await marcarIGResultado(item.postId, { ok: true, mediaId: r.mediaId, permalink: r.permalink });
        // Fecha o ciclo no Notion.
        try {
          await atualizarStatusPost(item.postId, 'Postado');
        } catch {
          /* não falha a publicação se o Notion recusar */
        }
        relatorio.push({ postId: item.postId, ok: true, permalink: r.permalink, facebook: fb });
      } else {
        await marcarIGResultado(item.postId, { ok: false, erro: `${r.etapa}: ${r.error}` });
        relatorio.push({ postId: item.postId, ok: false, erro: r.error });
      }
    } catch (e: any) {
      await marcarIGResultado(item.postId, { ok: false, erro: e?.message ?? 'erro inesperado' });
      relatorio.push({ postId: item.postId, ok: false, erro: e?.message });
    }
  }

  if (relatorio.some((x) => x.ok)) invalidarCachesAposMudanca();
  return NextResponse.json({ ok: true, processados: relatorio.length, relatorio });
}
