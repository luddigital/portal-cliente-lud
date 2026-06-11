import { Client } from '@notionhq/client';
import { unstable_cache, revalidateTag } from 'next/cache';
import { cache } from 'react';
import { env } from './env';

// Tags pra cache do Next — usadas pra invalidar quando algo muda no Notion
const TAG_TAREFAS = 'tarefas-pendentes';
const TAG_POSTS = 'posts-do-mes';
const TAG_RESUMO = 'resumo-clientes';
const TAG_CLIENTES = 'clientes';
const TAG_EQUIPE = 'equipe-prestadores';

/**
 * Invalida os caches do Next.js relacionados a dados que mudaram.
 * Chamado depois de aprovar, pedir alteração ou enviar material.
 */
export function invalidarCachesAposMudanca() {
  revalidateTag(TAG_TAREFAS);
  revalidateTag(TAG_POSTS);
  revalidateTag(TAG_RESUMO);
  // Também limpa nossos memory caches
  tarefasPorCategoriaCache.invalidate();
  postsDoMesCache.invalidate();
}

/**
 * Limpa TODOS os caches — usado pelo /api/admin/atualizar pra forçar o
 * portal a reler tudo do Notion na hora.
 */
export function invalidarTudo() {
  revalidateTag(TAG_TAREFAS);
  revalidateTag(TAG_POSTS);
  revalidateTag(TAG_RESUMO);
  revalidateTag(TAG_CLIENTES);
  revalidateTag(TAG_EQUIPE);
  tarefasPorCategoriaCache.invalidate();
  postsDoMesCache.invalidate();
  projetosByEmailCache.invalidate();
  nomeClienteCache.invalidate();
  pageCache.clear();
}

const notion = new Client({ auth: env.notion.token });

// Cache em memória de page retrieves (TTL 5 min). Páginas Notion (projetos,
// formatos, posts) raramente mudam — esse cache transforma vários round-trips
// num custo quase zero quando o lambda tá warm.
const PAGE_CACHE_TTL_MS = 5 * 60_000;
const pageCache = new Map<string, { ts: number; page: any }>();
// Dedup: enquanto um retrieve tá em voo, outras chamadas pro mesmo id reaproveitam a Promise.
const pageInFlight = new Map<string, Promise<any>>();

async function cachedPageRetrieve(pageId: string): Promise<any> {
  const now = Date.now();
  const hit = pageCache.get(pageId);
  if (hit && now - hit.ts < PAGE_CACHE_TTL_MS) return hit.page;
  const inFlight = pageInFlight.get(pageId);
  if (inFlight) return inFlight;
  const promise = notion.pages.retrieve({ page_id: pageId }).then(
    (page) => {
      pageCache.set(pageId, { ts: Date.now(), page });
      pageInFlight.delete(pageId);
      return page;
    },
    (err) => {
      pageInFlight.delete(pageId);
      throw err;
    },
  );
  pageInFlight.set(pageId, promise);
  return promise;
}

// Cache simples por chave string (TTL configurável). Usado pra cachear
// queries derivadas tipo "projetos do email X" ou "tarefas do projeto Y".
type Cached<T> = { ts: number; value: T };
function makeCache<T>(ttlMs: number) {
  const map = new Map<string, Cached<T>>();
  const inflight = new Map<string, Promise<T>>();
  return {
    async get(key: string, compute: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const hit = map.get(key);
      if (hit && now - hit.ts < ttlMs) return hit.value;
      const flight = inflight.get(key);
      if (flight) return flight;
      const promise = compute().then(
        (value) => {
          map.set(key, { ts: Date.now(), value });
          inflight.delete(key);
          return value;
        },
        (err) => {
          inflight.delete(key);
          throw err;
        },
      );
      inflight.set(key, promise);
      return promise;
    },
    invalidate(key?: string) {
      if (key) {
        map.delete(key);
        inflight.delete(key);
      } else {
        map.clear();
        inflight.clear();
      }
    },
  };
}

const projetosByEmailCache = makeCache<ProjetoCliente[]>(5 * 60_000);
const nomeClienteCache = makeCache<string | null>(10 * 60_000);
const tarefasPorCategoriaCache = makeCache<PostsAgrupadosPorCategoria>(120_000); // 2 min
const postsDoMesCache = makeCache<PostCalendario[]>(120_000); // 2 min

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
        const page = (await cachedPageRetrieve(id)) as any;
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

async function _getNomeDoClienteUncached(emailNorm: string): Promise<string | null> {
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
  const titleProp = Object.values(cliente.properties).find(
    (p: any) => p.type === 'title',
  ) as any;
  return txt(titleProp?.title) || null;
}

const _getNomeDoClienteCached = unstable_cache(
  _getNomeDoClienteUncached,
  ['nome-cliente-v2'],
  { revalidate: 600, tags: [TAG_CLIENTES] }, // 10 min
);

export type ClienteResumo = {
  id: string;
  nome: string;
  email: string | null;
  projetoCount: number;
  /** Quando true, a aprovação dos posts é coletiva: comentários não fecham
   *  a tarefa — só os botões explícitos "Aprovar"/"Reprovar" encerram. */
  aprovacaoColaborativa: boolean;
};

async function _listAllClientesUncached(): Promise<ClienteResumo[]> {
  const out: ClienteResumo[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.clientesDbId,
      start_cursor: cursor,
      page_size: 100,
      filter: {
        property: 'Status',
        status: { equals: 'Ativo' },
      },
    });
    for (const page of res.results as any[]) {
      const titleProp = Object.values(page.properties).find(
        (p: any) => p.type === 'title',
      ) as any;
      const nome = txt(titleProp?.title) || '(sem nome)';
      const email =
        page.properties?.[env.notion.clienteProps.email]?.email ?? null;
      const projetos =
        page.properties?.[env.notion.clienteProps.projetos]?.relation ?? [];
      const colabProp =
        page.properties?.[env.notion.clienteProps.aprovacaoColaborativa];
      const aprovacaoColaborativa =
        colabProp?.type === 'checkbox' ? !!colabProp.checkbox : false;
      out.push({
        id: page.id,
        nome,
        email,
        projetoCount: projetos.length,
        aprovacaoColaborativa,
      });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Pega quais clientes têm pelo menos 1 acesso extra cadastrado — incluímos
  // esses na listagem mesmo sem email principal (caso TKRA: time grande,
  // ninguém dá email único, só acessos múltiplos).
  const clientesComAcesso = new Set<string>();
  try {
    let cur: string | undefined;
    do {
      const r = await notion.databases.query({
        database_id: env.notion.acessosDbId,
        page_size: 100,
        start_cursor: cur,
        filter: {
          property: env.notion.acessoProps.ativo,
          checkbox: { equals: true },
        },
      });
      for (const acesso of r.results as any[]) {
        const rel =
          getProp(acesso, env.notion.acessoProps.cliente)?.relation ?? [];
        for (const c of rel) clientesComAcesso.add(c.id);
      }
      cur = r.has_more ? r.next_cursor ?? undefined : undefined;
    } while (cur);
  } catch {
    /* sem acesso ao banco de acessos — segue só com filtragem por email */
  }

  return out
    .filter((c) => !!c.email || clientesComAcesso.has(c.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const _listAllClientesCached = unstable_cache(
  _listAllClientesUncached,
  ['list-all-clientes-v3-ativos'],
  { revalidate: 300, tags: [TAG_CLIENTES] }, // 5 min
);

/**
 * Mapa projetoId → flag de aprovação colaborativa do cliente dono.
 * Pré-computado pra evitar O(N) sobre clientes no carregamento de cada post.
 * Cache de 5 min, invalidado pelo TAG_CLIENTES.
 */
async function _getProjetoColaborativoMapUncached(): Promise<
  Record<string, boolean>
> {
  const clientes = await _listAllClientesCached();
  const mapa: Record<string, boolean> = {};
  await Promise.all(
    clientes.map(async (c) => {
      try {
        const cliPage: any = await cachedPageRetrieve(c.id);
        const projRel =
          getProp(cliPage, env.notion.clienteProps.projetos)?.relation ?? [];
        for (const r of projRel) {
          mapa[r.id] = c.aprovacaoColaborativa;
        }
      } catch {
        /* ignora cliente individual com falha */
      }
    }),
  );
  return mapa;
}

const _getProjetoColaborativoMapCached = unstable_cache(
  _getProjetoColaborativoMapUncached,
  ['mapa-projeto-colaborativo-v1'],
  { revalidate: 300, tags: [TAG_CLIENTES] },
);

export async function getProjetoColaborativoMap(): Promise<
  Record<string, boolean>
> {
  return _getProjetoColaborativoMapCached();
}

/**
 * Lista todos os clientes do banco Clientes (somente os que têm email cadastrado).
 * Usado pelo painel admin pra "entrar como" cada cliente.
 */
export async function listAllClientes(): Promise<ClienteResumo[]> {
  return _listAllClientesCached();
}

/** Pega 1 cliente pelo ID (page id do Notion). Retorna null se não encontrar. */
export async function getClienteById(id: string): Promise<ClienteResumo | null> {
  try {
    const page = (await cachedPageRetrieve(id)) as any;
    if (page.archived) return null;
    const titleProp = Object.values(page.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const nome = txt(titleProp?.title) || '(sem nome)';
    const email =
      page.properties?.[env.notion.clienteProps.email]?.email ?? null;
    const projetos =
      page.properties?.[env.notion.clienteProps.projetos]?.relation ?? [];
    const colabProp =
      page.properties?.[env.notion.clienteProps.aprovacaoColaborativa];
    const aprovacaoColaborativa =
      colabProp?.type === 'checkbox' ? !!colabProp.checkbox : false;
    return {
      id: page.id,
      nome,
      email,
      projetoCount: projetos.length,
      aprovacaoColaborativa,
    };
  } catch {
    return null;
  }
}

export type ProjetoResumo = {
  id: string;
  nome: string;
  status: string | null;
};

export type EmpresaDetalhe = {
  id: string;
  nome: string;
  email: string | null;
  status: string | null;
  whatsapp: string | null;
  projetos: ProjetoResumo[];
  pendencias: ResumoTarefasCliente;
};

/** Detalhe completo de uma empresa/cliente pra página /admin/clientes/[id]. */
export async function getEmpresaDetalhe(
  clienteId: string,
): Promise<EmpresaDetalhe | null> {
  try {
    const page = (await cachedPageRetrieve(clienteId)) as any;
    if (page.archived) return null;

    const titleProp = Object.values(page.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const nome = txt(titleProp?.title) || '(sem nome)';
    const email = getProp(page, env.notion.clienteProps.email)?.email ?? null;
    const status = getProp(page, 'Status')?.status?.name ?? null;

    const waProp = getProp(page, 'WhatsApp') ?? getProp(page, 'Whatsapp');
    const whatsappRaw =
      waProp?.phone_number ??
      (waProp?.rich_text ? txt(waProp.rich_text) : '');
    const whatsapp = whatsappRaw ? whatsappRaw : null;

    const projetoRel =
      getProp(page, env.notion.clienteProps.projetos)?.relation ?? [];
    const projetos = await Promise.all(
      projetoRel.map(async (r: any): Promise<ProjetoResumo> => {
        try {
          const proj = (await cachedPageRetrieve(r.id)) as any;
          const tp = Object.values(proj.properties).find(
            (p: any) => p.type === 'title',
          ) as any;
          const projStatus =
            getProp(proj, 'Status Manual')?.select?.name ??
            getProp(proj, 'Status')?.status?.name ??
            null;
          return { id: r.id, nome: txt(tp?.title) || 'Projeto', status: projStatus };
        } catch {
          return { id: r.id, nome: 'Projeto', status: null };
        }
      }),
    );

    const pendencias = await getResumoTarefasCliente(projetos.map((p) => p.id));

    return { id: page.id, nome, email, status, whatsapp, projetos, pendencias };
  } catch {
    return null;
  }
}

// ── Projetos ────────────────────────────────────────────────────────────────

const LUDHUB_CONFIG_DB_ID = '732b61bc3e904592acfc49a5c82c2f41';

export type ProjetoConfig = {
  objetivo: string;
  foco: string[];
  metas: {
    seguidores: { inicio: string; atual: string; meta: string };
    engajamento: { inicio: string; atual: string; meta: string };
    alcance: { inicio: string; atual: string; meta: string };
  };
};

function configVazia(): ProjetoConfig {
  const m = { inicio: '', atual: '', meta: '' };
  return {
    objetivo: '',
    foco: [],
    metas: { seguidores: { ...m }, engajamento: { ...m }, alcance: { ...m } },
  };
}

async function buscarRowConfig(projetoId: string): Promise<any | null> {
  const res = await notion.databases.query({
    database_id: LUDHUB_CONFIG_DB_ID,
    page_size: 1,
    filter: { property: 'ID do Projeto', rich_text: { equals: projetoId } },
  });
  return (res.results[0] as any) ?? null;
}

/** Lê a config do projeto (objetivo/metas) da database do portal. */
export async function getProjetoConfig(projetoId: string): Promise<ProjetoConfig> {
  try {
    const row = await buscarRowConfig(projetoId);
    if (!row) return configVazia();
    const p = row.properties;
    const rt = (nome: string) => txt(p[nome]?.rich_text) || '';
    return {
      objetivo: rt('Objetivo'),
      foco: (p['Foco']?.multi_select ?? []).map((o: any) => o.name),
      metas: {
        seguidores: {
          inicio: rt('Seguidores início'),
          atual: rt('Seguidores atual'),
          meta: rt('Seguidores meta'),
        },
        engajamento: {
          inicio: rt('Engajamento início'),
          atual: rt('Engajamento atual'),
          meta: rt('Engajamento meta'),
        },
        alcance: {
          inicio: rt('Alcance início'),
          atual: rt('Alcance atual'),
          meta: rt('Alcance meta'),
        },
      },
    };
  } catch {
    return configVazia();
  }
}

/** Salva (cria ou atualiza) a config do projeto na database do portal. */
export async function salvarProjetoConfig(
  projetoId: string,
  projetoNome: string,
  c: ProjetoConfig,
): Promise<void> {
  const rt = (v: string) =>
    ({ rich_text: v ? [{ type: 'text', text: { content: v } }] : [] }) as any;
  const props: any = {
    Projeto: { title: [{ type: 'text', text: { content: projetoNome } }] },
    'ID do Projeto': rt(projetoId),
    Objetivo: rt(c.objetivo),
    Foco: { multi_select: c.foco.map((name) => ({ name })) },
    'Seguidores início': rt(c.metas.seguidores.inicio),
    'Seguidores atual': rt(c.metas.seguidores.atual),
    'Seguidores meta': rt(c.metas.seguidores.meta),
    'Engajamento início': rt(c.metas.engajamento.inicio),
    'Engajamento atual': rt(c.metas.engajamento.atual),
    'Engajamento meta': rt(c.metas.engajamento.meta),
    'Alcance início': rt(c.metas.alcance.inicio),
    'Alcance atual': rt(c.metas.alcance.atual),
    'Alcance meta': rt(c.metas.alcance.meta),
  };
  const row = await buscarRowConfig(projetoId);
  if (row) {
    await notion.pages.update({ page_id: row.id, properties: props });
  } else {
    await notion.pages.create({
      parent: { database_id: LUDHUB_CONFIG_DB_ID },
      properties: props,
    });
  }
}

export type ProjetoListItem = {
  id: string;
  nome: string;
  status: string | null;
  clienteId: string;
  clienteNome: string;
};

/** Lista todos os projetos (agregando a partir dos clientes ativos). */
async function _listAllProjetosUncached(): Promise<ProjetoListItem[]> {
  const clientes = await listAllClientes();
  const porCliente = await Promise.all(
    clientes.map(async (c) => {
      const ids = await getProjetosDoCliente(c.id);
      return { clienteId: c.id, clienteNome: c.nome, ids };
    }),
  );

  // Coleta IDs únicos + mapa id → cliente (primeiro cliente que reivindica vence)
  const idToCliente = new Map<string, { clienteId: string; clienteNome: string }>();
  for (const { clienteId, clienteNome, ids } of porCliente) {
    for (const id of ids) {
      if (!idToCliente.has(id)) {
        idToCliente.set(id, { clienteId, clienteNome });
      }
    }
  }

  // Resolve TODOS os projetos em paralelo (antes era serial — gargalo)
  const resolvidos = await Promise.all(
    [...idToCliente.entries()].map(async ([id, donoInfo]) => {
      try {
        const proj = (await cachedPageRetrieve(id)) as any;
        if (proj.archived) return null;
        const tp = Object.values(proj.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        const status =
          getProp(proj, 'Status Manual')?.select?.name ??
          getProp(proj, 'Status')?.status?.name ??
          null;
        return {
          id,
          nome: txt(tp?.title) || 'Projeto',
          status,
          clienteId: donoInfo.clienteId,
          clienteNome: donoInfo.clienteNome,
        } as ProjetoListItem;
      } catch {
        return null;
      }
    }),
  );

  return resolvidos
    .filter((p): p is ProjetoListItem => p !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const _listAllProjetosCached = unstable_cache(
  _listAllProjetosUncached,
  ['list-all-projetos-v1'],
  { revalidate: 300, tags: [TAG_CLIENTES] }, // 5 min — bate com clientes
);

export async function listAllProjetos(): Promise<ProjetoListItem[]> {
  return _listAllProjetosCached();
}

export type ProjetoDetalhe = {
  id: string;
  nome: string;
  status: string | null;
  clienteNome: string | null;
  gestor: string | null;
  config: ProjetoConfig;
  tarefas: { id: string; titulo: string; pessoa: string | null }[];
};

/** Detalhe de um projeto + config + tarefas pendentes. */
async function _getProjetoDetalheUncached(
  projetoId: string,
): Promise<ProjetoDetalhe | null> {
  try {
    // 3 chamadas independentes em paralelo (antes era serial)
    // Pega TODAS tarefas pendentes paginando (projetos grandes tipo Ste Travels
    // têm 200+ pendentes — antes só pegava as primeiras 100, escondendo o resto).
    async function pegarTodasTarefas(): Promise<any[]> {
      const out: any[] = [];
      let cursor: string | undefined;
      do {
        const r = await notion.databases.query({
          database_id: env.notion.tarefasDbId,
          page_size: 100,
          start_cursor: cursor,
          filter: {
            and: [
              { property: 'Projeto', relation: { contains: projetoId } },
              ...STATUS_TAREFA_FECHADOS.map((s) => ({
                property: env.notion.taskProps.status,
                status: { does_not_equal: s },
              })),
            ],
          },
        });
        out.push(...(r.results as any[]));
        cursor = r.has_more ? r.next_cursor ?? undefined : undefined;
        // Cap em 5 páginas (500 tarefas) — projetos absurdamente grandes
        if (out.length >= 500) break;
      } while (cursor);
      return out;
    }

    const [projAny, todasTarefas, config] = await Promise.all([
      cachedPageRetrieve(projetoId) as Promise<any>,
      pegarTodasTarefas(),
      getProjetoConfig(projetoId),
    ]);

    if (projAny.archived) return null;

    const tp = Object.values(projAny.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const nome = txt(tp?.title) || 'Projeto';
    const status =
      getProp(projAny, 'Status Manual')?.select?.name ??
      getProp(projAny, 'Status')?.status?.name ??
      null;
    const gestor =
      getProp(projAny, 'Gestor de Projetos Resp')?.people?.[0]?.name ?? null;

    // Cliente depende do projeto, mas chamada paralela à montagem das tarefas
    let clienteNome: string | null = null;
    const crm = getProp(projAny, 'CRM')?.relation ?? [];
    if (crm[0]) {
      try {
        const cli = (await cachedPageRetrieve(crm[0].id)) as any;
        const ctp = Object.values(cli.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        clienteNome = txt(ctp?.title) || null;
      } catch {}
    }

    const tarefas: ProjetoDetalhe['tarefas'] = [];
    for (const t of todasTarefas) {
      const ttp = Object.values(t.properties).find(
        (p: any) => p.type === 'title',
      ) as any;
      tarefas.push({
        id: t.id,
        titulo: txt(ttp?.title) || 'Tarefa',
        pessoa: getProp(t, 'Pessoa')?.people?.[0]?.name ?? null,
      });
    }

    return { id: projetoId, nome, status, clienteNome, gestor, config, tarefas };
  } catch {
    return null;
  }
}

const _getProjetoDetalheCached = unstable_cache(
  _getProjetoDetalheUncached,
  ['get-projeto-detalhe-v2-paginado'],
  { revalidate: 120, tags: [TAG_TAREFAS, TAG_CLIENTES] }, // 2 min
);

export async function getProjetoDetalhe(
  projetoId: string,
): Promise<ProjetoDetalhe | null> {
  return _getProjetoDetalheCached(projetoId);
}

/** Retorna os projetoIds vinculados ao cliente. */
export async function getProjetosDoCliente(clienteId: string): Promise<string[]> {
  try {
    const page = (await cachedPageRetrieve(clienteId)) as any;
    const projetos =
      page.properties?.[env.notion.clienteProps.projetos]?.relation ?? [];
    return projetos.map((r: any) => r.id);
  } catch {
    return [];
  }
}

export async function getNomeDoCliente(email: string): Promise<string | null> {
  const emailNorm = email.trim().toLowerCase();
  // Camada 1: memory cache (mesma lambda)
  return nomeClienteCache.get(emailNorm, () => _getNomeDoClienteCached(emailNorm));
}

const _findProjetosByEmailCached = unstable_cache(
  findProjetosByEmailUncached,
  ['projetos-by-email-v3-acessos'],
  { revalidate: 300, tags: [TAG_CLIENTES] }, // 5 min
);

export async function findProjetosByEmail(email: string): Promise<ProjetoCliente[]> {
  const emailNorm = email.trim().toLowerCase();
  return projetosByEmailCache.get(emailNorm, () => _findProjetosByEmailCached(emailNorm));
}

async function findProjetosByEmailUncached(emailNorm: string): Promise<ProjetoCliente[]> {
  const projetoIds = new Set<string>();
  let cursor: string | undefined;

  // 1) Cliente "dono" — quem tem esse email no campo principal de E-mail
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

  // 2) Acessos extras — emails autorizados pelo admin (banco LudHub — Acessos)
  try {
    let cur2: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: env.notion.acessosDbId,
        start_cursor: cur2,
        filter: {
          and: [
            {
              property: env.notion.acessoProps.email,
              title: { equals: emailNorm },
            },
            // Considera só acessos ativos. Quando o usuário criar via portal,
            // a flag já vai como true. Pra entradas manuais, marcar Ativo.
            {
              property: env.notion.acessoProps.ativo,
              checkbox: { equals: true },
            },
          ],
        },
      });
      for (const acesso of res.results as any[]) {
        const clienteRel =
          getProp(acesso, env.notion.acessoProps.cliente)?.relation ?? [];
        for (const r of clienteRel) {
          try {
            const cli = await cachedPageRetrieve(r.id);
            const projRel =
              getProp(cli, env.notion.clienteProps.projetos)?.relation ?? [];
            for (const p of projRel) projetoIds.add(p.id);
          } catch {
            /* ignora */
          }
        }
      }
      cur2 = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cur2);
  } catch (err: any) {
    // Sem acesso ao banco ou ainda não compartilhado — sem problema
    console.warn('[acessos] falhou consulta:', err?.message);
  }

  // Paraleliza retrieves dos projetos (antes era serial, era ~70% do tempo de login)
  const projetosResultado = await Promise.all(
    Array.from(projetoIds).map(async (id) => {
      try {
        const page = await cachedPageRetrieve(id);
        if (page.archived) return null;
        const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
        return {
          id: page.id,
          nome: txt(titleProp?.title) || 'Projeto sem nome',
          email: emailNorm,
        };
      } catch {
        return null;
      }
    }),
  );
  const projetos: ProjetoCliente[] = projetosResultado.filter(
    (p): p is ProjetoCliente => p !== null,
  );

  const allowlist = env.test.projetoNomesAllowlist;
  const ehAdmin = env.auth.adminEmails.includes(emailNorm);
  if (allowlist.length > 0 && !ehAdmin) {
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
  await Promise.all(
    projetoIds.map(async (id) => {
      try {
        const page = await cachedPageRetrieve(id);
        const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
        projetoNomes.set(id, txt(titleProp?.title) || 'Projeto');
      } catch {
        projetoNomes.set(id, 'Projeto');
      }
    }),
  );

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
        const post = (await cachedPageRetrieve(postId)) as any;
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

async function _listTarefasPendentesPorCategoriaUncached(
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

const _listTarefasCached = unstable_cache(
  _listTarefasPendentesPorCategoriaUncached,
  ['tarefas-pendentes-v3'],
  { revalidate: 300, tags: [TAG_TAREFAS] },
);

export async function listTarefasPendentesPorCategoria(
  projetoIds: string[],
): Promise<PostsAgrupadosPorCategoria> {
  const cacheKey = [...projetoIds].sort().join(',');
  return tarefasPorCategoriaCache.get(cacheKey, () => _listTarefasCached(projetoIds));
}

export type ResumoTarefasCliente = Record<CategoriaTarefa, number>;

/**
 * Versão "somente counts" — pro painel admin que precisa renderizar muitos
 * clientes em paralelo sem trazer payload pesado.
 */
const ENTREGAS_DB_ID = '2b5d04d2-3b4a-8032-998f-e9756de76cfe';

export type EntregaItem = {
  id: string;
  nome: string;
  statusTexto: string | null;
  proximaEntregaTexto: string | null;
  proximaData: string | null;
  frequencia: string | null;
  totalTarefas: number;
  /** Quantas tarefas em atraso, extraído da fórmula Status. */
  atrasadas: number;
};

async function _listEntregasUncached(): Promise<EntregaItem[]> {
  const out: EntregaItem[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: ENTREGAS_DB_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const p of res.results as any[]) {
      const titleProp = Object.values(p.properties).find((x: any) => x.type === 'title') as any;
      const nome = txt(titleProp?.title) || '(sem nome)';
      const statusTexto = p.properties.Status?.formula?.string ?? null;
      const proximaEntregaTexto = p.properties['Próxima Entrega']?.formula?.string ?? null;
      const proximaData = p.properties['Próxima data']?.formula?.string ?? null;
      const frequencia = p.properties['Frequência']?.select?.name ?? null;
      const totalTarefas = p.properties.Tarefas?.relation?.length ?? 0;
      const m = (statusTexto ?? '').match(/(\d+)\s*tarefa/i);
      const atrasadas = m ? parseInt(m[1], 10) : 0;
      out.push({
        id: p.id,
        nome,
        statusTexto,
        proximaEntregaTexto,
        proximaData,
        frequencia,
        totalTarefas,
        atrasadas,
      });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  // Ordena: com atraso primeiro (decrescente), depois alfabético
  return out.sort((a, b) => {
    if (a.atrasadas !== b.atrasadas) return b.atrasadas - a.atrasadas;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

const _listEntregasCached = unstable_cache(
  _listEntregasUncached,
  ['entregas-v2'],
  { revalidate: 300, tags: [TAG_TAREFAS] },
);

export async function listEntregas(): Promise<EntregaItem[]> {
  return _listEntregasCached();
}

/** Parseia "⏳ 13/05/2026" ou "13/05/2026" pra ISO "2026-05-13". */
function parseProximaData(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Retorna as entregas com Próxima data = data fornecida (default hoje). */
export async function getEntregasDoDia(data?: Date): Promise<EntregaItem[]> {
  const all = await listEntregas();
  const target = (data ?? new Date()).toISOString().slice(0, 10);
  return all.filter((e) => parseProximaData(e.proximaData) === target);
}

export type TarefaDaEntrega = {
  tarefaId: string;
  titulo: string;
  status: string | null;
  prazo: string | null;
  finalizada: string | null;
  postId: string | null;
  postTitulo: string | null;
  projetoId: string | null;
  projetoNome: string | null;
  clienteNome: string | null;
};

export type EntregaDetalhe = EntregaItem & {
  tarefasRelacionadas: TarefaDaEntrega[];
};

/**
 * Pega 1 entrega + retrieve de cada tarefa relacionada (com projeto/cliente).
 * Retorna só tarefas não concluídas.
 */
async function _getEntregaDetalheUncached(entregaId: string): Promise<EntregaDetalhe | null> {
  try {
    const entrega = (await cachedPageRetrieve(entregaId)) as any;
    const titleProp = Object.values(entrega.properties).find(
      (x: any) => x.type === 'title',
    ) as any;
    const nome = txt(titleProp?.title) || '(sem nome)';
    const statusTexto = entrega.properties.Status?.formula?.string ?? null;
    const proximaEntregaTexto =
      entrega.properties['Próxima Entrega']?.formula?.string ?? null;
    const proximaData = entrega.properties['Próxima data']?.formula?.string ?? null;
    const frequencia = entrega.properties['Frequência']?.select?.name ?? null;
    const m = (statusTexto ?? '').match(/(\d+)\s*tarefa/i);
    const atrasadas = m ? parseInt(m[1], 10) : 0;

    // Entregas recorrentes acumulam centenas de tarefas no relacionamento.
    // Em vez de dar retrieve em todas (estoura o rate limit do Notion e as
    // tarefas somem), consulta o banco filtrando direto só as NÃO concluídas.
    const tarefasAbertas: any[] = [];
    let cursor: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: env.notion.tarefasDbId,
        start_cursor: cursor,
        page_size: 100,
        filter: {
          and: [
            { property: 'Entregas', relation: { contains: entregaId } },
            // só tarefas "prontas" (check ativado na fórmula Pronto)
            {
              property: env.notion.taskProps.pronto,
              formula: { checkbox: { equals: true } },
            },
            ...STATUS_TAREFA_FECHADOS.map((s) => ({
              property: env.notion.taskProps.status,
              status: { does_not_equal: s },
            })),
          ],
        },
      });
      tarefasAbertas.push(...(res.results as any[]));
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);

    // Resolve TODAS as tarefas em paralelo. cachedPageRetrieve já faz dedupe
    // por id — se 50 tarefas referenciam 10 projetos, só vai 10 retrieves.
    // Dentro de cada tarefa, post + projeto rodam em paralelo (não dependem).
    const resolvidas = await Promise.all(
      tarefasAbertas.map(async (t: any): Promise<TarefaDaEntrega | null> => {
        try {
          const tt = Object.values(t.properties).find(
            (x: any) => x.type === 'title',
          ) as any;
          const titulo = txt(tt?.title) || '';
          const status = t.properties.Status?.status?.name ?? null;
          const prazo =
            t.properties['Data Entrega']?.date?.start ??
            t.properties['Data Inicial']?.date?.start ??
            null;
          const finalizada = t.properties['Finalizada em ']?.date?.start ?? null;
          const postRel = t.properties.Post?.relation ?? [];
          const projetoRel = t.properties.Projeto?.relation ?? [];

          // post + projeto em paralelo
          const [postPage, projPage] = await Promise.all([
            postRel[0] ? cachedPageRetrieve(postRel[0].id).catch(() => null) : null,
            projetoRel[0] ? cachedPageRetrieve(projetoRel[0].id).catch(() => null) : null,
          ]);

          let postTitulo: string | null = null;
          if (postPage) {
            const ptp = Object.values((postPage as any).properties).find(
              (x: any) => x.type === 'title',
            ) as any;
            postTitulo = txt(ptp?.title) || null;
          }

          let projetoNome: string | null = null;
          let clienteNome: string | null = null;
          if (projPage) {
            const projAny = projPage as any;
            const ptp = Object.values(projAny.properties).find(
              (x: any) => x.type === 'title',
            ) as any;
            projetoNome = txt(ptp?.title) || null;
            const clienteRel = projAny.properties.Cliente?.relation ?? [];
            if (clienteRel[0]) {
              try {
                const cli = (await cachedPageRetrieve(clienteRel[0].id)) as any;
                const ctp = Object.values(cli.properties).find(
                  (x: any) => x.type === 'title',
                ) as any;
                clienteNome = txt(ctp?.title) || null;
              } catch {}
            }
          }

          return {
            tarefaId: t.id,
            titulo,
            status,
            prazo,
            finalizada,
            postId: postRel[0]?.id ?? null,
            postTitulo,
            projetoId: projetoRel[0]?.id ?? null,
            projetoNome,
            clienteNome,
          };
        } catch {
          return null;
        }
      }),
    );
    const tarefasRelacionadas: TarefaDaEntrega[] = [];
    for (const r of resolvidas) if (r) tarefasRelacionadas.push(r);

    // Ordena por prazo: as mais antigas primeiro. Sem prazo vai pro fim.
    tarefasRelacionadas.sort((a, b) => {
      if (!a.prazo && !b.prazo) return 0;
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return a.prazo.localeCompare(b.prazo);
    });

    return {
      id: entrega.id,
      nome,
      statusTexto,
      proximaEntregaTexto,
      proximaData,
      frequencia,
      totalTarefas: tarefasRelacionadas.length,
      atrasadas,
      tarefasRelacionadas,
    };
  } catch {
    return null;
  }
}

const _getEntregaDetalheCached = unstable_cache(
  _getEntregaDetalheUncached,
  ['get-entrega-detalhe-v1'],
  { revalidate: 60, tags: [TAG_TAREFAS] }, // 1 min
);

export async function getEntregaDetalhe(
  entregaId: string,
): Promise<EntregaDetalhe | null> {
  return _getEntregaDetalheCached(entregaId);
}

/** Diz se uma entrega é do tipo "Aprovação" (nome começa com "Aprovaç..."). */
export function ehEntregaDeAprovacao(nome: string): boolean {
  return /^\s*aprovaç/i.test(nome ?? '');
}

/** Extrai a categoria da entrega de aprovação ("Aprovação | Post" → "Post"). */
function categoriaDaAprovacao(nome: string): string {
  const limpo = (nome ?? '')
    .trim()
    .replace(/^aprovaç(ão|ões)\s*\|?\s*/i, '')
    .trim();
  return limpo || 'Geral';
}

export type GrupoAprovacao = {
  categoria: string;
  entregaId: string;
  entregaNome: string;
  tarefas: TarefaDaEntrega[];
};

/**
 * Junta todas as entregas de "Aprovação" numa lista só, agrupada por
 * categoria (Pauta, Post, Arte, etc). Usado na página /admin/aprovacoes.
 */
export async function getAprovacoesAgrupadas(): Promise<GrupoAprovacao[]> {
  const entregas = await listEntregas();
  const aprov = entregas.filter((e) => ehEntregaDeAprovacao(e.nome));

  const grupos = await Promise.all(
    aprov.map(async (e): Promise<GrupoAprovacao> => {
      const det = await getEntregaDetalhe(e.id);
      return {
        categoria: categoriaDaAprovacao(e.nome),
        entregaId: e.id,
        entregaNome: e.nome,
        tarefas: det?.tarefasRelacionadas ?? [],
      };
    }),
  );

  // Junta grupos com a mesma categoria (ex: "Criação Pauta" e "Criação de Pauta")
  const porCategoria = new Map<string, GrupoAprovacao>();
  for (const g of grupos) {
    const existente = porCategoria.get(g.categoria);
    if (existente) {
      existente.tarefas.push(...g.tarefas);
    } else {
      porCategoria.set(g.categoria, { ...g, tarefas: [...g.tarefas] });
    }
  }

  return [...porCategoria.values()]
    .filter((g) => g.tarefas.length > 0)
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'));
}

export async function getResumoTarefasCliente(
  projetoIds: string[],
): Promise<ResumoTarefasCliente> {
  if (projetoIds.length === 0) {
    return { previas: 0, pauta: 0, post: 0, materiais: 0, stories: 0 };
  }
  const porCat = await listTarefasPendentesPorCategoria(projetoIds);
  return {
    previas: porCat.previas.length,
    pauta: porCat.pauta.length,
    post: porCat.post.length,
    materiais: porCat.materiais.length,
    stories: porCat.stories.length,
  };
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
      const page = (await cachedPageRetrieve(id)) as any;
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

const _listPostsDoMesCached = unstable_cache(
  listPostsDoMesUncached,
  ['posts-do-mes-v3'],
  { revalidate: 300, tags: [TAG_POSTS] },
);

export async function listPostsDoMes(
  projetoIds: string[],
  year: number,
  month: number,
): Promise<PostCalendario[]> {
  if (projetoIds.length === 0) return [];
  const cacheKey = `${[...projetoIds].sort().join(',')}-${year}-${month}`;
  return postsDoMesCache.get(cacheKey, () =>
    _listPostsDoMesCached(projetoIds, year, month),
  );
}

async function listPostsDoMesUncached(
  projetoIds: string[],
  year: number,
  month: number,
): Promise<PostCalendario[]> {
  const projetoNomes = new Map<string, string>();
  await Promise.all(
    projetoIds.map(async (id) => {
      try {
        const page = await cachedPageRetrieve(id);
        const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
        projetoNomes.set(id, txt(titleProp?.title) || 'Projeto');
      } catch {
        projetoNomes.set(id, 'Projeto');
      }
    }),
  );

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

/**
 * Lista posts de TODOS os clientes num intervalo de datas (inclusivo).
 * Usado no calendário da semana da Home do admin.
 */
async function listPostsNoIntervaloUncached(
  onOrAfter: string,
  onOrBefore: string,
): Promise<PostCalendario[]> {
  const out: PostCalendario[] = [];
  const formatoPorPostId = new Map<
    string,
    { name: string; tipo: 'post' | 'reels' | 'story' } | null
  >();
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: env.notion.postagensDbId,
      start_cursor: cursor,
      filter: {
        and: [
          { property: env.notion.postProps.data, date: { on_or_after: onOrAfter } },
          { property: env.notion.postProps.data, date: { on_or_before: onOrBefore } },
        ],
      },
      sorts: [{ property: env.notion.postProps.data, direction: 'ascending' }],
    });

    const pageFormats = await Promise.all(
      (res.results as any[]).map(async (page) => {
        const formatoIds = (getProp(page, 'Formato')?.relation ?? []).map(
          (r: any) => r.id,
        );
        return { id: page.id, info: await resolverFormato(formatoIds) };
      }),
    );
    for (const x of pageFormats) formatoPorPostId.set(x.id, x.info);

    for (const page of res.results as any[]) {
      const projetoRel = getProp(page, env.notion.postProps.projeto)?.relation ?? [];
      const projetoId = projetoRel[0]?.id as string | undefined;
      if (!projetoId) continue;

      const data = getProp(page, env.notion.postProps.data)?.date?.start as
        | string
        | undefined;
      if (!data) continue;

      const status = getProp(page, env.notion.postProps.status)?.status?.name ?? null;
      if (status === 'Cancelado' || status === 'Excluída') continue;

      const titleProp = Object.values(page.properties).find(
        (p: any) => p.type === 'title',
      ) as any;
      const formatoInfo = formatoPorPostId.get(page.id) ?? null;
      const demanda = getProp(page, env.notion.postProps.demanda)?.select?.name ?? null;
      const statusGeralProp = getProp(page, 'Status Geral');
      const statusGeral =
        statusGeralProp?.formula?.type === 'string'
          ? (statusGeralProp.formula.string ?? null)
          : null;

      out.push({
        id: page.id,
        titulo: txt(titleProp?.title) || 'Post sem título',
        data,
        status,
        formato: [],
        formatoNome: formatoInfo?.name ?? null,
        tipo: formatoInfo?.tipo ?? 'post',
        projetoId,
        projetoNome: 'Projeto',
        cor: 'rascunho',
        etapa: 'rascunho',
        etapaLabel: ETAPA_INFO.rascunho.label,
        tarefaAtualTitulo: null,
        demanda,
        statusGeral,
        icon: pageIcon(page),
      });
    }

    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Resolve o nome do projeto de cada post (sem lista fixa de clientes).
  const projetoIdsUnicos = [...new Set(out.map((p) => p.projetoId))];
  const projetoNomes = new Map<string, string>();
  await Promise.all(
    projetoIdsUnicos.map(async (id) => {
      try {
        const page = await cachedPageRetrieve(id);
        const tp = Object.values(page.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        projetoNomes.set(id, txt(tp?.title) || 'Projeto');
      } catch {
        projetoNomes.set(id, 'Projeto');
      }
    }),
  );
  for (const p of out) p.projetoNome = projetoNomes.get(p.projetoId) ?? 'Projeto';

  // Etapa atual de cada post não-postado.
  const etapaPorPost = await getEtapaAtualPorPost(
    out.filter((p) => p.status !== 'Postado').map((p) => p.id),
  );
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

const _listPostsNoIntervaloCached = unstable_cache(
  listPostsNoIntervaloUncached,
  ['posts-intervalo-v2'],
  { revalidate: 300, tags: [TAG_POSTS] },
);

export async function listPostsNoIntervalo(
  onOrAfter: string,
  onOrBefore: string,
): Promise<PostCalendario[]> {
  return _listPostsNoIntervaloCached(onOrAfter, onOrBefore);
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
  ideiaDoPost: string | null;
  /** "Materiais que precisamos para o post" — usado na etapa de Envio de
   *  Materiais (fotos, vídeos, voice over). */
  materiaisNecessarios: MaterialBloco[] | null;
  /** "Informações que precisamos para o post" — usado na etapa de Envio de
   *  Conteúdos Prévios (questões pro cliente responder antes da produção). */
  informacoesNecessarias: MaterialBloco[] | null;
  /** Quando true, o cliente tem aprovação colaborativa: comentários não
   *  fecham a tarefa, só os botões explícitos "Aprovar"/"Reprovar". */
  aprovacaoColaborativa: boolean;
  tarefaIds: string[];
};

export type MaterialBloco = {
  /** Texto principal da aside/callout (primeira linha) */
  cabecalho: string;
  /** Linhas adicionais (parágrafos filhos da callout) */
  detalhes: string[];
};

const LEGENDA_KEYWORDS = ['legenda', 'caption'];

/**
 * Coleta todos os blocos do post de forma recursiva (entrando em callouts, tabs,
 * toggles, columns, etc) e retorna em ordem de leitura.
 *
 * Wrapped em `cache()` do React — chamadas múltiplas pro mesmo blockId
 * DENTRO DA MESMA REQUEST batem dedupe (todas as 5 leituras de seção em
 * getPostComDetalhes compartilham o mesmo fetch). Cache TTL = duração da request.
 */
const coletarBlocosRecursivo = cache(async function coletarBlocosRecursivoInner(
  blockId: string,
  profundidade = 0,
): Promise<any[]> {
  if (profundidade > 4) return []; // proteção contra recursão infinita
  try {
    const out: any[] = [];
    const res = await notion.blocks.children.list({ block_id: blockId, page_size: 100 });
    for (const b of res.results as any[]) {
      out.push(b);
      if (b.has_children) {
        const filhos = await coletarBlocosRecursivoInner(b.id, profundidade + 1);
        out.push(...filhos);
      }
    }
    return out;
  } catch {
    return [];
  }
});

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
      // A legenda é só texto corrido. Para no próximo heading, em outro
      // marcador "Legenda", ou no primeiro bloco estrutural (callout, divider,
      // database, colunas...) — assim não puxa "Tarefas Lud." e afins.
      const TIPOS_TEXTO_LEGENDA = new Set([
        'paragraph',
        'bulleted_list_item',
        'numbered_list_item',
        'quote',
        'to_do',
      ]);
      const partes: string[] = [];
      for (let i = idxMarcador + 1; i < blocks.length; i++) {
        const b = blocks[i];
        if (ehHeading(b) || pareceMarcadorLegenda(b)) break;
        if (!TIPOS_TEXTO_LEGENDA.has(b.type as string)) break;
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
export async function lerBodyDePagina(pageId: string): Promise<string | null> {
  return lerBodyCompletoDoPost(pageId);
}

/**
 * Lê o trecho do body da página entre o marcador `inicio` (exclusivo) e o fim
 * da seção. O fim é o que vier primeiro: o PRÓXIMO heading, ou um dos
 * marcadores extras em `fim`. Assim só pega o conteúdo daquela seção (o "box"),
 * sem vazar texto das seções seguintes do card do Notion.
 */
export async function lerSecaoEntre(
  pageId: string,
  inicio: string,
  fim: string[],
): Promise<string | null> {
  try {
    const blocks = await coletarBlocosRecursivo(pageId);
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[:.\s]+/g, ' ').trim();
    const inicioNorm = normalize(inicio);
    const fimNorm = fim.map(normalize);

    const idxInicio = blocks.findIndex((b) => {
      const t = normalize(rtTexto(b));
      return t.length > 0 && t.includes(inicioNorm);
    });
    if (idxInicio < 0) return null;

    const partes: string[] = [];
    for (let i = idxInicio + 1; i < blocks.length; i++) {
      const b = blocks[i];
      // Para no próximo heading — delimita a seção naturalmente.
      if (ehHeading(b)) break;
      const t = normalize(rtTexto(b));
      if (t && fimNorm.some((f) => t.includes(f))) break;
      const raw = rtTexto(b);
      if (raw) partes.push(raw);
    }
    const out = partes.join('\n').trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Lê uma seção do card do Notion identificada por seu heading, preservando
 * a estrutura de callouts/asides. Cada callout vira um MaterialBloco com
 * cabeçalho (texto da callout) + detalhes (parágrafos e bullets filhos).
 *
 * Busca recursiva pelo heading porque ele pode estar aninhado dentro de
 * tabs/colunas/sub-parágrafos do template do Notion.
 */
async function lerSecaoComCallouts(
  postId: string,
  trechoHeading: string,
): Promise<MaterialBloco[] | null> {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[:.\s]+/g, ' ').trim();
  const alvo = normalize(trechoHeading);

  // Formata o texto de um bloco filho preservando o sinal de lista quando
  // for um bullet/numbered_list_item.
  function formatarDetalhe(b: any): string {
    const t = rtTexto(b);
    if (!t) return '';
    if (b.type === 'bulleted_list_item') return `• ${t}`;
    if (b.type === 'numbered_list_item') return `– ${t}`;
    if (b.type === 'to_do') {
      const marcado = !!b.to_do?.checked;
      return `${marcado ? '☑' : '☐'} ${t}`;
    }
    return t;
  }

  async function extrairDeContainer(
    parentId: string,
    profundidade = 0,
  ): Promise<MaterialBloco[] | null> {
    if (profundidade > 5) return null;
    let blocos: any[];
    try {
      const r = await notion.blocks.children.list({
        block_id: parentId,
        page_size: 100,
      });
      blocos = r.results as any[];
    } catch {
      return null;
    }

    // 1) Achei o heading nesse nível? Pega siblings até o próximo heading.
    const idx = blocos.findIndex(
      (b) => normalize(rtTexto(b)).includes(alvo),
    );
    if (idx >= 0) {
      const out: MaterialBloco[] = [];
      for (let i = idx + 1; i < blocos.length; i++) {
        const b = blocos[i];
        if (ehHeading(b)) break;
        if (b.type !== 'callout' && b.type !== 'quote') continue;
        const cabecalho = rtTexto(b);
        const detalhes: string[] = [];
        if (b.has_children) {
          try {
            const filhos = await notion.blocks.children.list({
              block_id: b.id,
              page_size: 100,
            });
            for (const f of filhos.results as any[]) {
              const linha = formatarDetalhe(f);
              if (linha) detalhes.push(linha);
            }
          } catch {
            /* sem acesso aos filhos — ignora */
          }
        }
        // Ignora callout placeholder "Nada" / "—" / vazio
        const cabNorm = cabecalho.trim().toLowerCase();
        if (
          !cabecalho &&
          detalhes.length === 0
        )
          continue;
        if (
          (cabNorm === 'nada' || cabNorm === '—' || cabNorm === '-') &&
          detalhes.length === 0
        )
          continue;
        out.push({ cabecalho, detalhes });
      }
      return out.length > 0 ? out : null;
    }

    // 2) Não achei aqui — desce pra cada container filho
    for (const b of blocos) {
      if (b.has_children) {
        const r = await extrairDeContainer(b.id, profundidade + 1);
        if (r) return r;
      }
    }
    return null;
  }

  try {
    return await extrairDeContainer(postId);
  } catch {
    return null;
  }
}

const lerMateriaisNecessarios = (postId: string) =>
  lerSecaoComCallouts(postId, 'Materiais que precisamos');
const lerInformacoesNecessarias = (postId: string) =>
  lerSecaoComCallouts(postId, 'Informações que precisamos');

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

/**
 * Atualiza a legenda do post no Notion. Acha o marcador "Legenda" e substitui
 * os blocos da seção pelo texto novo (um único parágrafo com quebras de linha).
 * Lança erro se não encontrar a seção de legenda.
 */
export async function atualizarLegendaDoPost(
  postId: string,
  novaLegenda: string,
): Promise<void> {
  const texto = (novaLegenda ?? '').trim();
  const blocks = await coletarBlocosRecursivo(postId);

  const idxMarcador = blocks.findIndex(pareceMarcadorLegenda);
  if (idxMarcador < 0) {
    throw new Error('Não encontrei a seção de legenda nesse post.');
  }

  // Só consideramos blocos de TEXTO logo abaixo do marcador. Paramos no
  // primeiro bloco estrutural (heading, divider, tabs, colunas, etc) pra
  // nunca arquivar conteúdo que não seja a legenda.
  const TIPOS_TEXTO = new Set([
    'paragraph',
    'bulleted_list_item',
    'numbered_list_item',
    'quote',
    'to_do',
  ]);
  const legendaBlocks: any[] = [];
  for (let i = idxMarcador + 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (!TIPOS_TEXTO.has(b.type as string)) break;
    if (pareceMarcadorLegenda(b)) break;
    legendaBlocks.push(b);
  }

  if (legendaBlocks.length > 0) {
    const primeiro = legendaBlocks[0];
    const tipo = primeiro.type as string;
    await notion.blocks.update({
      block_id: primeiro.id,
      [tipo]: { rich_text: [{ type: 'text', text: { content: texto } }] },
    } as any);
    // A legenda nova fica toda no primeiro bloco — arquiva os parágrafos
    // de texto que sobraram da legenda antiga.
    for (let i = 1; i < legendaBlocks.length; i++) {
      try {
        await notion.blocks.delete({ block_id: legendaBlocks[i].id });
      } catch (err: any) {
        console.warn('[atualizarLegenda] falhou arquivar bloco:', err?.message);
      }
    }
  } else {
    throw new Error(
      'Não encontrei o texto da legenda pra editar. Avise a equipe da Lud.',
    );
  }
}

export async function getPostComDetalhes(postId: string): Promise<PostDetalhado | null> {
  try {
    const page = (await cachedPageRetrieve(postId)) as any;
    if (page.archived) return null;

    const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
    const projetoRel = getProp(page, env.notion.postProps.projeto)?.relation ?? [];
    const projetoId = projetoRel[0]?.id ?? null;
    const tarefasRel = getProp(page, env.notion.postProps.tarefas)?.relation ?? [];

    let projetoNome = 'Projeto';
    if (projetoId) {
      try {
        const proj = (await cachedPageRetrieve(projetoId)) as any;
        const projTitle = Object.values(proj.properties).find((p: any) => p.type === 'title') as any;
        projetoNome = txt(projTitle?.title) || 'Projeto';
      } catch {}
    }

    const formatoIds = (getProp(page, 'Formato')?.relation ?? []).map((r: any) => r.id);
    const funilIds = (getProp(page, 'Funil')?.relation ?? []).map((r: any) => r.id);
    const objetivoIds = (getProp(page, 'Objetivo')?.relation ?? []).map((r: any) => r.id);

    const [
      formato,
      funil,
      objetivo,
      formatoInfo,
      legenda,
      bodyCompleto,
      ideiaDoPost,
      materiaisNecessarios,
      informacoesNecessarias,
    ] = await Promise.all([
      resolveRelacoes(formatoIds),
      resolveRelacoes(funilIds),
      resolveRelacoes(objetivoIds),
      resolverFormato(formatoIds),
      lerLegendaDoPost(postId),
      lerBodyCompletoDoPost(postId),
      lerSecaoEntre(postId, 'Ideia do Post', []),
      lerMateriaisNecessarios(postId),
      lerInformacoesNecessarias(postId),
    ]);

    const formatoTipo: PostDetalhado['formatoTipo'] = formatoInfo?.tipo ?? 'desconhecido';

    const driveProp = getProp(page, env.notion.postProps.driveLink);
    const driveLinks: PostDetalhado['driveLinks'] = [];
    for (const f of driveProp?.files ?? []) {
      const url = f.type === 'external' ? f.external?.url : f.file?.url;
      if (url) driveLinks.push({ name: f.name ?? 'arquivo', url });
    }

    // Lookup O(1) num mapa pré-computado (era O(N) sobre clientes — gargalo).
    let aprovacaoColaborativa = false;
    if (projetoId) {
      try {
        const mapa = await getProjetoColaborativoMap();
        aprovacaoColaborativa = !!mapa[projetoId];
      } catch {
        /* mantém false */
      }
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
      ideiaDoPost,
      materiaisNecessarios,
      informacoesNecessarias,
      aprovacaoColaborativa,
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

/**
 * Prazo da nova tarefa, replicando a fórmula do Notion:
 *   se agora <= 10:30 hoje  → 17:00 hoje
 *   se agora <= 17:00 hoje  → 10:30 amanhã
 *   senão                   → 17:00 amanhã
 */
function calcularPrazoAposAlteracao(): string {
  const now = new Date();
  const inicioHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dezTrintaHoje = new Date(inicioHoje);
  dezTrintaHoje.setHours(10, 30, 0, 0);
  const dezesseteHoje = new Date(inicioHoje);
  dezesseteHoje.setHours(17, 0, 0, 0);
  if (now <= dezTrintaHoje) return dezesseteHoje.toISOString();
  if (now <= dezesseteHoje) {
    const amanha1030 = new Date(inicioHoje);
    amanha1030.setDate(amanha1030.getDate() + 1);
    amanha1030.setHours(10, 30, 0, 0);
    return amanha1030.toISOString();
  }
  const amanha17 = new Date(inicioHoje);
  amanha17.setDate(amanha17.getDate() + 1);
  amanha17.setHours(17, 0, 0, 0);
  return amanha17.toISOString();
}

const TEMPLATE_NOVA_TAREFA_ID = '15ed04d23b4a8039838bc3a57551fc08';

async function aplicarTemplateNovaTarefa(pageId: string): Promise<void> {
  try {
    const res = await notion.blocks.children.list({
      block_id: TEMPLATE_NOVA_TAREFA_ID,
      page_size: 100,
    });
    const SAFE_TYPES = new Set([
      'paragraph',
      'heading_1',
      'heading_2',
      'heading_3',
      'bulleted_list_item',
      'numbered_list_item',
      'to_do',
      'callout',
      'quote',
      'divider',
      'code',
    ]);
    const children: any[] = [];
    for (const b of res.results as any[]) {
      const tipo = b.type;
      if (!SAFE_TYPES.has(tipo)) continue;
      children.push({ object: 'block', type: tipo, [tipo]: b[tipo] });
    }
    if (children.length > 0) {
      await notion.blocks.children.append({ block_id: pageId, children });
    }
  } catch (err: any) {
    console.warn('[aplicarTemplate] falhou:', err?.message);
  }
}

async function getGestorDeProjeto(tarefaOriginal: any): Promise<string[]> {
  const projetoRel = getProp(tarefaOriginal, 'Projeto')?.relation ?? [];
  const projetoId = projetoRel[0]?.id;
  if (!projetoId) return [];
  try {
    const projeto = (await cachedPageRetrieve(projetoId)) as any;
    const people = getProp(projeto, 'Gestor de Projetos Resp')?.people ?? [];
    return people.map((p: any) => p.id);
  } catch (err: any) {
    console.warn('[getGestorDeProjeto] falhou:', err?.message);
    return [];
  }
}

function montarPropsHerdadas(
  tarefaOriginal: any,
  overrides: {
    titulo: string;
    ordemUm: string;
    maeId: string;
    postId: string;
    prazoIso: string;
    pessoaIds?: string[];
  },
): any {
  const props: any = {
    Tarefa: { title: [{ type: 'text', text: { content: overrides.titulo } }] },
    [env.notion.taskProps.status]: { status: { name: 'Iniciar' } },
    [env.notion.taskProps.post]: { relation: [{ id: overrides.postId }] },
    Mãe: { relation: [{ id: overrides.maeId }] },
    'Ordem (1)': { select: { name: overrides.ordemUm } },
    'Data Inicial': {
      date: { start: overrides.prazoIso, time_zone: 'America/Sao_Paulo' },
    },
    'Data Entrega': {
      date: { start: overrides.prazoIso, time_zone: 'America/Sao_Paulo' },
    },
  };

  for (const name of ['Projeto', 'Empresa', 'Serviço', 'Entregas', 'Time', 'Área']) {
    const rel = getProp(tarefaOriginal, name)?.relation;
    if (rel && rel.length > 0) {
      props[name] = { relation: rel.map((r: any) => ({ id: r.id })) };
    }
  }

  if (overrides.pessoaIds && overrides.pessoaIds.length > 0) {
    props['Pessoa'] = { people: overrides.pessoaIds.map((id) => ({ id })) };
  } else {
    const pessoa = getProp(tarefaOriginal, 'Pessoa')?.people;
    if (pessoa && pessoa.length > 0) {
      props['Pessoa'] = { people: pessoa.map((p: any) => ({ id: p.id })) };
    }
  }

  const ordem = getProp(tarefaOriginal, 'Ordem')?.select;
  if (ordem) props['Ordem'] = { select: { name: ordem.name } };

  const tipoOrig = getProp(tarefaOriginal, 'tipo original')?.select;
  if (tipoOrig) props['tipo original'] = { select: { name: tipoOrig.name } };

  return props;
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
  const baseNome = tarefaTitulo.replace(/^(Alteração|Aprovação) \| /, '');
  const prazoIso = calcularPrazoAposAlteracao();

  // 1. Reprova a tarefa atual + Finalizada em agora
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

  // 2. Pega o Gestor do projeto pra atribuir como Pessoa da tarefa Alteração
  const gestorIds = await getGestorDeProjeto(tarefa);

  // 3. Cria tarefa "Alteração | X" (Ordem (1) = 02, Mãe = tarefa original, Pessoa = gestor)
  let alteracaoId: string | null = null;
  try {
    const altRes = (await notion.pages.create({
      parent: { database_id: env.notion.tarefasDbId },
      properties: montarPropsHerdadas(tarefa, {
        titulo: `Alteração | ${baseNome}`,
        ordemUm: '02',
        maeId: tarefaId,
        postId,
        prazoIso,
        pessoaIds: gestorIds.length > 0 ? gestorIds : undefined,
      }),
    })) as any;
    alteracaoId = altRes.id;
    if (alteracaoId) await aplicarTemplateNovaTarefa(alteracaoId);
  } catch (err: any) {
    console.error('[pedirAlteracao] falhou criar Alteração:', err?.code, err?.message, err?.body);
  }

  // 4. Cria tarefa "Aprovação | X" (Ordem (1) = 03, Mãe = a Alteração recém-criada)
  if (alteracaoId) {
    try {
      const aprovRes = (await notion.pages.create({
        parent: { database_id: env.notion.tarefasDbId },
        properties: montarPropsHerdadas(tarefa, {
          titulo: `Aprovação | ${baseNome}`,
          ordemUm: '03',
          maeId: alteracaoId,
          postId,
          prazoIso,
        }),
      })) as any;
      if (aprovRes.id) await aplicarTemplateNovaTarefa(aprovRes.id);
    } catch (err: any) {
      console.error('[pedirAlteracao] falhou criar Aprovação:', err?.code, err?.message, err?.body);
    }
  }

  // 5. Comentário no post com o pedido
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

    const post = (await cachedPageRetrieve(postId)) as any;
    const projetoRel = getProp(post, env.notion.postProps.projeto)?.relation ?? [];
    const projetoId = projetoRel[0]?.id as string | undefined;

    const tarefaTitleProp = Object.values(tarefa.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const postTitleProp = Object.values(post.properties).find((p: any) => p.type === 'title') as any;

    let projetoNome = 'Projeto';
    if (projetoId) {
      try {
        const proj = (await cachedPageRetrieve(projetoId)) as any;
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
  const page = (await cachedPageRetrieve(projetoId)) as any;
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
  opts: { exigirPronto?: boolean } = {},
): Promise<{ tarefaId: string; titulo: string } | null> {
  const exigirPronto = opts.exigirPronto ?? true;
  const post = await getPost(postId);
  if (!post) return null;

  for (const tarefaId of post.tarefaIds) {
    try {
      const page = (await notion.pages.retrieve({ page_id: tarefaId })) as any;
      if (page.archived) continue;

      const status = getProp(page, env.notion.taskProps.status)?.status?.name ?? null;
      if (status && STATUS_TAREFA_FECHADOS.includes(status)) continue;

      if (exigirPronto) {
        const prontoProp = getProp(page, env.notion.taskProps.pronto);
        const isPronto =
          prontoProp?.formula?.type === 'boolean' &&
          prontoProp.formula.boolean === true;
        if (!isPronto) continue;
      }

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
  // Notion limita cada rich_text item em 2000 chars — quebramos em pedaços.
  const LIMITE = 1900;
  const pedacos: string[] = [];
  let resto = texto;
  while (resto.length > LIMITE) {
    let corte = resto.lastIndexOf('\n', LIMITE);
    if (corte < LIMITE / 2) corte = LIMITE;
    pedacos.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }
  if (resto.length > 0) pedacos.push(resto);

  await notion.comments.create({
    parent: { page_id: postId },
    rich_text: pedacos.map((p) => ({ type: 'text', text: { content: p } })),
  });
}

export type ComentarioPost = {
  id: string;
  texto: string;
  criadoEm: string;
};

/**
 * Lê o histórico de comentários do card do post no Notion (ordem cronológica).
 * Se a integração não tiver a permissão de ler comentários, retorna [].
 */
export async function lerComentariosDoPost(
  postId: string,
): Promise<ComentarioPost[]> {
  try {
    const out: ComentarioPost[] = [];
    let cursor: string | undefined;
    do {
      const res = await notion.comments.list({
        block_id: postId,
        start_cursor: cursor,
      });
      for (const c of res.results as any[]) {
        const texto = (c.rich_text ?? [])
          .map((r: any) => r.plain_text)
          .join('')
          .trim();
        if (texto) {
          out.push({ id: c.id, texto, criadoEm: c.created_time });
        }
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
    return out;
  } catch (err: any) {
    console.warn('[lerComentarios] falhou:', err?.message);
    return [];
  }
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

/**
 * Acrescenta um novo link no campo "Link do Google Drive" do post, sem
 * sobrescrever os links já existentes. Diferente de atualizarLinkDriveDoPost
 * que substitui tudo.
 */
export async function adicionarLinkDriveAoPost(
  postId: string,
  nome: string,
  url: string,
): Promise<void> {
  const page: any = await notion.pages.retrieve({ page_id: postId });
  const atual = page.properties?.[env.notion.postProps.driveLink]?.files ?? [];
  const novos = [
    ...atual.map((f: any) => {
      // Mantém o formato pra não quebrar — Notion exige type: 'external' ou 'file'
      if (f.type === 'external') {
        return { name: f.name, type: 'external', external: f.external };
      }
      // Files internos do Notion não dá pra reescrever em update, então
      // ignora — eles continuam lá só se mantermos como referência.
      return null;
    }).filter(Boolean),
    { name: nome, type: 'external', external: { url } },
  ];
  await notion.pages.update({
    page_id: postId,
    properties: {
      [env.notion.postProps.driveLink]: { files: novos },
    },
  });
}

// ===== Atualizações recentes (admin home) =====

export type AtualizacaoRecente = {
  id: string; // chave única (post:tipo:hash)
  tipo: 'edicao' | 'comentario' | 'tarefa';
  postId: string;
  postTitulo: string;
  projetoId: string | null;
  projetoNome: string | null;
  status: string | null;
  statusGeral: string | null;
  quando: string; // ISO
  resumo: string; // texto curto do evento
  tarefaTitulo?: string | null;
  tarefaStatus?: string | null;
};

/**
 * Lista as atualizações recentes consolidadas em 3 fontes:
 *   - edição do POST (last_edited_time da página de postagem)
 *   - edição de TAREFA ligada ao post (quando alguém aprova/conclui uma tarefa,
 *     o post em si não muda, mas a tarefa sim — esse é o sinal mais comum)
 *   - COMENTÁRIO novo no card do post
 *
 * O sort `last_edited_time` da API do Notion não é confiável em databases
 * grandes (2k+ itens) — retorna resultados fora de ordem. Então pegamos uma
 * janela razoável de cada banco e ordenamos LOCAL.
 */
async function _listAtualizacoesRecentesUncached(
  limit: number,
): Promise<AtualizacaoRecente[]> {
  const hoje = new Date();
  const janelaDias = 90;
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - janelaDias);
  const desdeISO = desde.toISOString().split('T')[0];

  // 1) Posts da janela
  const postsBruto: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.postagensDbId,
      page_size: 100,
      start_cursor: cursor,
      filter: {
        property: env.notion.postProps.data,
        date: { on_or_after: desdeISO },
      },
    });
    postsBruto.push(...(res.results as any[]));
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Mapa rápido de postId → metadata (titulo, projeto, status)
  const postMeta = new Map<
    string,
    {
      titulo: string;
      projetoId: string | null;
      status: string | null;
      statusGeral: string | null;
    }
  >();
  for (const page of postsBruto) {
    const tp = Object.values(page.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const projetoRel =
      getProp(page, env.notion.postProps.projeto)?.relation ?? [];
    const statusGeralProp = getProp(page, 'Status Geral');
    postMeta.set(page.id, {
      titulo: txt(tp?.title) || 'Post sem título',
      projetoId: projetoRel[0]?.id ?? null,
      status:
        getProp(page, env.notion.postProps.status)?.status?.name ?? null,
      statusGeral:
        statusGeralProp?.formula?.type === 'string'
          ? (statusGeralProp.formula.string ?? null)
          : null,
    });
  }

  // 2) Tarefas FINALIZADAS nos últimos 14 dias — sort por "Finalizada em" desc
  //    funciona bem mesmo em banco grande (o sort por last_edited_time não).
  //    Esse é o sinal MAIS importante: quando o cliente aprova arte, conclui
  //    materiais, etc., o "Finalizada em" da tarefa é preenchido.
  const desdeTarefas = new Date(hoje);
  desdeTarefas.setDate(desdeTarefas.getDate() - 14);
  const desdeTarefasISO = desdeTarefas.toISOString().split('T')[0];
  const tarefasBruto: any[] = [];
  let curT: string | undefined;
  do {
    const resT = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      page_size: 100,
      start_cursor: curT,
      filter: {
        property: env.notion.taskProps.finalizada,
        date: { on_or_after: desdeTarefasISO },
      },
      sorts: [
        { property: env.notion.taskProps.finalizada, direction: 'descending' },
      ],
    });
    tarefasBruto.push(...(resT.results as any[]));
    curT = resT.has_more ? resT.next_cursor ?? undefined : undefined;
    if (tarefasBruto.length >= 120) break; // suficiente pro feed
  } while (curT);
  const tarefasTop = tarefasBruto;

  // 3) Posts top (pelo last_edited_time do próprio post)
  const postsOrdenados = [...postsBruto].sort((a, b) =>
    (b.last_edited_time as string).localeCompare(a.last_edited_time as string),
  );
  const topPosts = postsOrdenados.slice(0, Math.max(15, Math.min(40, limit * 2)));

  // 4) Resolve nomes de projetos (uma pancada só) — junta os projetos
  //    referenciados em qualquer fonte
  const projetoIdsUnicos = new Set<string>();
  for (const m of postMeta.values()) if (m.projetoId) projetoIdsUnicos.add(m.projetoId);
  const projetoNomes = new Map<string, string>();
  await Promise.all(
    [...projetoIdsUnicos].map(async (id) => {
      try {
        const page: any = await cachedPageRetrieve(id);
        const tp = Object.values(page.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        projetoNomes.set(id, txt(tp?.title) || 'Projeto');
      } catch {
        projetoNomes.set(id, 'Projeto');
      }
    }),
  );

  const eventos: AtualizacaoRecente[] = [];

  // 5) Eventos de TAREFA — fonte principal de "o que mudou".
  //    quando = data em que foi marcada como Finalizada (mais semântico que
  //    last_edited_time, que pode oscilar por edições incidentais).
  for (const t of tarefasTop) {
    const postRel = getProp(t, env.notion.taskProps.post)?.relation ?? [];
    const postId = postRel[0]?.id ?? null;
    if (!postId) continue;
    const meta = postMeta.get(postId);
    if (!meta) continue; // post fora da janela — ignora
    const tp = Object.values(t.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const tarefaTitulo = txt(tp?.title) || 'Tarefa';
    const tarefaStatus =
      getProp(t, env.notion.taskProps.status)?.status?.name ?? null;
    const finalizadaEm =
      getProp(t, env.notion.taskProps.finalizada)?.date?.start ?? null;
    if (!finalizadaEm) continue;
    // Normaliza pra UTC (vem com timezone tipo -03:00) pra ordenar junto com
    // os outros eventos que vêm em UTC
    const quando = new Date(finalizadaEm).toISOString();
    eventos.push({
      id: `${postId}:tarefa:${t.id}`,
      tipo: 'tarefa',
      postId,
      postTitulo: meta.titulo,
      projetoId: meta.projetoId,
      projetoNome: meta.projetoId
        ? projetoNomes.get(meta.projetoId) ?? null
        : null,
      status: meta.status,
      statusGeral: meta.statusGeral,
      quando,
      resumo: tarefaStatus
        ? `${tarefaTitulo} → ${tarefaStatus}`
        : tarefaTitulo,
      tarefaTitulo,
      tarefaStatus,
    });
  }

  // 6) Eventos de EDIÇÃO direta do post + COMENTÁRIOS (em paralelo, em lotes)
  const lote = 5;
  for (let i = 0; i < topPosts.length; i += lote) {
    const fatia = topPosts.slice(i, i + lote);
    await Promise.all(
      fatia.map(async (page) => {
        const meta = postMeta.get(page.id);
        if (!meta) return;
        const lastEdited = page.last_edited_time as string;

        // 6a) Edição do próprio post
        eventos.push({
          id: `${page.id}:edicao:${lastEdited}`,
          tipo: 'edicao',
          postId: page.id,
          postTitulo: meta.titulo,
          projetoId: meta.projetoId,
          projetoNome: meta.projetoId
            ? projetoNomes.get(meta.projetoId) ?? null
            : null,
          status: meta.status,
          statusGeral: meta.statusGeral,
          quando: lastEdited,
          resumo: meta.statusGeral
            ? meta.statusGeral
            : meta.status ?? 'Post atualizado',
        });

        // 6b) Comentários (top 3 mais recentes)
        try {
          const comResp = await notion.comments.list({ block_id: page.id });
          const comentarios = (comResp.results as any[])
            .map((c) => ({
              id: c.id,
              texto: (c.rich_text ?? [])
                .map((r: any) => r.plain_text)
                .join('')
                .trim(),
              criadoEm: c.created_time as string,
            }))
            .filter((c) => c.texto.length > 0)
            .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
            .slice(0, 3);
          for (const c of comentarios) {
            const trecho =
              c.texto.length > 140 ? c.texto.slice(0, 140) + '…' : c.texto;
            eventos.push({
              id: `${page.id}:com:${c.id}`,
              tipo: 'comentario',
              postId: page.id,
              postTitulo: meta.titulo,
              projetoId: meta.projetoId,
              projetoNome: meta.projetoId
                ? projetoNomes.get(meta.projetoId) ?? null
                : null,
              status: meta.status,
              statusGeral: meta.statusGeral,
              quando: c.criadoEm,
              resumo: trecho,
            });
          }
        } catch {
          /* sem permissão de comentários — ignora */
        }
      }),
    );
  }

  // 7) Ordena tudo por data desc, dedup por (postId+tipo+resumo+quando) pra
  //    evitar barulho, e retorna top N
  eventos.sort((a, b) => b.quando.localeCompare(a.quando));
  const vistos = new Set<string>();
  const final: AtualizacaoRecente[] = [];
  for (const ev of eventos) {
    const chave = `${ev.postId}:${ev.tipo}:${ev.resumo}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    final.push(ev);
    if (final.length >= limit) break;
  }
  return final;
}

const _listAtualizacoesRecentesCached = unstable_cache(
  _listAtualizacoesRecentesUncached,
  ['list-atualizacoes-recentes-v5-finalizadas'],
  { revalidate: 30, tags: [TAG_POSTS, TAG_TAREFAS] }, // 30s
);

export async function listAtualizacoesRecentes(
  limit = 20,
): Promise<AtualizacaoRecente[]> {
  return _listAtualizacoesRecentesCached(limit);
}

// ============================================================================
// EQUIPE / PRESTADORES — páginas de produção dos colaboradores
// ============================================================================

export type ColaboradorResumo = {
  id: string;
  nome: string;
  funcao: string | null;
  email: string | null;
  whatsapp: string | null;
  pessoaUserId: string | null; // Notion User id pra filtrar tarefas
  pessoaNome: string | null;
};

async function _listColaboradoresUncached(): Promise<ColaboradorResumo[]> {
  const out: ColaboradorResumo[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.prestadoresDbId,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const page of res.results as any[]) {
      if (page.archived) continue;
      const tp = Object.values(page.properties).find(
        (p: any) => p.type === 'title',
      ) as any;
      const nome = txt(tp?.title) || '(sem nome)';
      const funcao =
        getProp(page, env.notion.prestadorProps.funcao)?.select?.name ?? null;
      const emailProp = getProp(page, env.notion.prestadorProps.email);
      // O campo "E-mail" às vezes é phone_number, às vezes email; cobre os 2
      const email =
        emailProp?.email ?? emailProp?.phone_number ?? null;
      const waProp = getProp(page, env.notion.prestadorProps.whatsapp);
      const whatsapp = waProp?.phone_number ?? waProp?.email ?? null;
      const pessoaRaw = getProp(page, env.notion.prestadorProps.pessoa)?.people ?? [];
      const pessoaUserId = pessoaRaw[0]?.id ?? null;
      const pessoaNome = pessoaRaw[0]?.name ?? null;
      out.push({
        id: page.id,
        nome,
        funcao,
        email,
        whatsapp,
        pessoaUserId,
        pessoaNome,
      });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const _listColaboradoresCached = unstable_cache(
  _listColaboradoresUncached,
  ['list-colaboradores-v1'],
  { revalidate: 300, tags: [TAG_EQUIPE] }, // 5 min
);

export async function listColaboradores(): Promise<ColaboradorResumo[]> {
  return _listColaboradoresCached();
}

export async function getColaboradorById(
  id: string,
): Promise<ColaboradorResumo | null> {
  const lista = await _listColaboradoresCached();
  return lista.find((c) => c.id === id || c.id.replace(/-/g, '') === id.replace(/-/g, '')) ?? null;
}

/**
 * Acha um colaborador pelo email (case-insensitive). Usado no login —
 * quando alguém de fora dos clientes tenta entrar, a gente verifica
 * se é um prestador cadastrado e libera.
 */
export async function getColaboradorByEmail(
  email: string,
): Promise<ColaboradorResumo | null> {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return null;
  const lista = await _listColaboradoresCached();
  return (
    lista.find((c) => (c.email ?? '').trim().toLowerCase() === alvo) ?? null
  );
}

// ============================================================================
// ACESSOS POR CLIENTE — banco "LudHub — Acessos por Cliente"
// Permite que múltiplos emails entrem no portal do mesmo cliente (clientes
// com time grande, tipo TKRA).
// ============================================================================

export type AcessoCliente = {
  id: string;
  email: string;
  nome: string | null;
  funcao: string | null;
  ativo: boolean;
};

export async function listAcessosDoCliente(
  clienteId: string,
): Promise<AcessoCliente[]> {
  try {
    const out: AcessoCliente[] = [];
    let cursor: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: env.notion.acessosDbId,
        start_cursor: cursor,
        page_size: 100,
        filter: {
          property: env.notion.acessoProps.cliente,
          relation: { contains: clienteId },
        },
      });
      for (const page of res.results as any[]) {
        const tProp = Object.values(page.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        const email = (txt(tProp?.title) || '').trim().toLowerCase();
        const nome =
          (getProp(page, env.notion.acessoProps.nome)?.rich_text ?? [])
            .map((r: any) => r.plain_text)
            .join('')
            .trim() || null;
        const funcao =
          (getProp(page, env.notion.acessoProps.funcao)?.rich_text ?? [])
            .map((r: any) => r.plain_text)
            .join('')
            .trim() || null;
        const ativoProp = getProp(page, env.notion.acessoProps.ativo);
        const ativo =
          ativoProp?.type === 'checkbox' ? !!ativoProp.checkbox : true;
        if (email) out.push({ id: page.id, email, nome, funcao, ativo });
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
    return out.sort((a, b) => a.email.localeCompare(b.email));
  } catch (err: any) {
    console.warn('[listAcessosDoCliente] falhou:', err?.message);
    return [];
  }
}

export async function criarAcesso(input: {
  clienteId: string;
  email: string;
  nome?: string;
  funcao?: string;
}): Promise<AcessoCliente> {
  const emailNorm = input.email.trim().toLowerCase();
  if (!emailNorm.includes('@')) {
    throw new Error('Email inválido');
  }
  const props: any = {
    [env.notion.acessoProps.email]: {
      title: [{ type: 'text', text: { content: emailNorm } }],
    },
    [env.notion.acessoProps.cliente]: {
      relation: [{ id: input.clienteId }],
    },
    [env.notion.acessoProps.ativo]: { checkbox: true },
  };
  if (input.nome) {
    props[env.notion.acessoProps.nome] = {
      rich_text: [{ type: 'text', text: { content: input.nome } }],
    };
  }
  if (input.funcao) {
    props[env.notion.acessoProps.funcao] = {
      rich_text: [{ type: 'text', text: { content: input.funcao } }],
    };
  }
  const page: any = await notion.pages.create({
    parent: { type: 'database_id', database_id: env.notion.acessosDbId },
    properties: props,
  });
  revalidateTag(TAG_CLIENTES);
  return {
    id: page.id,
    email: emailNorm,
    nome: input.nome ?? null,
    funcao: input.funcao ?? null,
    ativo: true,
  };
}

export async function removerAcesso(acessoId: string): Promise<void> {
  await notion.pages.update({ page_id: acessoId, archived: true });
  revalidateTag(TAG_CLIENTES);
}

// ---------- Tarefas de um colaborador ----------

export type TarefaColaborador = {
  tarefaId: string;
  tarefaTitulo: string;
  status: string | null;
  dataEntrega: string | null; // ISO date
  finalizadaEm: string | null; // ISO
  postId: string | null;
  postTitulo: string;
  projetoNome: string | null;
};

type ResumoProducao = {
  pendentes: TarefaColaborador[];
  concluidas: TarefaColaborador[];
};

async function _listProducaoDoColaboradorUncached(
  pessoaUserId: string,
): Promise<ResumoProducao> {
  const hoje = new Date();
  const desdeFinalizadas = new Date(hoje);
  desdeFinalizadas.setDate(desdeFinalizadas.getDate() - 14);
  const desdeFinalizadasISO = desdeFinalizadas.toISOString().split('T')[0];

  // 1) Pendentes: Pessoa = X AND Status != Concluído
  const pendentesBruto: any[] = [];
  let cur: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      page_size: 100,
      start_cursor: cur,
      filter: {
        and: [
          { property: 'Pessoa', people: { contains: pessoaUserId } },
          { property: env.notion.taskProps.status, status: { does_not_equal: 'Concluído' } },
        ],
      },
    });
    pendentesBruto.push(...(res.results as any[]));
    cur = res.has_more ? res.next_cursor ?? undefined : undefined;
    if (pendentesBruto.length >= 300) break;
  } while (cur);

  // 2) Concluídas nos últimos 14 dias
  const concluidasBruto: any[] = [];
  let cur2: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      page_size: 100,
      start_cursor: cur2,
      filter: {
        and: [
          { property: 'Pessoa', people: { contains: pessoaUserId } },
          { property: env.notion.taskProps.finalizada, date: { on_or_after: desdeFinalizadasISO } },
        ],
      },
      sorts: [
        { property: env.notion.taskProps.finalizada, direction: 'descending' },
      ],
    });
    concluidasBruto.push(...(res.results as any[]));
    cur2 = res.has_more ? res.next_cursor ?? undefined : undefined;
    if (concluidasBruto.length >= 100) break;
  } while (cur2);

  // 3) Coleta IDs dos posts pra fazer lookup do título + projeto em batch
  const postIds = new Set<string>();
  for (const t of [...pendentesBruto, ...concluidasBruto]) {
    const postRel = getProp(t, env.notion.taskProps.post)?.relation ?? [];
    if (postRel[0]?.id) postIds.add(postRel[0].id);
  }
  type PostInfo = { titulo: string; projetoId: string | null };
  const postInfo = new Map<string, PostInfo>();
  await Promise.all(
    [...postIds].map(async (pid) => {
      try {
        const p: any = await cachedPageRetrieve(pid);
        const tp = Object.values(p.properties).find(
          (x: any) => x.type === 'title',
        ) as any;
        const projetoRel =
          getProp(p, env.notion.postProps.projeto)?.relation ?? [];
        postInfo.set(pid, {
          titulo: txt(tp?.title) || 'Post sem título',
          projetoId: projetoRel[0]?.id ?? null,
        });
      } catch {
        postInfo.set(pid, { titulo: 'Post', projetoId: null });
      }
    }),
  );

  // 4) Coleta nomes dos projetos
  const projetoIds = new Set<string>();
  for (const info of postInfo.values()) if (info.projetoId) projetoIds.add(info.projetoId);
  const projetoNomes = new Map<string, string>();
  await Promise.all(
    [...projetoIds].map(async (pid) => {
      try {
        const p: any = await cachedPageRetrieve(pid);
        const tp = Object.values(p.properties).find(
          (x: any) => x.type === 'title',
        ) as any;
        projetoNomes.set(pid, txt(tp?.title) || 'Projeto');
      } catch {
        projetoNomes.set(pid, 'Projeto');
      }
    }),
  );

  const monta = (t: any): TarefaColaborador => {
    const tp = Object.values(t.properties).find(
      (x: any) => x.type === 'title',
    ) as any;
    const tarefaTitulo = txt(tp?.title) || 'Tarefa';
    const status =
      getProp(t, env.notion.taskProps.status)?.status?.name ?? null;
    const dataEntrega =
      getProp(t, 'Data Entrega')?.date?.start ??
      getProp(t, 'Data Inicial')?.date?.start ??
      null;
    const finalizadaEm =
      getProp(t, env.notion.taskProps.finalizada)?.date?.start ?? null;
    const postRel = getProp(t, env.notion.taskProps.post)?.relation ?? [];
    const postId = postRel[0]?.id ?? null;
    const pInfo = postId ? postInfo.get(postId) : null;
    return {
      tarefaId: t.id,
      tarefaTitulo,
      status,
      dataEntrega,
      finalizadaEm,
      postId,
      postTitulo: pInfo?.titulo ?? '',
      projetoNome: pInfo?.projetoId
        ? projetoNomes.get(pInfo.projetoId) ?? null
        : null,
    };
  };

  const pendentes = pendentesBruto
    .map(monta)
    .filter((t) => t.postId) // só tarefas ligadas a um post
    .sort((a, b) => {
      // Sem data vai pro fim
      if (!a.dataEntrega && !b.dataEntrega) return 0;
      if (!a.dataEntrega) return 1;
      if (!b.dataEntrega) return -1;
      return a.dataEntrega.localeCompare(b.dataEntrega);
    });

  const concluidas = concluidasBruto
    .map(monta)
    .filter((t) => t.postId)
    .sort((a, b) => (b.finalizadaEm ?? '').localeCompare(a.finalizadaEm ?? ''));

  return { pendentes, concluidas };
}

const _listProducaoDoColaboradorCached = unstable_cache(
  _listProducaoDoColaboradorUncached,
  ['list-producao-colaborador-v1'],
  { revalidate: 60, tags: [TAG_EQUIPE, TAG_TAREFAS] }, // 1 min
);

export async function listProducaoDoColaborador(
  pessoaUserId: string,
): Promise<ResumoProducao> {
  return _listProducaoDoColaboradorCached(pessoaUserId);
}
