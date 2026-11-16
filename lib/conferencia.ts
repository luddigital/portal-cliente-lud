import { supabaseAdmin } from '@/lib/supabase';
import type { Conferencia } from '@/lib/conferenciaTipos';
export type { Conferencia } from '@/lib/conferenciaTipos';
export { minutosDoHorario } from '@/lib/conferenciaTipos';

/**
 * Resultado da tarefa agendada "Conferência de Posts" (roda às 9h, 10h e 12h),
 * gravado na tabela conferencia_posts. A página Conferir Postagem espelha isso.
 */


const semTraco = (id: string) => id.replace(/-/g, '').toLowerCase();

/** Última conferência de cada post (chave: id do post sem traços). Sem tabela ou com erro: vazio. */
export async function lerConferencias(postIds: string[]): Promise<Record<string, Conferencia>> {
  const out: Record<string, Conferencia> = {};
  if (!postIds.length) return out;
  try {
    const sb = await supabaseAdmin();
    const ids = [...new Set(postIds.flatMap((id) => [semTraco(id), id]))];
    const { data, error } = await sb
      .from('conferencia_posts')
      .select('post_id, data, resultado, link_instagram, whatsapp_status, detalhe, conferido_em')
      .in('post_id', ids)
      .order('conferido_em', { ascending: true });
    if (error) return out;
    for (const r of data ?? []) {
      out[semTraco(r.post_id)] = {
        postId: r.post_id,
        data: r.data,
        resultado: r.resultado,
        linkInstagram: r.link_instagram,
        whatsappStatus: r.whatsapp_status,
        detalhe: r.detalhe,
        conferidoEm: r.conferido_em,
      };
    }
  } catch {
    /* tabela ainda não existe: a página segue só com o Notion */
  }
  return out;
}

