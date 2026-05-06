import { Client } from '@notionhq/client';
import { env } from './env';

const notion = new Client({ auth: env.notion.token });

export type DemandaTipo = 'Informação' | 'Produção Material' | 'Informação & Produção de Material' | 'Duplicado' | 'Nada.';

export type Post = {
  id: string;
  titulo: string;
  data: string | null;
  demanda: DemandaTipo | null;
  status: string | null;
  projetoId: string | null;
  projetoNome: string | null;
};

export type ProjetoCliente = {
  id: string;
  nome: string;
  email: string;
};

export type TarefaCliente = {
  id: string;
  titulo: string;
  pronto: boolean;
};

export type RelacaoItem = { id: string; name: string; icon: string | null };

export type TarefaPendente = {
  tarefaId: string;
  tarefaTitulo: string;
  tarefaPrazo: string | null;
  postId: string;
  postTitulo: string;
  postData: string | null;
  projetoId: string;
  projetoNome: string;
  formato: RelacaoItem[];
  funil: RelacaoItem[];
  objetivo: RelacaoItem[];
  formatoTipo: 'post' | 'reels' | 'story' | 'desconhecido';
  formatoNome: string | null;
};

export const TAREFAS_DO_CLIENTE = [
  'Envio de Conteúdos Prévios',
  'Materiais para Produção',
] as const;

export type CategoriaTarefa = 'previas' | 'pauta' | 'post' | 'materiais' | 'stories';

type TituloMatcher = { type: 'equals' | 'contains'; value: string };

export const TAREFAS_CATEGORIAS: Record<CategoriaTarefa, readonly TituloMatcher[]> = {
  previas: [
    { type: 'equals', value: 'Envio de Conteúdos Prévios' },
    { type: 'contains', value: 'Envio de Informações' },
  ],
  pauta: [{ type: 'equals', value: 'Aprovação | Pauta' }],
  post: [{ type: 'equals', value: 'Aprovação | Post' }],
  materiais: [{ type: 'equals', value: 'Materiais para Produção' }],
  stories: [{ type: 'contains', value: 'Direcionamento de Stories' }],
};

const TODOS_MATCHERS_CLIENTE: TituloMatcher[] = Object.values(TAREFAS_CATEGORIAS).flat();

export const CATEGORIA_LABEL: Record<CategoriaTarefa, { label: string; tituloLongo: string; descSing: string; descPlur: string }> = {
  pauta: {
    label: 'Aprovar pauta',
    tituloLongo: 'Aprovação de Pauta',
    descSing: 'pauta aguardando aprovação.',
    descPlur: 'pautas aguardando aprovação.',
  },
  post: {
    label: 'Aprovar posts',
    tituloLongo: 'Posts para Aprovação',
    descSing: 'post aguardando aprovação.',
    descPlur: 'posts aguardando aprovação.',
  },
  materiais: {
    label: 'Enviar materiais',
    tituloLongo: 'Materiais para Produção',
    descSing: 'post aguardando seus materiais.',
    descPlur: 'posts aguardando seus materiais.',
  },
  previas: {
    label: 'Enviar informações',
    tituloLongo: 'Conteúdos Prévios',
    descSing: 'post aguardando suas informações.',
    descPlur: 'posts aguardando suas informações.',
  },
  stories: {
    label: 'Direcionar stories',
    tituloLongo: 'Direcionamento de Stories',
    descSing: 'story aguardando seu direcionamento.',
    descPlur: 'stories aguardando seu direcionamento.',
  },
};

export type PostsAgrupadosPorCategoria = Record<CategoriaTarefa, TarefaPendente[]>;

const STATUS_TAREFA_FECHADOS = ['Concluído', 'Cancelado', 'Reprovado', 'Excluída'];

function txt(rt: any[] | undefined): string {
  if (!rt) return '';
  return rt.map((r) => r.plain_text).join('').trim();
}

function getProp(page: any, name: string): any {
  return page.properties?.[name];
}

function pageIcon(page: any): string | null {
  if (!page?.icon) return null;
  if (page.icon.type === 'emoji') return page.icon.emoji;
  if (page.icon.type === 'custom_emoji') return page.icon.custom_emoji?.url ?? null;
  if (page.icon.type === 'external') return page.icon.external?.url ?? null;
  if (page.icon.type === 'file') return page.icon.file?.url ?? null;
  return null;
}

async function resolveRelacoes(ids: string[]): Promise<RelacaoItem[]> {
  if (!ids.length) return [];
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const page = (await notion.pages.retrieve({ page_id: id })) as any;
        if (page.archived) return null;
        const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
        const name = txt(titleProp?.title) || '?';
        return { id, name, icon: pageIcon(page) };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is RelacaoItem => r !== null);
}

export async function getNomeDoCliente(email: string): Promise<string | null> {
  const emailNorm = email.trim().toLowerCase();
  const res = await notion.databases.query({
    database_id: env.notion.clientesDbId,
    page_size: 1,
    filter: {
      property: env.notion.clienteProps.email,
      email: { equals: emailNorm },
    },
  });
  const cliente = res.results[0] as any;
  if (!cliente) return null;
  const titleProp = Object.values(cliente.properties).find((p: any) => p.type === 'title') as any;
  const nome = txt(titleProp?.title);
  return nome || null;
}

export async function findProjetosByEmail(email: string): Promise<ProjetoCliente[]> {
  const emailNorm = email.trim().toLowerCase();
  const projetoIds = new Set<string>();
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: env.notion.clientesDbId,
      start_cursor: cursor,
      filter: {
        property: env.notion.clienteProps.email,
        email: { equals: emailNorm },
      },
    });
    for (const cliente of res.results as any[]) {
      const projetosRel = getProp(cliente, env.notion.clienteProps.projetos)?.relation ?? [];
      for (const r of projetosRel) projetoIds.add(r.id);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const projetos: ProjetoCliente[] = [];
  for (const id of projetoIds) {
    try {
      const page = (await notion.pages.retrieve({ page_id: id })) as any;
      if (page.archived) continue;
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      projetos.push({
        id: page.id,
        nome: txt(titleProp?.title) || 'Projeto sem nome',
        email: emailNorm,
      });
    } catch {
      // projeto arquivado ou sem acesso — ignora
    }
  }

  const allowlist = env.test.projetoNomesAllowlist;
  if (allowlist.length > 0) {
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const needles = allowlist.map(norm);
    const filtrados = projetos.filter((p) => {
      const nomeNorm = norm(p.nome);
      return needles.some((n) => nomeNorm.includes(n));
    });
    console.log(
      `[test-mode] PORTAL_TEST_PROJETO_NOMES ativo (${allowlist.join(', ')}) — ${projetos.length} → ${filtrados.length} projetos`,
    );
    return filtrados;
  }

  return projetos;
}

const DEMANDAS_ATIVAS: DemandaTipo[] = ['Informação', 'Produção Material', 'Informação & Produção de Material'];
const STATUS_EXCLUIR = ['Postado', 'Cancelado', 'Excluída'];

export async function listTarefasPendentesDoCliente(projetoIds: string[]): Promise<TarefaPendente[]> {
  if (projetoIds.length === 0) return [];

  const projetoNomes = new Map<string, string>();
  for (const id of projetoIds) {
    try {
      const page = (await notion.pages.retrieve({ page_id: id })) as any;
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      projetoNomes.set(id, txt(titleProp?.title) || 'Projeto');
    } catch {
      projetoNomes.set(id, 'Projeto');
    }
  }

  const tarefasFiltradas: any[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      start_cursor: cursor,
      filter: {
        and: [
          {
            or: TODOS_MATCHERS_CLIENTE.map((m) => ({
              property: 'Tarefa',
              title: { [m.type]: m.value } as any,
            })),
          },
          {
            or: projetoIds.map((id) => ({
              property: 'Projeto',
              relation: { contains: id },
            })),
          },
          ...STATUS_TAREFA_FECHADOS.map((s) => ({
            property: env.notion.taskProps.status,
            status: { does_not_equal: s },
          })),
        ],
      },
    });

    for (const tarefa of res.results as any[]) {
      const prontoProp = getProp(tarefa, env.notion.taskProps.pronto);
      const isPronto =
        prontoProp?.formula?.type === 'boolean' && prontoProp.formula.boolean === true;
      if (!isPronto) continue;

      const postRel = getProp(tarefa, env.notion.taskProps.post)?.relation ?? [];
      const postId = postRel[0]?.id as string | undefined;
      if (!postId) continue;

      tarefasFiltradas.push({ tarefa, postId });
    }

    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Paraleliza os retrieves dos posts
  const out: TarefaPendente[] = [];
  const enriquecidas = await Promise.all(
    tarefasFiltradas.map(async ({ tarefa, postId }) => {
      try {
        const post = (await notion.pages.retrieve({ page_id: postId })) as any;
        if (post.archived) return null;

        const projetoRel = getProp(post, env.notion.postProps.projeto)?.relation ?? [];
        const projetoId = projetoRel[0]?.id as string | undefined;
        if (!projetoId || !projetoIds.includes(projetoId)) return null;

        const postStatus = getProp(post, env.notion.postProps.status)?.status?.name ?? null;
        if (postStatus && STATUS_EXCLUIR.includes(postStatus)) return null;

        const postTitleProp = Object.values(post.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        const tarefaTitleProp = Object.values(tarefa.properties).find(
          (p: any) => p.type === 'title',
        ) as any;

        const formatoIds = (getProp(post, 'Formato')?.relation ?? []).map((r: any) => r.id);
        const formatoInfo = await resolverFormato(formatoIds);

        return {
          tarefaId: tarefa.id,
          tarefaTitulo: txt(tarefaTitleProp?.title) || '',
          tarefaPrazo:
            getProp(tarefa, 'Data Entrega')?.date?.start ??
            getProp(tarefa, 'Data Inicial')?.date?.start ??
            null,
          postId,
          postTitulo: txt(postTitleProp?.title) || 'Post sem título',
          postData: getProp(post, env.notion.postProps.data)?.date?.start ?? null,
          projetoId,
          projetoNome: projetoNomes.get(projetoId) ?? 'Projeto',
          formato: [],
          funil: [],
          objetivo: [],
          formatoTipo: formatoInfo?.tipo ?? 'desconhecido',
          formatoNome: formatoInfo?.name ?? null,
        } as TarefaPendente;
      } catch {
        return null;
      }
    }),
  );
  for (const t of enriquecidas) if (t) out.push(t);

  // Ordenar por data do post
  return out.sort((a, b) => {
    const da = a.postData ?? '9999-12-31';
    const db = b.postData ?? '9999-12-31';
    return da.localeCompare(db);
  });
}

export function categoriaDaTarefa(titulo: string): CategoriaTarefa | null {
  for (const cat of Object.keys(TAREFAS_CATEGORIAS) as CategoriaTarefa[]) {
    for (const m of TAREFAS_CATEGORIAS[cat]) {
      if (m.type === 'equals' ? titulo === m.value : titulo.includes(m.value)) return cat;
    }
  }
  return null;
}

export async function listTarefasPendentesPorCategoria(
  projetoIds: string[],
): Promise<PostsAgrupadosPorCategoria> {
  const todas = await listTarefasPendentesDoCliente(projetoIds);
  const out: PostsAgrupadosPorCategoria = {
    previas: [],
    pauta: [],
    post: [],
    materiais: [],
    stories: [],
  };
  for (const t of todas) {
    const cat = categoriaDaTarefa(t.tarefaTitulo);
    if (cat) out[cat].push(t);
  }
  return out;
}

export type EtapaPost =
  | 'publicado'
  | 'producao'
  | 'aprovacao'
  | 'alteracao'
  | 'aguardando'
  | 'rascunho';

export type PostCalendario = {
  id: string;
  titulo: string;
  data: string;
  status: string | null;
  formato: RelacaoItem[];
  formatoNome: string | null;
  tipo: 'post' | 'reels' | 'story';
  projetoId: string;
  projetoNome: string;
  cor: 'publicado' | 'agendado' | 'aprovacao' | 'alteracao' | 'aguardando' | 'rascunho';
  etapa: EtapaPost;
  etapaLabel: string;
  tarefaAtualTitulo: string | null;
  demanda: string | null;
  statusGeral: string | null;
  icon: string | null;
};

export const ETAPA_INFO: Record<EtapaPost, { label: string; cor: PostCalendario['cor'] }> = {
  publicado: { label: 'Publicado', cor: 'publicado' },
  producao: { label: 'Em produção', cor: 'agendado' },
  aprovacao: { label: 'Aprovação', cor: 'aprovacao' },
  alteracao: { label: 'Em alteração', cor: 'alteracao' },
  aguardando: { label: 'Aguardando você', cor: 'aguardando' },
  rascunho: { label: 'Rascunho', cor: 'rascunho' },
};

function tituloParaEtapa(titulo: string): EtapaPost {
  const t = titulo.trim();
  if (t.startsWith('Aprovação |')) return 'aprovacao';
  if (t.startsWith('Alteração |')) return 'alteracao';
  if (t === 'Materiais para Produção') return 'aguardando';
  if (t.startsWith('Envio de Conteúdos Prévios') || t.startsWith('Envio de Informações')) return 'aguardando';
  if (t.startsWith('Direcionamento de Stories')) return 'aguardando';
  return 'producao';
}

const PRIORIDADE_ETAPA: Record<EtapaPost, number> = {
  aprovacao: 5,
  aguardando: 4,
  alteracao: 3,
  producao: 2,
  rascunho: 1,
  publicado: 0,
};

/**
 * Pra cada postId, busca a tarefa atualmente "Pronta" (fórmula ` Pronto` = true)
 * e mapeia o título dela em uma etapa visual. Quando há mais de uma tarefa ativa
 * (galhos paralelos), pega a de maior prioridade pro cliente.
 */
async function getEtapaAtualPorPost(
  postIds: string[],
): Promise<Map<string, { etapa: EtapaPost; titulo: string }>> {
  const out = new Map<string, { etapa: EtapaPost; titulo: string }>();
  if (postIds.length === 0) return out;

  // Notion limita filtros muito grandes — quebra em chunks de 50 posts.
  const chunks: string[][] = [];
  for (let i = 0; i < postIds.length; i += 50) chunks.push(postIds.slice(i, i + 50));

  for (const chunk of chunks) {
    let cursor: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: env.notion.tarefasDbId,
        start_cursor: cursor,
        filter: {
          and: [
            {
              or: chunk.map((id) => ({
                property: env.notion.taskProps.post,
                relation: { contains: id },
              })),
            },
            {
              property: env.notion.taskProps.pronto,
              formula: { checkbox: { equals: true } },
            },
          ],
        },
      });

      for (const tarefa of res.results as any[]) {
        const titleProp = Object.values(tarefa.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        const titulo = txt(titleProp?.title) || '';
        const etapa = tituloParaEtapa(titulo);
        const postRel = getProp(tarefa, env.notion.taskProps.post)?.relation ?? [];
        for (const rel of postRel) {
          if (!chunk.includes(rel.id)) continue;
          const atual = out.get(rel.id);
          if (!atual || PRIORIDADE_ETAPA[etapa] > PRIORIDADE_ETAPA[atual.etapa]) {
            out.set(rel.id, { etapa, titulo });
          }
        }
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
  }
  return out;
}

const formatoCache = new Map<string, { name: string; tipo: 'post' | 'reels' | 'story' }>();

function classificarFormato(nome: string): 'post' | 'reels' | 'story' {
  const low = nome.toLowerCase();
  if (low.includes('stor')) return 'story';
  if (low.includes('reel')) return 'reels';
  return 'post';
}

/**
 * Resolve cada formato ID via page retrieve (não depende de o database Formato
 * estar compartilhado, contanto que a integration tenha acesso à página).
 * Cacheia em memória entre requests.
 */
async function resolverFormato(
  formatoIds: string[],
): Promise<{ name: string; tipo: 'post' | 'reels' | 'story' } | null> {
  for (const id of formatoIds) {
    const cached = formatoCache.get(id);
    if (cached) return cached;
    try {
      const page = (await notion.pages.retrieve({ page_id: id })) as any;
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      const name = txt(titleProp?.title);
      if (!name) continue;
      const info = { name, tipo: classificarFormato(name) };
      formatoCache.set(id, info);
      return info;
    } catch {
      // página não acessível pela integration — segue pro próximo id
    }
  }
  return null;
}

/**
 * Compat: os calls antigos usam getFormatoMap. Retorna um Map vazio
 * (a resolução agora é lazy via resolverFormato) — só pra não quebrar.
 */
async function getFormatoMap(): Promise<Map<string, { name: string; tipo: 'post' | 'reels' | 'story' }>> {
  return formatoCache;
}

export async function listPostsDoMes(
  projetoIds: string[],
  year: number,
  month: number,
): Promise<PostCalendario[]> {
  if (projetoIds.length === 0) return [];

  const projetoNomes = new Map<string, string>();
  for (const id of projetoIds) {
    try {
      const page = (await notion.pages.retrieve({ page_id: id })) as any;
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      projetoNomes.set(id, txt(titleProp?.title) || 'Projeto');
    } catch {
      projetoNomes.set(id, 'Projeto');
    }
  }

  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const onOrAfter = `${year}-${monthStr}-01`;
  const onOrBefore = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const out: PostCalendario[] = [];
  const formatoPorPostId = new Map<string, { name: string; tipo: 'post' | 'reels' | 'story' } | null>();
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: env.notion.postagensDbId,
      start_cursor: cursor,
      filter: {
        and: [
          { property: env.notion.postProps.data, date: { on_or_after: onOrAfter } },
          { property: env.notion.postProps.data, date: { on_or_before: onOrBefore } },
          {
            or: projetoIds.map((id) => ({
              property: env.notion.postProps.projeto,
              relation: { contains: id },
            })),
          },
        ],
      },
      sorts: [{ property: env.notion.postProps.data, direction: 'ascending' }],
    });

    // Resolve formato em paralelo pra cada página
    const pageFormats = await Promise.all(
      (res.results as any[]).map(async (page) => {
        const formatoIds = (getProp(page, 'Formato')?.relation ?? []).map((r: any) => r.id);
        return { id: page.id, info: await resolverFormato(formatoIds) };
      }),
    );
    for (const x of pageFormats) formatoPorPostId.set(x.id, x.info);

    for (const page of res.results as any[]) {
      const projetoRel = getProp(page, env.notion.postProps.projeto)?.relation ?? [];
      const projetoId = projetoRel[0]?.id as string | undefined;
      if (!projetoId || !projetoIds.includes(projetoId)) continue;

      const data = getProp(page, env.notion.postProps.data)?.date?.start as string | undefined;
      if (!data) continue;

      const status = getProp(page, env.notion.postProps.status)?.status?.name ?? null;
      if (status === 'Cancelado' || status === 'Excluída') continue;

      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      const formatoInfo = formatoPorPostId.get(page.id) ?? null;
      const demanda = getProp(page, env.notion.postProps.demanda)?.select?.name ?? null;
      const statusGeralProp = getProp(page, 'Status Geral');
      const statusGeral =
        statusGeralProp?.formula?.type === 'string'
          ? (statusGeralProp.formula.string ?? null)
          : null;
      const icon = pageIcon(page);

      out.push({
        id: page.id,
        titulo: txt(titleProp?.title) || 'Post sem título',
        data,
        status,
        formato: [],
        formatoNome: formatoInfo?.name ?? null,
        tipo: formatoInfo?.tipo ?? 'post',
        projetoId,
        projetoNome: projetoNomes.get(projetoId) ?? 'Projeto',
        // placeholders — preenchidos abaixo depois de buscar etapa
        cor: 'rascunho',
        etapa: 'rascunho',
        etapaLabel: ETAPA_INFO.rascunho.label,
        tarefaAtualTitulo: null,
        demanda,
        statusGeral,
        icon,
      });
    }

    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Busca a tarefa atual ativa de cada post, em batch
  const idsParaBuscarEtapa = out
    .filter((p) => p.status !== 'Postado')
    .map((p) => p.id);
  const etapaPorPost = await getEtapaAtualPorPost(idsParaBuscarEtapa);

  for (const p of out) {
    if (p.status === 'Postado') {
      p.etapa = 'publicado';
      p.tarefaAtualTitulo = null;
    } else {
      const ativa = etapaPorPost.get(p.id);
      p.etapa = ativa?.etapa ?? 'rascunho';
      p.tarefaAtualTitulo = ativa?.titulo ?? null;
    }
    const info = ETAPA_INFO[p.etapa];
    p.cor = info.cor;
    p.etapaLabel = info.label;
  }

  return out;
}

export type PostDetalhado = {
  id: string;
  titulo: string;
  data: string | null;
  status: string | null;
  projetoId: string | null;
  projetoNome: string;
  formato: RelacaoItem[];
  funil: RelacaoItem[];
  objetivo: RelacaoItem[];
  formatoTipo: 'post' | 'reels' | 'story' | 'desconhecido';
  driveLinks: { name: string; url: string }[];
  legenda: string | null;
  bodyCompleto: string | null;
  tarefaIds: string[];
};

const LEGENDA_KEYWORDS = ['legenda', 'caption'];

/**
 * Coleta todos os blocos do post de forma recursiva (entrando em callouts, tabs,
 * toggles, columns, etc) e retorna em ordem de leitura.
 */
async function coletarBlocosRecursivo(blockId: string, profundidade = 0): Promise<any[]> {
  if (profundidade > 4) return []; // proteção contra recursão infinita
  try {
    const out: any[] = [];
    const res = await notion.blocks.children.list({ block_id: blockId, page_size: 100 });
    for (const b of res.results as any[]) {
      out.push(b);
      if (b.has_children) {
        const filhos = await coletarBlocosRecursivo(b.id, profundidade + 1);
        out.push(...filhos);
      }
    }
    return out;
  } catch {
    return [];
  }
}

function rtTexto(b: any): string {
  const tipo = b.type;
  const rt = b[tipo]?.rich_text;
  if (!Array.isArray(rt)) return '';
  return rt.map((r: any) => r.plain_text).join('').trim();
}

function pareceMarcadorLegenda(b: any): boolean {
  const t = rtTexto(b).toLowerCase().replace(/[:.\s]+$/, '').trim();
  if (!t) return false;
  return LEGENDA_KEYWORDS.some((k) => t === k);
}

function ehHeading(b: any): boolean {
  return b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'heading_3';
}

async function lerLegendaDoPost(postId: string): Promise<string | null> {
  try {
    const blocks = await coletarBlocosRecursivo(postId);

    // Primeiro: bloco que é literalmente "Legenda" / "Caption" (heading ou texto formatado)
    const idxMarcador = blocks.findIndex(pareceMarcadorLegenda);
    if (idxMarcador >= 0) {
      const partes: string[] = [];
      for (let i = idxMarcador + 1; i < blocks.length; i++) {
        const b = blocks[i];
        // Para no próximo heading ou no próximo "marcador" estilo Legenda
        if (ehHeading(b) || pareceMarcadorLegenda(b)) break;
        const t = rtTexto(b);
        if (t) partes.push(t);
      }
      const out = partes.join('\n').trim();
      if (out) return out;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Lê o body do post inteiro como texto (ignorando markers de Legenda),
 * útil pra exibir a "ideia" no fluxo de aprovação de pauta.
 */
async function lerBodyCompletoDoPost(postId: string): Promise<string | null> {
  try {
    const blocks = await coletarBlocosRecursivo(postId);
    const partes: string[] = [];
    for (const b of blocks) {
      if (pareceMarcadorLegenda(b)) continue;
      const t = rtTexto(b);
      if (t) partes.push(t);
    }
    return partes.join('\n').trim() || null;
  } catch {
    return null;
  }
}

export async function getPostComDetalhes(postId: string): Promise<PostDetalhado | null> {
  try {
    const page = (await notion.pages.retrieve({ page_id: postId })) as any;
    if (page.archived) return null;

    const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
    const projetoRel = getProp(page, env.notion.postProps.projeto)?.relation ?? [];
    const projetoId = projetoRel[0]?.id ?? null;
    const tarefasRel = getProp(page, env.notion.postProps.tarefas)?.relation ?? [];

    let projetoNome = 'Projeto';
    if (projetoId) {
      try {
        const proj = (await notion.pages.retrieve({ page_id: projetoId })) as any;
        const projTitle = Object.values(proj.properties).find((p: any) => p.type === 'title') as any;
        projetoNome = txt(projTitle?.title) || 'Projeto';
      } catch {}
    }

    const formatoIds = (getProp(page, 'Formato')?.relation ?? []).map((r: any) => r.id);
    const funilIds = (getProp(page, 'Funil')?.relation ?? []).map((r: any) => r.id);
    const objetivoIds = (getProp(page, 'Objetivo')?.relation ?? []).map((r: any) => r.id);

    const [formato, funil, objetivo, formatoInfo, legenda, bodyCompleto] = await Promise.all([
      resolveRelacoes(formatoIds),
      resolveRelacoes(funilIds),
      resolveRelacoes(objetivoIds),
      resolverFormato(formatoIds),
      lerLegendaDoPost(postId),
      lerBodyCompletoDoPost(postId),
    ]);

    const formatoTipo: PostDetalhado['formatoTipo'] = formatoInfo?.tipo ?? 'desconhecido';

    const driveProp = getProp(page, env.notion.postProps.driveLink);
    const driveLinks: PostDetalhado['driveLinks'] = [];
    for (const f of driveProp?.files ?? []) {
      const url = f.type === 'external' ? f.external?.url : f.file?.url;
      if (url) driveLinks.push({ name: f.name ?? 'arquivo', url });
    }

    return {
      id: page.id,
      titulo: txt(titleProp?.title) || 'Post sem título',
      data: getProp(page, env.notion.postProps.data)?.date?.start ?? null,
      status: getProp(page, env.notion.postProps.status)?.status?.name ?? null,
      projetoId,
      projetoNome,
      formato,
      funil,
      objetivo,
      formatoTipo,
      driveLinks,
      legenda,
      bodyCompleto,
      tarefaIds: tarefasRel.map((r: any) => r.id),
    };
  } catch {
    return null;
  }
}

export async function aprovarTarefa(tarefaId: string, comentario?: string): Promise<void> {
  const tarefa = (await notion.pages.retrieve({ page_id: tarefaId })) as any;
  const postRel = getProp(tarefa, env.notion.taskProps.post)?.relation ?? [];
  const postId = postRel[0]?.id as string | undefined;

  await concluirTarefa(tarefaId);

  if (postId) {
    const titleProp = Object.values(tarefa.properties).find((p: any) => p.type === 'title') as any;
    const tarefaTitulo = txt(titleProp?.title) || 'Tarefa';
    const linhas = [`✅ ${tarefaTitulo} — aprovado pelo cliente.`];
    if (comentario && comentario.trim()) {
      linhas.push('', comentario.trim());
    }
    await comentarPost(postId, linhas.join('\n'));
  }
}

export async function pedirAlteracao(tarefaId: string, comentario: string): Promise<void> {
  if (!comentario || comentario.trim().length < 3) {
    throw new Error('comentario obrigatório e com pelo menos 3 caracteres');
  }
  const tarefa = (await notion.pages.retrieve({ page_id: tarefaId })) as any;

  const postRel = getProp(tarefa, env.notion.taskProps.post)?.relation ?? [];
  const postId = postRel[0]?.id as string | undefined;
  const titleProp = Object.values(tarefa.properties).find((p: any) => p.type === 'title') as any;
  const tarefaTitulo = txt(titleProp?.title) || 'Tarefa';

  // Reprova a tarefa atual + Finalizada em agora
  const agoraIso = new Date().toISOString();
  await notion.pages.update({
    page_id: tarefaId,
    properties: {
      [env.notion.taskProps.status]: { status: { name: 'Reprovado' } },
      [env.notion.taskProps.finalizada]: {
        date: { start: agoraIso, time_zone: 'America/Sao_Paulo' },
      },
    },
  });

  if (!postId) return;

  // Comentário no post com o pedido de alteração
  await comentarPost(
    postId,
    `🔁 ${tarefaTitulo} — alteração solicitada pelo cliente.\n\n${comentario.trim()}`,
  );
}


export async function getTarefaComPost(tarefaId: string): Promise<{
  tarefa: TarefaPendente;
} | null> {
  try {
    const tarefa = (await notion.pages.retrieve({ page_id: tarefaId })) as any;
    if (tarefa.archived) return null;

    const postRel = getProp(tarefa, env.notion.taskProps.post)?.relation ?? [];
    const postId = postRel[0]?.id as string | undefined;
    if (!postId) return null;

    const post = (await notion.pages.retrieve({ page_id: postId })) as any;
    const projetoRel = getProp(post, env.notion.postProps.projeto)?.relation ?? [];
    const projetoId = projetoRel[0]?.id as string | undefined;

    const tarefaTitleProp = Object.values(tarefa.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const postTitleProp = Object.values(post.properties).find((p: any) => p.type === 'title') as any;

    let projetoNome = 'Projeto';
    if (projetoId) {
      try {
        const proj = (await notion.pages.retrieve({ page_id: projetoId })) as any;
        const projTitle = Object.values(proj.properties).find((p: any) => p.type === 'title') as any;
        projetoNome = txt(projTitle?.title) || 'Projeto';
      } catch {}
    }

    const formatoIds = (getProp(post, 'Formato')?.relation ?? []).map((r: any) => r.id);
    const funilIds = (getProp(post, 'Funil')?.relation ?? []).map((r: any) => r.id);
    const objetivoIds = (getProp(post, 'Objetivo')?.relation ?? []).map((r: any) => r.id);

    const [formato, funil, objetivo] = await Promise.all([
      resolveRelacoes(formatoIds),
      resolveRelacoes(funilIds),
      resolveRelacoes(objetivoIds),
    ]);

    return {
      tarefa: {
        tarefaId: tarefa.id,
        tarefaTitulo: txt(tarefaTitleProp?.title) || '',
        tarefaPrazo:
          getProp(tarefa, 'Data Entrega')?.date?.start ??
          getProp(tarefa, 'Data Inicial')?.date?.start ??
          null,
        postId,
        postTitulo: txt(postTitleProp?.title) || 'Post sem título',
        postData: getProp(post, env.notion.postProps.data)?.date?.start ?? null,
        projetoId: projetoId ?? '',
        projetoNome,
        formato,
        funil,
        objetivo,
        formatoTipo: 'desconhecido',
        formatoNome: null,
      },
    };
  } catch {
    return null;
  }
}

export async function listPostsPendentes(projetoIds: string[]): Promise<Post[]> {
  if (projetoIds.length === 0) return [];

  const posts: Post[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: env.notion.postagensDbId,
      start_cursor: cursor,
      filter: {
        and: [
          {
            property: env.notion.postProps.projeto,
            relation: { is_not_empty: true },
          },
          {
            or: DEMANDAS_ATIVAS.map((d) => ({
              property: env.notion.postProps.demanda,
              select: { equals: d },
            })),
          },
          ...STATUS_EXCLUIR.map((s) => ({
            property: env.notion.postProps.status,
            status: { does_not_equal: s },
          })),
        ],
      },
      sorts: [{ property: env.notion.postProps.data, direction: 'ascending' }],
    });

    for (const page of res.results as any[]) {
      const projetoRel = getProp(page, env.notion.postProps.projeto)?.relation ?? [];
      const projetoId = projetoRel[0]?.id as string | undefined;
      if (!projetoId || !projetoIds.includes(projetoId)) continue;

      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      const dataProp = getProp(page, env.notion.postProps.data)?.date?.start ?? null;
      const demandaProp = getProp(page, env.notion.postProps.demanda)?.select?.name ?? null;
      const statusProp = getProp(page, env.notion.postProps.status)?.status?.name ?? null;

      posts.push({
        id: page.id,
        titulo: txt(titleProp?.title) || 'Post sem título',
        data: dataProp,
        demanda: demandaProp as DemandaTipo | null,
        status: statusProp,
        projetoId,
        projetoNome: null,
      });
    }

    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return posts;
}

export async function getPost(postId: string): Promise<Post & { tarefaIds: string[] } | null> {
  const page = (await notion.pages.retrieve({ page_id: postId })) as any;
  if (!page || page.archived) return null;

  const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
  const projetoRel = getProp(page, env.notion.postProps.projeto)?.relation ?? [];
  const tarefasRel = getProp(page, env.notion.postProps.tarefas)?.relation ?? [];

  return {
    id: page.id,
    titulo: txt(titleProp?.title) || 'Post sem título',
    data: getProp(page, env.notion.postProps.data)?.date?.start ?? null,
    demanda: (getProp(page, env.notion.postProps.demanda)?.select?.name as DemandaTipo) ?? null,
    status: getProp(page, env.notion.postProps.status)?.status?.name ?? null,
    projetoId: projetoRel[0]?.id ?? null,
    projetoNome: null,
    tarefaIds: tarefasRel.map((r: any) => r.id),
  };
}

export async function getProjetoNome(projetoId: string): Promise<string> {
  const page = (await notion.pages.retrieve({ page_id: projetoId })) as any;
  const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
  return txt(titleProp?.title) || 'Projeto';
}

export async function findTarefaProntaDoPost(postId: string): Promise<TarefaCliente | null> {
  const post = await getPost(postId);
  if (!post) return null;

  for (const tarefaId of post.tarefaIds) {
    const page = (await notion.pages.retrieve({ page_id: tarefaId })) as any;
    if (page.archived) continue;

    const prontoProp = getProp(page, env.notion.taskProps.pronto);
    const prontoValor = prontoProp?.formula;
    const isPronto =
      (prontoValor?.type === 'boolean' && prontoValor.boolean === true) ||
      (prontoValor?.type === 'string' && (prontoValor.string ?? '').toLowerCase().includes('pronto'));

    if (isPronto) {
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      return {
        id: page.id,
        titulo: txt(titleProp?.title) || 'Tarefa',
        pronto: true,
      };
    }
  }
  return null;
}

/**
 * Acha a tarefa "Pronta" (` Pronto`=true) do post que seja do cliente —
 * ou seja, casa com algum dos matchers em TAREFAS_CATEGORIAS.
 * Retorna null se nada estiver pendente pro cliente nesse post.
 */
export async function findTarefaClienteProntaDoPost(
  postId: string,
): Promise<{ tarefaId: string; titulo: string } | null> {
  const post = await getPost(postId);
  if (!post) return null;

  for (const tarefaId of post.tarefaIds) {
    try {
      const page = (await notion.pages.retrieve({ page_id: tarefaId })) as any;
      if (page.archived) continue;

      const prontoProp = getProp(page, env.notion.taskProps.pronto);
      const isPronto =
        prontoProp?.formula?.type === 'boolean' && prontoProp.formula.boolean === true;
      if (!isPronto) continue;

      const status = getProp(page, env.notion.taskProps.status)?.status?.name ?? null;
      if (status && STATUS_TAREFA_FECHADOS.includes(status)) continue;

      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      const titulo = txt(titleProp?.title) || '';
      // Só retorna se for tarefa cliente (matches TAREFAS_CATEGORIAS)
      if (categoriaDaTarefa(titulo)) {
        return { tarefaId, titulo };
      }
    } catch {
      // ignora erros de retrieve individual
    }
  }
  return null;
}

export async function concluirTarefa(tarefaId: string): Promise<void> {
  const hoje = new Date().toISOString().split('T')[0];
  await notion.pages.update({
    page_id: tarefaId,
    properties: {
      [env.notion.taskProps.status]: { status: { name: 'Concluído' } },
      [env.notion.taskProps.finalizada]: { date: { start: hoje } },
    },
  });
}

export async function comentarPost(postId: string, texto: string): Promise<void> {
  await notion.comments.create({
    parent: { page_id: postId },
    rich_text: [{ type: 'text', text: { content: texto } }],
  });
}

export async function anexarTextoAoPost(postId: string, titulo: string, texto: string): Promise<void> {
  await notion.blocks.children.append({
    block_id: postId,
    children: [
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: titulo } }],
        },
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji: '📝' },
          rich_text: [{ type: 'text', text: { content: texto } }],
        },
      },
    ],
  });
}

export async function atualizarLinkDriveDoPost(postId: string, nome: string, url: string): Promise<void> {
  await notion.pages.update({
    page_id: postId,
    properties: {
      [env.notion.postProps.driveLink]: {
        files: [
          {
            name: nome,
            type: 'external',
            external: { url },
          },
        ],
      },
    },
  });
}
