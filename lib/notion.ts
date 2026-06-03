import { Client } from '@notionhq/client';
import { unstable_cache, revalidateTag } from 'next/cache';
import { env } from './env';

// Tags pra cache do Next — usadas pra invalidar quando algo muda no Notion
const TAG_TAREFAS = 'tarefas-pendentes';
const TAG_POSTS = 'posts-do-mes';
const TAG_RESUMO = 'resumo-clientes';
const TAG_CLIENTES = 'clientes';

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
const tarefasPorCategoriaCache = makeCache<PostsAgrupadosPorCategoria>(30_000);
const postsDoMesCache = makeCache<PostCalendario[]>(30_000);

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
      out.push({
        id: page.id,
        nome,
        email,
        projetoCount: projetos.length,
      });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out
    .filter((c) => !!c.email)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const _listAllClientesCached = unstable_cache(
  _listAllClientesUncached,
  ['list-all-clientes-v3-ativos'],
  { revalidate: 300, tags: [TAG_CLIENTES] }, // 5 min
);

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
    return { id: page.id, nome, email, projetoCount: projetos.length };
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
export async function listAllProjetos(): Promise<ProjetoListItem[]> {
  const clientes = await listAllClientes();
  const porCliente = await Promise.all(
    clientes.map(async (c) => {
      const ids = await getProjetosDoCliente(c.id);
      return { clienteId: c.id, clienteNome: c.nome, ids };
    }),
  );
  const vistos = new Set<string>();
  const out: ProjetoListItem[] = [];
  for (const { clienteId, clienteNome, ids } of porCliente) {
    for (const id of ids) {
      if (vistos.has(id)) continue;
      vistos.add(id);
      try {
        const proj = (await cachedPageRetrieve(id)) as any;
        if (proj.archived) continue;
        const tp = Object.values(proj.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        const status =
          getProp(proj, 'Status Manual')?.select?.name ??
          getProp(proj, 'Status')?.status?.name ??
          null;
        out.push({
          id,
          nome: txt(tp?.title) || 'Projeto',
          status,
          clienteId,
          clienteNome,
        });
      } catch {}
    }
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
export async function getProjetoDetalhe(
  projetoId: string,
): Promise<ProjetoDetalhe | null> {
  try {
    const proj = (await cachedPageRetrieve(projetoId)) as any;
    if (proj.archived) return null;

    const tp = Object.values(proj.properties).find(
      (p: any) => p.type === 'title',
    ) as any;
    const nome = txt(tp?.title) || 'Projeto';
    const status =
      getProp(proj, 'Status Manual')?.select?.name ??
      getProp(proj, 'Status')?.status?.name ??
      null;
    const gestor = getProp(proj, 'Gestor de Projetos Resp')?.people?.[0]?.name ?? null;

    let clienteNome: string | null = null;
    const crm = getProp(proj, 'CRM')?.relation ?? [];
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
    const res = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      page_size: 100,
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
    for (const t of res.results as any[]) {
      const ttp = Object.values(t.properties).find(
        (p: any) => p.type === 'title',
      ) as any;
      tarefas.push({
        id: t.id,
        titulo: txt(ttp?.title) || 'Tarefa',
        pessoa: getProp(t, 'Pessoa')?.people?.[0]?.name ?? null,
      });
    }

    const config = await getProjetoConfig(projetoId);
    return { id: projetoId, nome, status, clienteNome, gestor, config, tarefas };
  } catch {
    return null;
  }
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
  ['projetos-by-email-v2'],
  { revalidate: 300, tags: [TAG_CLIENTES] }, // 5 min
);

export async function findProjetosByEmail(email: string): Promise<ProjetoCliente[]> {
  const emailNorm = email.trim().toLowerCase();
  return projetosByEmailCache.get(emailNorm, () => _findProjetosByEmailCached(emailNorm));
}

async function findProjetosByEmailUncached(emailNorm: string): Promise<ProjetoCliente[]> {
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
export async function getEntregaDetalhe(entregaId: string): Promise<EntregaDetalhe | null> {
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

    // Resolve post/projeto/cliente em lotes, pra não estourar o rate limit.
    const tarefasRelacionadas: TarefaDaEntrega[] = [];
    const LOTE = 15;
    for (let i = 0; i < tarefasAbertas.length; i += LOTE) {
      const lote = tarefasAbertas.slice(i, i + LOTE);
      const resolvidas = await Promise.all(
        lote.map(async (t: any): Promise<TarefaDaEntrega | null> => {
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

            let postTitulo: string | null = null;
            if (postRel[0]) {
              try {
                const p = (await cachedPageRetrieve(postRel[0].id)) as any;
                const ptp = Object.values(p.properties).find(
                  (x: any) => x.type === 'title',
                ) as any;
                postTitulo = txt(ptp?.title) || null;
              } catch {}
            }

            let projetoNome: string | null = null;
            let clienteNome: string | null = null;
            if (projetoRel[0]) {
              try {
                const proj = (await cachedPageRetrieve(projetoRel[0].id)) as any;
                const ptp = Object.values(proj.properties).find(
                  (x: any) => x.type === 'title',
                ) as any;
                projetoNome = txt(ptp?.title) || null;
                const clienteRel = proj.properties.Cliente?.relation ?? [];
                if (clienteRel[0]) {
                  try {
                    const cli = (await cachedPageRetrieve(clienteRel[0].id)) as any;
                    const ctp = Object.values(cli.properties).find(
                      (x: any) => x.type === 'title',
                    ) as any;
                    clienteNome = txt(ctp?.title) || null;
                  } catch {}
                }
              } catch {}
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
      for (const r of resolvidas) if (r) tarefasRelacionadas.push(r);
    }

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

    const [formato, funil, objetivo, formatoInfo, legenda, bodyCompleto, ideiaDoPost] =
      await Promise.all([
        resolveRelacoes(formatoIds),
        resolveRelacoes(funilIds),
        resolveRelacoes(objetivoIds),
        resolverFormato(formatoIds),
        lerLegendaDoPost(postId),
        lerBodyCompletoDoPost(postId),
        lerSecaoEntre(postId, 'Ideia do Post', []),
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
      ideiaDoPost,
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

  // 2) Tarefas — busca um lote recente e ordena local. Como o sort do Notion
  //    pode falhar, fazemos paginação limitada e ordenamos no nó.
  const tarefasBruto: any[] = [];
  let curT: string | undefined;
  let paginas = 0;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      page_size: 100,
      start_cursor: curT,
    });
    tarefasBruto.push(...(res.results as any[]));
    curT = res.has_more ? res.next_cursor ?? undefined : undefined;
    paginas++;
    // cap em 8 páginas (800 tarefas) — suficiente pra cobrir alguns dias
    if (paginas >= 8) break;
  } while (curT);
  tarefasBruto.sort((a, b) =>
    (b.last_edited_time as string).localeCompare(a.last_edited_time as string),
  );
  // Tarefas top — pega umas 80 mais recentes pra ter material pro feed
  const tarefasTop = tarefasBruto.slice(0, 80);

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

  // 5) Eventos de TAREFA — fonte principal de "o que mudou"
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
    const quando = t.last_edited_time as string;
    eventos.push({
      id: `${postId}:tarefa:${t.id}:${quando}`,
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
  ['list-atualizacoes-recentes-v4-tarefas'],
  { revalidate: 30, tags: [TAG_POSTS, TAG_TAREFAS] }, // 30s
);

export async function listAtualizacoesRecentes(
  limit = 20,
): Promise<AtualizacaoRecente[]> {
  return _listAtualizacoesRecentesCached(limit);
}
