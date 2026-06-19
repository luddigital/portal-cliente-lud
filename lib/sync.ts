/**
 * Sync Notion → Supabase pra postagens e tarefas.
 *
 * Estratégia:
 *  - Source of truth: Notion (equipe segue trabalhando lá normal)
 *  - Cache rápido: Supabase (portal lê daqui pra ser ~10× mais rápido)
 *  - One-way: nunca escrevemos no Notion via sync (escritas continuam
 *    indo pelas funções existentes do lib/notion.ts).
 *  - Upsert idempotente: rodar 2× não duplica nada (PK = Notion page id).
 *
 * Risk-zero: este módulo SÓ escreve em Supabase. Não afeta nenhuma
 * leitura existente. Pode rodar a qualquer hora sem efeitos colaterais.
 */
import { Client } from '@notionhq/client';
import { env } from './env';
import { supabaseAdmin } from './supabase';

const notion = new Client({ auth: env.notion.token });

function txt(rich: any[] | undefined): string {
  if (!Array.isArray(rich)) return '';
  return rich.map((r: any) => r.plain_text ?? '').join('').trim();
}

function getProp(page: any, name: string): any {
  return page.properties?.[name];
}

export type SyncStats = {
  escopo: string;
  itensLidos: number;
  itensEscritos: number;
  duracaoMs: number;
  erro?: string;
};

/** Sincroniza TODAS as postagens de uma lista de projetos. */
export async function sincronizarPostagens(
  projetoIds: string[],
): Promise<SyncStats> {
  const inicio = Date.now();
  const sb = await supabaseAdmin();
  const escopo = `postagens(${projetoIds.length})`;

  // Log inicial
  const { data: logRow } = await sb
    .from('sync_logs')
    .insert({ escopo, iniciado_em: new Date().toISOString() })
    .select('id')
    .single();
  const logId = logRow?.id;

  let lidos = 0;
  let escritos = 0;

  try {
    if (projetoIds.length === 0) {
      throw new Error('Nenhum projetoId — sem o que sincronizar');
    }

    // Query Notion: posts dos projetos listados, sem filtro de status
    // (sincroniza tudo, mesmo Postado/Cancelado, pra ter histórico).
    let cursor: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: env.notion.postagensDbId,
        page_size: 100,
        start_cursor: cursor,
        filter: {
          or: projetoIds.map((id) => ({
            property: env.notion.postProps.projeto,
            relation: { contains: id },
          })),
        },
      });

      lidos += res.results.length;

      // Mapeia pra rows do Supabase
      const rows = (res.results as any[]).map((page) => {
        const titleProp = Object.values(page.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        const projetoRel =
          getProp(page, env.notion.postProps.projeto)?.relation ?? [];
        const statusGeralProp = getProp(page, 'Status Geral');
        const statusGeral =
          statusGeralProp?.formula?.type === 'string'
            ? (statusGeralProp.formula.string ?? null)
            : null;
        const driveProp = getProp(page, env.notion.postProps.driveLink);
        const driveLinks: { name: string; url: string }[] = [];
        for (const f of driveProp?.files ?? []) {
          const url = f.type === 'external' ? f.external?.url : f.file?.url;
          if (url) driveLinks.push({ name: f.name ?? 'arquivo', url });
        }
        const tarefasRel =
          getProp(page, env.notion.postProps.tarefas)?.relation ?? [];
        const iconRaw = page.icon;
        let icon: string | null = null;
        if (iconRaw?.type === 'emoji') icon = iconRaw.emoji;
        else if (iconRaw?.type === 'external') icon = iconRaw.external?.url;
        else if (iconRaw?.type === 'file') icon = iconRaw.file?.url;

        return {
          id: page.id,
          titulo: txt(titleProp?.title) || 'Post sem título',
          projeto_id: projetoRel[0]?.id ?? null,
          data_postagem:
            getProp(page, env.notion.postProps.data)?.date?.start ?? null,
          status:
            getProp(page, env.notion.postProps.status)?.status?.name ?? null,
          status_geral: statusGeral,
          demanda:
            getProp(page, env.notion.postProps.demanda)?.select?.name ?? null,
          formato_nome: null, // resolvido sob demanda (queries de formato são extras)
          formato_tipo: null,
          ideia_do_post: null, // body deep parsing deixamos pra leitura on-demand
          legenda: null,
          body_completo: null,
          icon,
          drive_links: driveLinks,
          tarefa_ids: tarefasRel.map((r: any) => r.id),
          materiais_necessarios: null,
          informacoes_necessarias: null,
          aprovacao_colaborativa: false, // resolvido na leitura
          notion_last_edited: page.last_edited_time,
          synced_at: new Date().toISOString(),
        };
      });

      // Upsert em batch
      if (rows.length > 0) {
        const { error } = await sb
          .from('postagens_sync')
          .upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(`Supabase upsert: ${error.message}`);
        escritos += rows.length;
      }

      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);

    // Fecha log com sucesso
    if (logId) {
      await sb
        .from('sync_logs')
        .update({
          terminado_em: new Date().toISOString(),
          itens_lidos: lidos,
          itens_escritos: escritos,
          ok: true,
        })
        .eq('id', logId);
    }

    return {
      escopo,
      itensLidos: lidos,
      itensEscritos: escritos,
      duracaoMs: Date.now() - inicio,
    };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (logId) {
      await sb
        .from('sync_logs')
        .update({
          terminado_em: new Date().toISOString(),
          itens_lidos: lidos,
          itens_escritos: escritos,
          erro: msg,
          ok: false,
        })
        .eq('id', logId);
    }
    return {
      escopo,
      itensLidos: lidos,
      itensEscritos: escritos,
      duracaoMs: Date.now() - inicio,
      erro: msg,
    };
  }
}

/** Sincroniza TAREFAS dos posts já sincronizados (lê post_ids do Supabase). */
export async function sincronizarTarefasDosProjetos(
  projetoIds: string[],
): Promise<SyncStats> {
  const inicio = Date.now();
  const sb = await supabaseAdmin();
  const escopo = `tarefas(${projetoIds.length})`;

  const { data: logRow } = await sb
    .from('sync_logs')
    .insert({ escopo, iniciado_em: new Date().toISOString() })
    .select('id')
    .single();
  const logId = logRow?.id;

  let lidos = 0;
  let escritos = 0;

  try {
    if (projetoIds.length === 0) {
      throw new Error('Nenhum projetoId — sem o que sincronizar');
    }

    let cursor: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: env.notion.tarefasDbId,
        page_size: 100,
        start_cursor: cursor,
        filter: {
          or: projetoIds.map((id) => ({
            property: 'Projeto',
            relation: { contains: id },
          })),
        },
      });

      lidos += res.results.length;

      const rows = (res.results as any[]).map((t) => {
        const titleProp = Object.values(t.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        const postRel =
          getProp(t, env.notion.taskProps.post)?.relation ?? [];
        const projetoRel = getProp(t, 'Projeto')?.relation ?? [];
        const pessoaArr = getProp(t, 'Pessoa')?.people ?? [];
        const prontoProp = getProp(t, env.notion.taskProps.pronto);
        const ehPronto =
          prontoProp?.formula?.type === 'boolean'
            ? !!prontoProp.formula.boolean
            : false;
        const tipoProp = getProp(t, 'tipo');
        const tipo =
          tipoProp?.formula?.type === 'string'
            ? tipoProp.formula.string ?? null
            : null;

        return {
          id: t.id,
          titulo: txt(titleProp?.title) || 'Tarefa',
          status:
            getProp(t, env.notion.taskProps.status)?.status?.name ?? null,
          post_id: postRel[0]?.id ?? null,
          projeto_id: projetoRel[0]?.id ?? null,
          pessoa_user_id: pessoaArr[0]?.id ?? null,
          pessoa_nome: pessoaArr[0]?.name ?? null,
          prazo: getProp(t, 'Data Entrega')?.date?.start ?? null,
          data_inicial: getProp(t, 'Data Inicial')?.date?.start ?? null,
          pronto: ehPronto,
          finalizada_em:
            getProp(t, env.notion.taskProps.finalizada)?.date?.start ?? null,
          ordem: getProp(t, 'Ordem')?.select?.name ?? null,
          tipo,
          notion_last_edited: t.last_edited_time,
          synced_at: new Date().toISOString(),
        };
      });

      if (rows.length > 0) {
        const { error } = await sb
          .from('tarefas_sync')
          .upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(`Supabase upsert: ${error.message}`);
        escritos += rows.length;
      }

      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);

    if (logId) {
      await sb
        .from('sync_logs')
        .update({
          terminado_em: new Date().toISOString(),
          itens_lidos: lidos,
          itens_escritos: escritos,
          ok: true,
        })
        .eq('id', logId);
    }

    return {
      escopo,
      itensLidos: lidos,
      itensEscritos: escritos,
      duracaoMs: Date.now() - inicio,
    };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (logId) {
      await sb
        .from('sync_logs')
        .update({
          terminado_em: new Date().toISOString(),
          itens_lidos: lidos,
          itens_escritos: escritos,
          erro: msg,
          ok: false,
        })
        .eq('id', logId);
    }
    return {
      escopo,
      itensLidos: lidos,
      itensEscritos: escritos,
      duracaoMs: Date.now() - inicio,
      erro: msg,
    };
  }
}

/** Tudo de uma vez: postagens + tarefas dos projetos passados. */
export async function sincronizarProjetos(
  projetoIds: string[],
): Promise<{ postagens: SyncStats; tarefas: SyncStats }> {
  // Posts primeiro (tarefas referenciam post_id), depois tarefas
  const postagens = await sincronizarPostagens(projetoIds);
  const tarefas = await sincronizarTarefasDosProjetos(projetoIds);
  return { postagens, tarefas };
}

/** Stats pra mostrar no admin: contagens + último sync. */
export async function statusSync(): Promise<{
  postagens: number;
  tarefas: number;
  ultimaSync: {
    iniciadoEm: string | null;
    terminadoEm: string | null;
    escopo: string | null;
    itensLidos: number;
    itensEscritos: number;
    ok: boolean | null;
    erro: string | null;
  } | null;
}> {
  const sb = await supabaseAdmin();
  const [postsCount, tarefasCount, ultima] = await Promise.all([
    sb.from('postagens_sync').select('id', { count: 'exact', head: true }),
    sb.from('tarefas_sync').select('id', { count: 'exact', head: true }),
    sb
      .from('sync_logs')
      .select('*')
      .order('iniciado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    postagens: postsCount.count ?? 0,
    tarefas: tarefasCount.count ?? 0,
    ultimaSync: ultima.data
      ? {
          iniciadoEm: ultima.data.iniciado_em,
          terminadoEm: ultima.data.terminado_em,
          escopo: ultima.data.escopo,
          itensLidos: ultima.data.itens_lidos,
          itensEscritos: ultima.data.itens_escritos,
          ok: ultima.data.ok,
          erro: ultima.data.erro,
        }
      : null,
  };
}
