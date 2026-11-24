import { waitUntil } from '@vercel/functions';
import { Client } from '@notionhq/client';
import { fetchDoNotion } from './notionFetch';
import { unstable_cache, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { env } from './env';
import { lerProjetosOcultosDoCliente } from './supabase';
import {
  ehPostDoPortal,
  ehTarefaDoPortal,
  getPostDoPortal,
  getTarefaDoPortal,
  listarTarefasDoPortal,
  listarPostsDoPortal,
  listarProjetosDoPortal,
  atualizarPostDoPortal,
  atualizarTarefaDoPortal,
  concluirTarefaDoPortal,
  reabrirTarefaDoPortal,
  comentarPostDoPortal,
  lerComentariosDoPortal,
  criarTarefas as criarTarefasDoPortal,
  tarefaAberta as tarefaDoPortalAberta,
  tarefaDoClienteAgora,
  paraPostDetalhado,
  paraTarefaDoPost,
  paraTarefaPendente,
  type PostPortal,
  type TarefaPortal,
} from './conteudo-portal';

// Tags pra cache do Next — usadas pra invalidar quando algo muda no Notion
const TAG_TAREFAS = 'tarefas-pendentes';
const TAG_POSTS = 'posts-do-mes';
const TAG_RESUMO = 'resumo-clientes';
const TAG_CLIENTES = 'clientes';
const TAG_EQUIPE = 'equipe-prestadores';
const TAG_PROJETOS_OCULTOS = 'projetos-ocultos-do-cliente';

/**
 * Invalida os caches do Next.js relacionados a dados que mudaram.
 * Chamado depois de aprovar, pedir alteração ou enviar material.
 */
/** Usado pelo aquecimento depois de uma mudança: apaga de novo só as tags, sem reaquecer em loop. */
export function apagarTagsDoDia() {
  revalidateTag(TAG_TAREFAS);
  revalidateTag(TAG_POSTS);
}

export function invalidarCachesAposMudanca() {
  revalidateTag(TAG_TAREFAS);
  revalidateTag(TAG_POSTS);
  revalidateTag(TAG_RESUMO);
  // Também limpa nossos memory caches
  tarefasPorCategoriaCache.invalidate();
  postsDoMesCache.invalidate();
  try {
    cookies().set('lud_mudou', String(Date.now()), { maxAge: 120, path: '/' });
    // Prévias de post: quem acabou de mexer vê a versão nova (o Atualizar apaga esse, porque já recarrega tudo).
    cookies().set('lud_post_mudou', String(Date.now()), { maxAge: 120, path: '/' });
  } catch {}
  reaquecerTelasInternas();
}

/** Quem acabou de mexer (cookie de 2 min) vê sempre a versão nova, sem a reserva. */
function acabouDeMudar(): boolean {
  try {
    const v = Number(cookies().get('lud_mudou')?.value ?? 0);
    return Date.now() - v < 120_000;
  } catch {
    return false;
  }
}

/**
 * Tarefas concluídas nos últimos 3 min por quem está usando. O Notion às vezes
 * ainda devolve a tarefa como aberta logo depois de concluir; com isso ela some na hora.
 */
const COOKIE_FEITAS = 'lud_feitas';
function lerFeitasRecentes(): Set<string> {
  try {
    const bruto = JSON.parse(decodeURIComponent(cookies().get(COOKIE_FEITAS)?.value ?? '[]')) as [string, number][];
    return new Set(bruto.filter(([, t]) => Date.now() - t < 180_000).map(([id]) => id.replace(/-/g, '')));
  } catch {
    return new Set();
  }
}
function marcarFeitaRecente(tarefaId: string) {
  try {
    const bruto = (JSON.parse(decodeURIComponent(cookies().get(COOKIE_FEITAS)?.value ?? '[]')) as [string, number][]).filter(([, t]) => Date.now() - t < 180_000);
    bruto.push([tarefaId.replace(/-/g, ''), Date.now()]);
    cookies().set(COOKIE_FEITAS, encodeURIComponent(JSON.stringify(bruto.slice(-40))), { maxAge: 180, path: '/' });
  } catch {}
}

/**
 * Depois de uma mudança, refaz o cache das telas internas em segundo plano
 * (/api/cron/aquecer-admin), pra próxima página não esperar o Notion.
 * No máximo uma vez a cada 30 s por servidor.
 */
let ultimoReaquecimento = 0;
function reaquecerTelasInternas() {
  const secret = process.env.CRON_SECRET;
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.NEXT_PUBLIC_APP_URL;
  if (!secret || !base || Date.now() - ultimoReaquecimento < 30_000) return;
  ultimoReaquecimento = Date.now();
  // Espera 5 s pra pegar o Notion já com a mudança gravada.
  const p = new Promise((r) => setTimeout(r, 5000)).then(() =>
    fetch(`${base}/api/cron/aquecer-admin?invalidar=1`, { headers: { authorization: `Bearer ${secret}` }, cache: 'no-store' }).catch(() => null),
  );
  try {
    waitUntil(p);
  } catch {}
}

/**
 * Botão "Atualizar": relê na hora o que muda o tempo todo (tarefas, posts,
 * páginas). Listas de clientes, projetos e equipe ficam (renovam sozinhas a
 * cada 5 min, sem travar a tela) — jogar elas fora deixava a próxima página
 * lenta, refazendo uma consulta por cliente.
 */
export function invalidarDadosDoDia() {
  invalidarCachesAposMudanca();
  pageCache.clear();
}

/**
 * Limpa TODOS os caches — /api/sincronizar e o GET de /api/admin/atualizar.
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

const _notionRaw = new Client({ auth: env.notion.token, fetch: fetchDoNotion as any });

/**
 * Wrapper de retry em torno das operações do Notion mais usadas.
 *
 * O Notion devolve 503 (PgPoolWaitConnectionTimeout) ou 429 (rate limit) em
 * picos de tráfego do lado deles. Antes, qualquer 503 quebrava a página com
 * "Application error: server-side exception". Agora retentamos até 4× com
 * backoff exponencial + jitter (200ms, 500ms, 1.2s, 3s).
 */
async function comRetry<T>(fn: () => Promise<T>, max = 4, rotulo = 'notion'): Promise<T> {
  const delays = [200, 500, 1200, 3000];
  let ultimoErro: any;
  const inicio = Date.now();
  for (let tent = 0; tent <= max; tent++) {
    try {
      const r = await fn();
      // Medição de lentidão: aparece nos logs da Vercel (consulta lenta ou que precisou repetir).
      const ms = Date.now() - inicio;
      if (ms > 1500 || tent > 0) console.warn(`[notion-lento] ${rotulo} ${ms}ms${tent ? ` (${tent + 1} tentativas)` : ''}`);
      return r;
    } catch (err: any) {
      ultimoErro = err;
      const code = err?.code as string | undefined;
      const status = err?.status as number | undefined;
      const retriavel =
        code === 'service_unavailable' ||
        code === 'rate_limited' ||
        status === 503 ||
        status === 429 ||
        status === 502 ||
        status === 504;
      if (!retriavel || tent === max) throw err;
      const base = delays[Math.min(tent, delays.length - 1)];
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, base + jitter));
    }
  }
  throw ultimoErro;
}

/**
 * Cliente Notion com retry automático nas 3 operações que a gente mais usa
 * (query/retrieve/blocks). Outras operações (create, update, etc) seguem
 * direto sem retry — assumem que a chamada é deliberada e o erro propaga.
 */
// Tarefas "tipo Post" (tipo original = POST) são configuração interna do
// Notion e não entram no portal: toda consulta à base de Tarefas as exclui.
const SEM_TAREFAS_DE_POST = {
  or: [
    { property: 'tipo original', select: { does_not_equal: 'POST' } },
    { property: 'tipo original', select: { is_empty: true } },
  ],
};

export function semTarefasDePost(args: any): any {
  if (args?.database_id !== env.notion.tarefasDbId) return args;
  const f = args.filter;
  if (!f) return { ...args, filter: SEM_TAREFAS_DE_POST };
  if (Array.isArray(f.and)) return { ...args, filter: { ...f, and: [...f.and, SEM_TAREFAS_DE_POST] } };
  return { ...args, filter: { and: [f, SEM_TAREFAS_DE_POST] } };
}

/**
 * Tarefas "tipo Entrega" (tipo original = ENTREGA, a tarefa-mãe que junta as
 * filhas, ex.: "Calendário outubro") também não aparecem no portal. O filtro do
 * Notion não aceita mais um nível de "ou", então tiramos do resultado.
 */
function semTarefasDeEntrega<R>(r: R): R {
  const lista = (r as any)?.results;
  if (!Array.isArray(lista)) return r;
  const filtrada = lista.filter((pg: any) => pg?.properties?.['tipo original']?.select?.name !== 'ENTREGA');
  return filtrada.length === lista.length ? r : ({ ...(r as any), results: filtrada } as R);
}

/**
 * Mede quanto uma leitura grande leva quando NÃO está no cache (o que roda
 * dentro do unstable_cache). Aparece nos logs da Vercel como [tempo].
 */
/**
 * Cache com reserva. Igual ao unstable_cache, mas quando o cache principal foi
 * apagado por uma mudança (concluir, enviar, Atualizar) e o Notion demora, devolve
 * em 1,5 s a última versão guardada (reserva, renova sozinha a cada 2 min) em vez
 * de travar a página 15 s. A consulta nova continua rodando e entra no cache.
 */
function cacheComReserva<A extends any[], R>(
  fn: (...args: A) => Promise<R>,
  chave: string[],
  opcoes: { revalidate: number; tags?: string[] },
): (...args: A) => Promise<R> {
  const principal = unstable_cache(fn, chave, opcoes);
  const reserva = unstable_cache(fn, [...chave, 'reserva'], { revalidate: 120 });
  return async (...args: A) => {
    if (acabouDeMudar()) return principal(...args);
    const p = principal(...args);
    const rapido = await Promise.race([p.then((v) => ({ v })), new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
    if (rapido) return rapido.v;
    try {
      waitUntil(p.catch(() => null));
    } catch {}
    const r = reserva(...args);
    // O que chegar primeiro: a reserva (quase sempre na hora) ou a consulta nova.
    return Promise.any([r, p]).catch(() => p);
  };
}

function medido<A extends any[], R>(nome: string, fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    const inicio = Date.now();
    try {
      return await fn(...args);
    } finally {
      const ms = Date.now() - inicio;
      if (ms > 800) console.warn(`[tempo] ${nome} ${ms}ms (sem cache)`);
    }
  };
}

/** Nome curto da base pros logs de lentidão. */
function nomeDaBase(id: string | undefined): string {
  if (!id) return '?';
  const n = (x: string | undefined) => (x ?? '').replace(/-/g, '');
  const i = n(id);
  if (i === n(env.notion.tarefasDbId)) return 'Tarefas';
  if (i === n(env.notion.postagensDbId)) return 'Postagens';
  if (i === n(env.notion.projetosDbId)) return 'Projetos';
  if (i === n(env.notion.clientesDbId)) return 'Clientes';
  return i.slice(0, 6);
}

const notion = {
  ..._notionRaw,
  databases: {
    ..._notionRaw.databases,
    query: ((args: any) =>
      comRetry(
        () => _notionRaw.databases.query(semTarefasDePost(args)).then(semTarefasDeEntrega),
        4,
        `query ${nomeDaBase(args?.database_id)}${args?.start_cursor ? ' (próxima página)' : ''}`,
      )) as typeof _notionRaw.databases.query,
    retrieve: ((args: any) =>
      comRetry(() =>
        _notionRaw.databases.retrieve(args),
      )) as typeof _notionRaw.databases.retrieve,
    update: _notionRaw.databases.update.bind(_notionRaw.databases),
    create: _notionRaw.databases.create.bind(_notionRaw.databases),
  },
  pages: {
    ..._notionRaw.pages,
    retrieve: ((args: any) =>
      comRetry(() => _notionRaw.pages.retrieve(args), 4, 'página')) as typeof _notionRaw.pages.retrieve,
    update: _notionRaw.pages.update.bind(_notionRaw.pages),
    create: _notionRaw.pages.create.bind(_notionRaw.pages),
  },
  blocks: {
    ..._notionRaw.blocks,
    children: {
      ..._notionRaw.blocks.children,
      list: ((args: any) =>
        comRetry(() => _notionRaw.blocks.children.list(args), 4, 'blocos')) as typeof _notionRaw.blocks.children.list,
      append: _notionRaw.blocks.children.append.bind(_notionRaw.blocks.children),
    },
    update: _notionRaw.blocks.update.bind(_notionRaw.blocks),
    delete: _notionRaw.blocks.delete.bind(_notionRaw.blocks),
  },
  comments: _notionRaw.comments,
  users: _notionRaw.users,
  search: _notionRaw.search.bind(_notionRaw),
};

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
  /** Aprovação nova depois de uma alteração (Ordem (1) = 03). */
  reaprovacao?: boolean;
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
    label: 'Aprovar tema',
    tituloLongo: 'Aprovação de Tema',
    descSing: 'tema aguardando aprovação.',
    descPlur: 'temas aguardando aprovação.',
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

const _listAllClientesCached = cacheComReserva(
  medido('lista de clientes', _listAllClientesUncached),
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

/**
 * Guarda na memória por 5 min o resultado de uma lista que todo mundo usa. Precisa porque
 * dentro de um cache do Next (ex.: a prévia guardada do post) os caches de dentro são ignorados
 * e a lista seria lida do Notion de novo a cada post.
 */
function naMemoria<R>(fn: () => Promise<R>, ms = 300_000): () => Promise<R> {
  let guardado: { em: number; p: Promise<R> } | null = null;
  return () => {
    if (guardado && Date.now() - guardado.em < ms) return guardado.p;
    const p = fn();
    guardado = { em: Date.now(), p };
    p.catch(() => {
      guardado = null;
    });
    return p;
  };
}

const _colaborativoNaMemoria = naMemoria(() => _getProjetoColaborativoMapCached());
export async function getProjetoColaborativoMap(): Promise<
  Record<string, boolean>
> {
  return _colaborativoNaMemoria();
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
            getProp(proj, 'Status Manual')?.status?.name ??
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
        // "Status Manual" no Notion é tipo `status` (Novo / Ativo / Concluído)
        const status =
          getProp(proj, 'Status Manual')?.status?.name ??
          getProp(proj, 'Status')?.status?.name ??
          null;
        // Só projetos Ativos aparecem por padrão (esconde Concluído e Novo).
        if (status !== 'Ativo') return null;
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

const _listAllProjetosCached = cacheComReserva(
  medido('lista de projetos', _listAllProjetosUncached),
  ['list-all-projetos-v2-ativos'],
  { revalidate: 300, tags: [TAG_CLIENTES] }, // 5 min — bate com clientes
);

export async function listAllProjetos(): Promise<ProjetoListItem[]> {
  return _listAllProjetosCached();
}

/**
 * Capa da página do projeto no Notion (a mesma que aparece lá em cima no
 * Notion). Imagem enviada pro Notion vem com link assinado que expira em 1h,
 * por isso o cache é de 30 min. Retorna null se o projeto não tiver capa.
 */
const _capaDoProjetoCached = unstable_cache(
  async (projetoId: string): Promise<string | null> => {
    try {
      const p = (await notion.pages.retrieve({ page_id: projetoId })) as any;
      const c = p?.cover;
      if (!c) return null;
      return c.type === 'external' ? c.external?.url ?? null : c.file?.url ?? null;
    } catch {
      return null;
    }
  },
  ['capa-projeto-notion-v1'],
  { revalidate: 1800 },
);

export async function getCapaDoProjetoNotion(projetoId: string): Promise<string | null> {
  return _capaDoProjetoCached(projetoId);
}

/**
 * Lê a propriedade "Time" do projeto no Notion — é o horário de postagem do
 * cliente, em texto livre ("12h", "6H55", "10h30"). A programação usa isso pra
 * pré-preencher o horário (com 5 min de antecedência). Retorna a string crua
 * (sem parse) ou null se não tiver.
 */
export async function getHorarioDoProjeto(projetoId: string): Promise<string | null> {
  try {
    const proj = (await cachedPageRetrieve(projetoId)) as any;
    return txt(getProp(proj, 'Time')?.rich_text) || null;
  } catch {
    return null;
  }
}

export type ProjetoDetalhe = {
  id: string;
  nome: string;
  status: string | null;
  clienteNome: string | null;
  gestor: string | null;
  config: ProjetoConfig;
  tarefas: TarefaDoProjeto[];
};

export type TarefaDoProjeto = {
  id: string;
  titulo: string;
  pessoa: string | null;
  /** Foto do responsável no Notion (quando a busca traz). */
  pessoaAvatar?: string | null;
  status: string | null;
  /** Data Entrega (ou Data Inicial) no fuso de São Paulo, YYYY-MM-DD. */
  prazo: string | null;
  postId: string | null;
  postTitulo: string | null;
  postData: string | null;
  /** "Ordem" e "Ordem (1)" do Notion: a ordem do processo dentro do post. */
  ordem?: string | null;
  ordemUm?: string | null;
  /** Entrega do Notion a que a tarefa pertence (página /admin/entregas/[id]). */
  entregaId?: string | null;
};

/** Título e data dos posts recentes do projeto, numa consulta só. */
async function titulosDosPostsDoProjeto(
  projetoId: string,
): Promise<Map<string, { titulo: string; data: string | null }>> {
  const out = new Map<string, { titulo: string; data: string | null }>();
  const desde = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  let cursor: string | undefined;
  try {
    do {
      const r = await notion.databases.query({
        database_id: env.notion.postagensDbId,
        page_size: 100,
        start_cursor: cursor,
        filter: {
          and: [
            { property: env.notion.postProps.projeto, relation: { contains: projetoId } },
            { property: env.notion.postProps.data, date: { on_or_after: desde } },
          ],
        },
      });
      for (const p of r.results as any[]) {
        const tp = Object.values(p.properties).find((x: any) => x.type === 'title') as any;
        out.set(p.id, {
          titulo: txt(tp?.title) || 'Post sem título',
          data: getProp(p, env.notion.postProps.data)?.date?.start ?? null,
        });
      }
      cursor = r.has_more ? r.next_cursor ?? undefined : undefined;
    } while (cursor && out.size < 500);
  } catch (err: any) {
    console.warn('[projeto] títulos dos posts:', err?.message);
  }
  return out;
}

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
              // Projetos antigos acumulam centenas de tarefas abertas esquecidas
              // (2025, título "Post"); só interessa o que vence de 90 dias pra cá.
              // Tarefa que não é de post (e-book, site, reunião…) entra mesmo mais
              // antiga: costuma ser pouca e é justamente o que ficou pra trás.
              {
                or: [
                  {
                    property: 'Data Entrega',
                    date: {
                      on_or_after: new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
                    },
                  },
                  { property: env.notion.taskProps.post, relation: { is_empty: true } },
                ],
              },
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

    const posts = await titulosDosPostsDoProjeto(projetoId);
    const tarefas: ProjetoDetalhe['tarefas'] = [];
    for (const t of todasTarefas) {
      const ttp = Object.values(t.properties).find(
        (p: any) => p.type === 'title',
      ) as any;
      const postId = (getProp(t, env.notion.taskProps.post)?.relation ?? [])[0]?.id ?? null;
      const post = postId ? posts.get(postId) : undefined;
      tarefas.push({
        id: t.id,
        titulo: txt(ttp?.title) || 'Tarefa',
        pessoa: getProp(t, 'Pessoa')?.people?.[0]?.name ?? null,
        status: getProp(t, env.notion.taskProps.status)?.status?.name ?? null,
        prazo: dataEmSaoPaulo(
          getProp(t, 'Data Entrega')?.date?.start ?? getProp(t, 'Data Inicial')?.date?.start,
        ),
        postId,
        postTitulo: post?.titulo ?? null,
        postData: post?.data ?? null,
        ordem: getProp(t, 'Ordem')?.select?.name ?? null,
        ordemUm: getProp(t, 'Ordem (1)')?.select?.name ?? null,
        entregaId: getProp(t, 'Entregas')?.relation?.[0]?.id ?? null,
      });
    }

    return { id: projetoId, nome, status, clienteNome, gestor, config, tarefas };
  } catch {
    return null;
  }
}

const _getProjetoDetalheCached = unstable_cache(
  medido('projeto', _getProjetoDetalheUncached),
  ['get-projeto-detalhe-v6-entrega'],
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
  ['projetos-by-email-v4-so-ativos'],
  { revalidate: 300, tags: [TAG_CLIENTES] }, // 5 min
);

export async function findProjetosByEmail(email: string): Promise<ProjetoCliente[]> {
  const emailNorm = email.trim().toLowerCase();
  const [lista, ocultos] = await Promise.all([
    projetosByEmailCache.get(emailNorm, () => _findProjetosByEmailCached(emailNorm)),
    projetosOcultosDoCliente(),
  ]);
  // Projeto marcado "não aparece pro cliente" (página do cliente no admin) sai da lista.
  return lista.filter((p) => !ocultos.has(p.id.replace(/-/g, '')));
}

const _projetosOcultosCached = unstable_cache(
  async () => [...(await lerProjetosOcultosDoCliente())],
  ['projetos-ocultos-do-cliente-v1'],
  { revalidate: 300, tags: [TAG_PROJETOS_OCULTOS] },
);

/** Ids (sem traço) dos projetos escondidos da área do cliente. Sem banco: nenhum. */
export async function projetosOcultosDoCliente(): Promise<Set<string>> {
  try {
    return new Set(await _projetosOcultosCached());
  } catch {
    return new Set();
  }
}

/** Depois de mudar a visibilidade de um projeto. */
export function invalidarProjetosOcultos() {
  revalidateTag(TAG_PROJETOS_OCULTOS);
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
        // Cliente só vê projetos Ativos (esconde Concluído e Novo do switcher).
        const status =
          getProp(page, 'Status Manual')?.status?.name ?? null;
        if (status !== 'Ativo') return null;
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
          reaprovacao: getProp(tarefa, 'Ordem (1)')?.select?.name === '03',
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
  // Pendências de projetos que rodam no portal (ex.: aprovação de pauta).
  out.push(...(await tarefasPendentesDoPortal(projetoIds).catch(() => [])));

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

const _listTarefasCached = cacheComReserva(
  _listTarefasPendentesPorCategoriaUncached,
  ['tarefas-pendentes-v4-portal'],
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
  /** Propriedade "Dia": "Todos", dia da semana ("Quinta") ou dia do mês ("05"). */
  dia: string | null;
  totalTarefas: number;
  /** Quantas tarefas em atraso, extraído da fórmula Status. */
  atrasadas: number;
};

function lerDiaDaEntrega(p: any): string | null {
  const d = p.properties?.['Dia'];
  return (
    d?.select?.name ??
    d?.multi_select?.[0]?.name ??
    (d?.rich_text ? txt(d.rich_text) || null : null) ??
    null
  );
}

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
      const dia = lerDiaDaEntrega(p);
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
        dia,
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

const _listEntregasCached = cacheComReserva(
  medido('lista de entregas', _listEntregasUncached),
  ['entregas-v3-dia'],
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

const DIAS_DA_SEMANA_ENTREGA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function hojeSp(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/**
 * Próxima data (YYYY-MM-DD, a partir de hoje) em que a entrega vence, pela
 * propriedade "Dia" — igual ao Notion: "Todos" = todo dia, "Quinta" = toda
 * quinta, "05" = dia 5 do mês. Sem "Dia" reconhecível, usa a fórmula Próxima data.
 */
export function proximaDataDaEntrega(e: Pick<EntregaItem, 'dia' | 'proximaData'>, hoje: string = hojeSp()): string | null {
  const dia = (e.dia ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-feira$/, '');
  const base = new Date(`${hoje}T12:00:00Z`);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (dia === 'todos' || dia === 'todo dia') return hoje;
  const semana = DIAS_DA_SEMANA_ENTREGA.indexOf(dia);
  if (semana >= 0) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + ((semana - d.getUTCDay() + 7) % 7));
    return iso(d);
  }
  const n = /^\d{1,2}$/.test(dia) ? Number(dia) : NaN;
  if (n >= 1 && n <= 31) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), n, 12));
    if (iso(d) < hoje) d.setUTCMonth(d.getUTCMonth() + 1);
    return iso(d);
  }
  return parseProximaData(e.proximaData);
}

/** Retorna as entregas que vencem na data fornecida (default hoje, em Brasília). */
export async function getEntregasDoDia(data?: Date): Promise<EntregaItem[]> {
  const all = await listEntregas();
  const hoje = hojeSp();
  const target = data
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data)
    : hoje;
  return all.filter((e) => proximaDataDaEntrega(e, hoje) === target);
}

export type TarefaDaEntrega = {
  tarefaId: string;
  titulo: string;
  status: string | null;
  /** "Ordem (1)": 01 original, 02 alteração, 03 nova aprovação (reaprovação). */
  ordemUm?: string | null;
  prazo: string | null;
  finalizada: string | null;
  /** Fórmula "Pronto" do Notion: tarefa liberada (etapa anterior concluída). */
  pronto?: boolean;
  postId: string | null;
  postTitulo: string | null;
  /** Data Postagem do post (página da entrega por projeto: "posta", folga). */
  postData?: string | null;
  /** Pessoa da tarefa no Notion (responsável da Lud.). */
  pessoa?: string | null;
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
async function _getEntregaDetalheUncached(
  entregaId: string,
  todas = false,
  /** Só as tarefas desse projeto (página da entrega do projeto: bem menos leituras). */
  projetoId?: string,
  /** Até quantos dias pra frente. Padrão 10 (listas, home, aquecimento); a página da entrega usa 90. */
  diasAFrente = 10,
): Promise<EntregaDetalhe | null> {
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
    const dia = lerDiaDaEntrega(entrega);
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
            ...(projetoId ? [{ property: 'Projeto', relation: { contains: projetoId } }] : []),
            // Padrão: só tarefas "prontas" (fórmula Pronto). `todas`: inclui as
            // ainda não liberadas, numa janela de datas (página da entrega).
            ...(todas
              ? [
                  {
                    property: 'Data Entrega',
                    date: {
                      on_or_after: new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10),
                    },
                  },
                  {
                    property: 'Data Entrega',
                    date: {
                      on_or_before: new Date(Date.now() + diasAFrente * 86_400_000).toISOString().slice(0, 10),
                    },
                  },
                ]
              : [
                  {
                    property: env.notion.taskProps.pronto,
                    formula: { checkbox: { equals: true } },
                  },
                ]),
            // `todas` mantém as concluídas (aparecem em "Enviados"); some só cancelada/excluída.
            ...(todas ? ['Cancelado', 'Excluída'] : STATUS_TAREFA_FECHADOS).map((s) => ({
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
            pronto: !!getProp(t, env.notion.taskProps.pronto)?.formula?.boolean,
            ordemUm: t.properties['Ordem (1)']?.select?.name ?? null,
            postId: postRel[0]?.id ?? null,
            postTitulo,
            postData: postPage ? getProp(postPage, env.notion.postProps.data)?.date?.start?.slice(0, 10) ?? null : null,
            pessoa: getProp(t, 'Pessoa')?.people?.[0]?.name ?? null,
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
      dia,
      totalTarefas: tarefasRelacionadas.length,
      atrasadas,
      tarefasRelacionadas,
    };
  } catch (err: any) {
    // Só "não existe" vira null. Timeout/erro do Notion sobe (assim o cache não guarda
    // um null por 60s e a página não mostra "não achei" quando o Notion só demorou).
    if (err?.code === 'object_not_found' || err?.status === 404) return null;
    throw err;
  }
}

const _getEntregaDetalheCached = unstable_cache(
  _getEntregaDetalheUncached,
  ['get-entrega-detalhe-v3-postdata'],
  { revalidate: 60, tags: [TAG_TAREFAS] }, // 1 min
);

const _getEntregaCompletaCached = cacheComReserva(
  medido('entrega (todos)', (entregaId: string) => _getEntregaDetalheUncached(entregaId, true)),
  ['get-entrega-completa-v4-postdata'],
  { revalidate: 60, tags: [TAG_TAREFAS] },
);

/** Todas as tarefas abertas da entrega (prontas ou não), de 45 dias atrás a 10 dias à frente. */
export async function getEntregaCompleta(entregaId: string): Promise<EntregaDetalhe | null> {
  // Um null guardado no cache (de quando o Notion deu timeout) não vira "não achei":
  // confere direto no Notion antes de desistir.
  return (await _getEntregaCompletaCached(entregaId)) ?? _getEntregaDetalheUncached(entregaId, true);
}

const _getEntregaDoProjetoCached = cacheComReserva(
  medido('entrega (projeto)', (entregaId: string, projetoId: string) => _getEntregaDetalheUncached(entregaId, true, projetoId)),
  ['get-entrega-do-projeto-v1'],
  { revalidate: 60, tags: [TAG_TAREFAS] },
);

/** Página da entrega: tudo que está em aberto até 90 dias pra frente (não só a semana). */
const _getEntregaLongaCached = cacheComReserva(
  medido('entrega (90 dias)', (entregaId: string, projetoId: string) => _getEntregaDetalheUncached(entregaId, true, projetoId || undefined, 90)),
  ['get-entrega-longa-v1'],
  { revalidate: 120, tags: [TAG_TAREFAS] },
);
export async function getEntregaLonga(entregaId: string, projetoId?: string): Promise<EntregaDetalhe | null> {
  return (await _getEntregaLongaCached(entregaId, projetoId ?? '')) ?? _getEntregaDetalheUncached(entregaId, true, projetoId, 90);
}

/** Mesmo recorte de getEntregaCompleta, só com as tarefas de um projeto. */
export async function getEntregaDoProjeto(entregaId: string, projetoId: string): Promise<EntregaDetalhe | null> {
  return (await _getEntregaDoProjetoCached(entregaId, projetoId)) ?? _getEntregaDetalheUncached(entregaId, true, projetoId);
}

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
    .replace(/\s+/g, ' ')
    .trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : 'Geral';
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

  // A categoria vem do título da tarefa ("Aprovação | Post" → "Post") quando
  // ele tem sufixo; a entrega genérica "Aprovações" jogaria tudo em "Geral".
  const porCategoria = new Map<string, GrupoAprovacao>();
  const vistas = new Set<string>();
  for (const g of grupos) {
    for (const t of g.tarefas) {
      if (vistas.has(t.tarefaId)) continue;
      vistas.add(t.tarefaId);
      const doTitulo = ehEntregaDeAprovacao(t.titulo)
        ? categoriaDaAprovacao(t.titulo)
        : 'Geral';
      const categoria = doTitulo !== 'Geral' ? doTitulo : g.categoria;
      const existente = porCategoria.get(categoria);
      if (existente) {
        existente.tarefas.push(t);
      } else {
        porCategoria.set(categoria, { ...g, categoria, tarefas: [t] });
      }
    }
  }
  for (const g of porCategoria.values()) {
    g.tarefas.sort((a, b) => {
      if (!a.prazo && !b.prazo) return 0;
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return a.prazo.localeCompare(b.prazo);
    });
  }

  return [...porCategoria.values()]
    .filter((g) => g.tarefas.length > 0)
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'));
}

/**
 * Lista TODAS as tarefas de um post (abertas + concluídas), pra painel admin
 * no /post/[id]. Diferente de getEntregaDetalhe, não filtra por Pronto nem por
 * status — mostra o histórico completo pra equipe agir manualmente.
 */
export type TarefaDoPost = {
  tarefaId: string;
  titulo: string;
  status: string | null;
  prazo: string | null;
  finalizada: string | null;
  /** "Finalizada em" como veio do Notion (com hora, quando tem). */
  finalizadaEm: string | null;
  pessoaNome: string | null;
  pessoaAvatar: string | null;
  /** Notion user id do responsável (liga com a página do colaborador). */
  pessoaId: string | null;
  /** "Ordem" do Notion (01–22): posição da tarefa no processo do post. */
  ordem: string | null;
  ordemUm: string | null; // '01', '02', '03'
  categoria: 'aprovacao' | 'alteracao' | 'briefing' | 'arte' | 'copy' | 'outro';
  aberta: boolean;
};

function categoriaDaTarefa2(titulo: string): TarefaDoPost['categoria'] {
  const t = (titulo ?? '').toLowerCase().trim();
  if (t.startsWith('aprovação')) return 'aprovacao';
  if (t.startsWith('alteração')) return 'alteracao';
  if (t.includes('briefing') || t.includes('copy')) return 'copy';
  if (t.includes('arte')) return 'arte';
  return 'outro';
}

async function _listarTarefasDoPostUncached(
  postId: string,
): Promise<TarefaDoPost[]> {
  const out: TarefaDoPost[] = [];
  let cursor: string | undefined;
  do {
    const res = await comRetry(() =>
      notion.databases.query({
        database_id: env.notion.tarefasDbId,
        start_cursor: cursor,
        page_size: 100,
        filter: {
          property: env.notion.taskProps.post,
          relation: { contains: postId },
        },
      }),
    );
    for (const t of res.results as any[]) {
      if (t.archived) continue;
      const titleProp = Object.values(t.properties).find(
        (p: any) => p.type === 'title',
      ) as any;
      const titulo = txt(titleProp?.title) || '';
      const status =
        getProp(t, env.notion.taskProps.status)?.status?.name ?? null;
      const finalizadaEm =
        getProp(t, 'Finalizada em ')?.date?.start ?? getProp(t, 'Finalizada em')?.date?.start ?? null;
      const finalizada = dataEmSaoPaulo(finalizadaEm);
      // Dia em Brasília: datas com horário em UTC caíam no dia errado e
      // embaralhavam a ordem das tarefas.
      const prazo = dataEmSaoPaulo(
        getProp(t, 'Data Entrega')?.date?.start ?? getProp(t, 'Data Inicial')?.date?.start,
      );
      const pessoa = getProp(t, 'Pessoa')?.people?.[0] ?? null;
      const ordemUm = getProp(t, 'Ordem (1)')?.select?.name ?? null;
      const ordem = getProp(t, 'Ordem')?.select?.name ?? null;
      const aberta = !STATUS_TAREFA_FECHADOS.includes(status ?? '') && !finalizada;
      out.push({
        tarefaId: t.id,
        titulo,
        status,
        prazo,
        finalizada,
        finalizadaEm,
        pessoaNome: pessoa?.name ?? null,
        pessoaAvatar: pessoa?.avatar_url ?? null,
        pessoaId: pessoa?.id ?? null,
        ordem,
        ordemUm,
        categoria: categoriaDaTarefa2(titulo),
        aberta,
      });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Ordena: abertas primeiro (por prazo asc), depois fechadas (por finalizada desc)
  out.sort((a, b) => {
    if (a.aberta !== b.aberta) return a.aberta ? -1 : 1;
    if (a.aberta) {
      if (!a.prazo && !b.prazo) return 0;
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return a.prazo.localeCompare(b.prazo);
    }
    if (!a.finalizada && !b.finalizada) return 0;
    if (!a.finalizada) return 1;
    if (!b.finalizada) return -1;
    return b.finalizada.localeCompare(a.finalizada);
  });
  return out;
}

const _listarTarefasDoPostCached = unstable_cache(
  medido('tarefas do post', _listarTarefasDoPostUncached),
  ['listar-tarefas-do-post-v5'],
  { revalidate: 30, tags: [TAG_TAREFAS] },
);

export async function listarTarefasDoPost(
  postId: string,
): Promise<TarefaDoPost[]> {
  if (ehPostDoPortal(postId)) return (await listarTarefasDoPortal([postId])).map(paraTarefaDoPost);
  return _listarTarefasDoPostCached(postId);
}

// ============================================================
// listarTarefasDaEsteira — dados reais pro kanban /esteira.
// Usa getEntregaDetalhe pra garantir que a lista bata com a página
// da entrega no Notion (mesma query). Filtra só social media.
// ============================================================

export type ColunaEsteira = 'fila' | 'produzindo' | 'revisar' | 'reaprovacao' | 'pronto';

export type CardEsteiraNotion = {
  tarefaId: string;
  postId: string;
  postTitulo: string;
  postData: string | null;
  projetoId: string;
  projetoNome: string;
  clienteNome: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  responsavelAvatar: string | null;
  prazo: string | null;
  status: string | null;
  finalizada: string | null;
  entregaNome: string; // "Briefing & Copy", "Aprovação | Post", etc
  coluna: ColunaEsteira;
  /** Nome do formato do post (Reels, Carrossel…), pro emoji na lista da esteira. */
  formatoNome?: string | null;
};

// Fonte de cards da Esteira. v1 = só Briefing & Copy + sua aprovação.
// Fila vem de uma ENTREGA (mesma página do Notion).
// Revisar vem de TAREFAS avulsas por título (a entrega não existe no Notion).
const ENTREGAS_ESTEIRA: Array<{
  id: string;
  nome: string;
  coluna: ColunaEsteira;
}> = [
  {
    id: '2b5d04d23b4a80fdb3b6d7a79c36f5ba',
    nome: 'Briefing & Copy',
    coluna: 'fila',
  },
];

const TAREFAS_AVULSAS_ESTEIRA: Array<{
  tituloExato: string;
  coluna: ColunaEsteira;
}> = [
  {
    tituloExato: 'Aprovação | Briefing & Copy',
    coluna: 'revisar',
  },
  {
    tituloExato: 'Alteração | Briefing & Copy',
    coluna: 'reaprovacao',
  },
];

const SERVICOS_SOCIAL_ESTEIRA = new Set(['Instagram', 'TikTok', 'Stories']);

async function resolverResponsavel(
  tarefaId: string,
): Promise<{ id: string | null; nome: string | null; avatar: string | null }> {
  try {
    const t = (await cachedPageRetrieve(tarefaId)) as any;
    const pessoa = getProp(t, 'Pessoa')?.people?.[0] ?? null;
    return {
      id: pessoa?.id ?? null,
      nome: pessoa?.name ?? null,
      avatar: pessoa?.avatar_url ?? null,
    };
  } catch {
    return { id: null, nome: null, avatar: null };
  }
}

/**
 * Query direta no banco de tarefas por título exato. Usado pras tarefas
 * "Aprovação | Briefing & Copy" que são criadas dinamicamente pelo fluxo
 * de alteração — não estão vinculadas a nenhuma entrega recorrente.
 */
async function _listarTarefasPorTitulo(
  tituloExato: string,
): Promise<TarefaDaEntrega[]> {
  const tarefas: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await comRetry(() =>
      notion.databases.query({
        database_id: env.notion.tarefasDbId,
        start_cursor: cursor,
        page_size: 100,
        filter: {
          and: [
            { property: 'Tarefa', title: { equals: tituloExato } },
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
      }),
    );
    tarefas.push(...(res.results as any[]));
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const resolvidas = await Promise.all(
    tarefas.map(async (t: any): Promise<TarefaDaEntrega | null> => {
      try {
        if (t.archived) return null;
        const titleProp = Object.values(t.properties).find(
          (p: any) => p.type === 'title',
        ) as any;
        const titulo = txt(titleProp?.title) || '';
        const status = t.properties.Status?.status?.name ?? null;
        const prazo =
          t.properties['Data Entrega']?.date?.start ??
          t.properties['Data Inicial']?.date?.start ??
          null;
        const finalizada = t.properties['Finalizada em ']?.date?.start ?? null;
        const postRel = t.properties.Post?.relation ?? [];
        const projetoRel = t.properties.Projeto?.relation ?? [];

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
          const pa = projPage as any;
          const ptp = Object.values(pa.properties).find(
            (x: any) => x.type === 'title',
          ) as any;
          projetoNome = txt(ptp?.title) || null;
          const clienteRel = pa.properties.Cliente?.relation ?? [];
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
  return resolvidas.filter((r): r is TarefaDaEntrega => r !== null);
}

async function _listarTarefasDaEsteiraUncached(): Promise<CardEsteiraNotion[]> {
  const { classificarProjeto } = await import('./projetoServico');

  // Puxa tudo em paralelo: entregas + tarefas avulsas por título
  const [detalhesEntregas, tarefasAvulsas] = await Promise.all([
    Promise.all(
      ENTREGAS_ESTEIRA.map(async (e) => ({
        cfg: e,
        det: await getEntregaDetalhe(e.id),
      })),
    ),
    Promise.all(
      TAREFAS_AVULSAS_ESTEIRA.map(async (a) => ({
        cfg: a,
        tarefas: await _listarTarefasPorTitulo(a.tituloExato),
      })),
    ),
  ]);

  const cards: CardEsteiraNotion[] = [];

  // Fonte 1: entregas do Notion. Se o post já tem copy produzida no Notion
  // (marcador "🤖 Copy Produzida — v" ou "🤖 Reescrita Claude — v"), muda
  // a coluna de 'fila' pra 'revisar' — a Luiza vê que já foi produzido.
  for (const { cfg, det } of detalhesEntregas) {
    if (!det) continue;
    // Detecta em paralelo quais tarefas já têm copy produzida
    const jaProduzidos = new Map<string, boolean>();
    await Promise.all(
      det.tarefasRelacionadas.map(async (t) => {
        if (!t.postId) return;
        // Tenta de novo se o Notion limitar: um erro aqui não pode tirar o post de Aprovação.
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          try {
            const c = await lerCopyDoPost(t.postId);
            jaProduzidos.set(t.postId, !!(c.legenda || c.carrossel || c.voice));
            return;
          } catch {
            await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
          }
        }
        jaProduzidos.set(t.postId, false);
      }),
    );
    for (const t of det.tarefasRelacionadas) {
      if (!t.projetoNome || !SERVICOS_SOCIAL_ESTEIRA.has(classificarProjeto(t.projetoNome)))
        continue;
      if (!t.postId || !t.postTitulo) continue;
      const resp = await resolverResponsavel(t.tarefaId);
      const jaTemCopy = jaProduzidos.get(t.postId) === true;
      cards.push({
        tarefaId: t.tarefaId,
        postId: t.postId,
        postTitulo: t.postTitulo,
        postData: null,
        projetoId: t.projetoId ?? '',
        projetoNome: t.projetoNome,
        clienteNome: t.clienteNome,
        responsavelId: resp.id,
        responsavelNome: resp.nome,
        responsavelAvatar: resp.avatar,
        prazo: t.prazo,
        status: t.status,
        finalizada: t.finalizada,
        entregaNome: cfg.nome,
        // Se já tem copy no Notion, joga direto pra Revisar
        coluna: jaTemCopy && cfg.coluna === 'fila' ? 'revisar' : cfg.coluna,
      });
    }
  }

  // Fonte 2: tarefas avulsas por título
  for (const { cfg, tarefas } of tarefasAvulsas) {
    for (const t of tarefas) {
      if (!t.projetoNome || !SERVICOS_SOCIAL_ESTEIRA.has(classificarProjeto(t.projetoNome)))
        continue;
      if (!t.postId || !t.postTitulo) continue;
      const resp = await resolverResponsavel(t.tarefaId);
      cards.push({
        tarefaId: t.tarefaId,
        postId: t.postId,
        postTitulo: t.postTitulo,
        postData: null,
        projetoId: t.projetoId ?? '',
        projetoNome: t.projetoNome,
        clienteNome: t.clienteNome,
        responsavelId: resp.id,
        responsavelNome: resp.nome,
        responsavelAvatar: resp.avatar,
        prazo: t.prazo,
        status: t.status,
        finalizada: t.finalizada,
        entregaNome: cfg.tituloExato,
        coluna: cfg.coluna,
      });
    }
  }

  cards.sort((a, b) => {
    if (!a.prazo && !b.prazo) return 0;
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo.localeCompare(b.prazo);
  });
  // Formato de cada post (relação "Formato"), pro emoji na lista. Um erro aqui não derruba a esteira.
  const formatoPorPost = new Map<string, string | null>();
  await Promise.all(
    [...new Set(cards.map((c) => c.postId))].map(async (postId) => {
      try {
        const page = await cachedPageRetrieve(postId);
        const ids = (getProp(page, 'Formato')?.relation ?? []).map((r: any) => r.id);
        formatoPorPost.set(postId, (await resolverFormato(ids))?.name ?? null);
      } catch {
        formatoPorPost.set(postId, null);
      }
    }),
  );
  for (const c of cards) c.formatoNome = formatoPorPost.get(c.postId) ?? null;
  return cards;
}

const _listarTarefasDaEsteiraCached = unstable_cache(
  _listarTarefasDaEsteiraUncached,
  ['listar-tarefas-da-esteira-v6'],
  { revalidate: 60, tags: [TAG_TAREFAS] },
);

export async function listarTarefasDaEsteira(): Promise<CardEsteiraNotion[]> {
  return _listarTarefasDaEsteiraCached();
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
  /** Programado, esperando a data de postagem (Conferir Postagem com data futura). */
  | 'agendado'
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
  agendado: { label: 'Agendado', cor: 'agendado' },
  producao: { label: 'Em produção', cor: 'agendado' },
  aprovacao: { label: 'Aprovação', cor: 'aprovacao' },
  alteracao: { label: 'Em alteração', cor: 'alteracao' },
  aguardando: { label: 'Aguardando você', cor: 'aguardando' },
  rascunho: { label: 'Rascunho', cor: 'rascunho' },
};

function tituloParaEtapa(titulo: string): EtapaPost {
  const t = titulo.trim();
  if (t.startsWith('Conferir Postagem')) return 'agendado';
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
  agendado: 1.5,
  rascunho: 1,
  publicado: 0,
};

/** "Conferir Postagem" só é publicado a partir da data do post; antes disso é agendado. */
function ajustarAgendado(p: { etapa: EtapaPost; data: string }): void {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  if (p.etapa === 'agendado' && p.data && p.data.slice(0, 10) <= hoje) p.etapa = 'publicado';
}

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

const _listPostsDoMesCached = cacheComReserva(
  medido('posts do mês', listPostsDoMesUncached),
  ['posts-do-mes-v4-agendado'],
  { revalidate: 300, tags: [TAG_POSTS] },
);

export async function listPostsDoMes(
  projetoIds: string[],
  year: number,
  month: number,
): Promise<PostCalendario[]> {
  if (projetoIds.length === 0) return [];
  const cacheKey = `${[...projetoIds].sort().join(',')}-${year}-${month}`;
  const inicioMes = `${year}-${String(month).padStart(2, '0')}-01`;
  const fimMes = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return postsDoMesCache.get(cacheKey, async () =>
    mesclarComPortal(await _listPostsDoMesCached(projetoIds, year, month), { projetoIds, inicio: inicioMes, fim: fimMes }),
  );
}

/** Mapa data (YYYY-MM-DD) -> título do post no Notion, pra casar com os posts
 *  do Instagram por data de publicação na aba Conteúdo. Varre os meses do range. */
export async function getTitulosPorData(
  projetoId: string,
  inicioMs: number,
  fimMs: number,
): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  if (!projetoId) return mapa;
  // Query direta na base de Postagens, casando por Data Postagem no range e
  // aceitando o id tanto na relação "Projeto" quanto na "Empresa" — o
  // IG_ACCOUNTS pode ter sido mapeado com qualquer um dos dois.
  const inicioISO = new Date(inicioMs).toISOString().slice(0, 10);
  const fimISO = new Date(fimMs).toISOString().slice(0, 10);
  let cursor: string | undefined;
  try {
    do {
      const res = await notion.databases.query({
        database_id: env.notion.postagensDbId,
        start_cursor: cursor,
        page_size: 100,
        filter: {
          and: [
            { property: env.notion.postProps.data, date: { on_or_after: inicioISO } },
            { property: env.notion.postProps.data, date: { on_or_before: fimISO } },
            {
              or: [
                { property: env.notion.postProps.projeto, relation: { contains: projetoId } },
                { property: 'Empresa', relation: { contains: projetoId } },
              ],
            },
          ],
        },
        sorts: [{ property: env.notion.postProps.data, direction: 'ascending' }],
      });
      for (const page of res.results as any[]) {
        const status = getProp(page, env.notion.postProps.status)?.status?.name ?? null;
        if (status === 'Cancelado' || status === 'Excluída') continue;
        const dia = (getProp(page, env.notion.postProps.data)?.date?.start ?? '').slice(0, 10);
        if (!dia) continue;
        const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
        const titulo = txt(titleProp?.title);
        // Primeiro post do dia vence (match por data não distingue vários no dia).
        if (titulo && !mapa[dia]) mapa[dia] = titulo;
      }
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
  } catch {
    /* título é opcional — devolve o que conseguiu */
  }
  return mapa;
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

  // "Publicado" na visão do usuário = Status raw = Postado OU a fórmula
  // Status Geral considera concluído. A fórmula pode vir com emoji ou
  // espaços extras, então usamos matching tolerante (contains + lowercase).
  function ehPublicado(p: PostCalendario): boolean {
    const raw = (p.status ?? '').trim().toLowerCase();
    if (raw === 'postado') return true;
    const sg = (p.statusGeral ?? '').trim().toLowerCase();
    if (!sg) return false;
    // Casos típicos: "Postado", "✅ Postado", "Conferir Postagem",
    // "🕐 Conferir Postagem"
    if (sg.includes('postado')) return true;
    // Conferir Postagem com data futura ainda não foi ao ar: é agendado.
    if (sg.includes('conferir postagem')) {
      const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
      return !p.data || p.data.slice(0, 10) <= hoje;
    }
    return false;
  }

  // Busca a tarefa atual ativa de cada post, em batch — só pros não-publicados
  const idsParaBuscarEtapa = out.filter((p) => !ehPublicado(p)).map((p) => p.id);
  const etapaPorPost = await getEtapaAtualPorPost(idsParaBuscarEtapa);

  for (const p of out) {
    if (ehPublicado(p)) {
      p.etapa = 'publicado';
      p.tarefaAtualTitulo = null;
    } else {
      const ativa = etapaPorPost.get(p.id);
      p.etapa = ativa?.etapa ?? 'rascunho';
      p.tarefaAtualTitulo = ativa?.titulo ?? null;
      ajustarAgendado(p);
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
    const res = await comRetry(() =>
      notion.databases.query({
        database_id: env.notion.postagensDbId,
        start_cursor: cursor,
        filter: {
          and: [
            { property: env.notion.postProps.data, date: { on_or_after: onOrAfter } },
            { property: env.notion.postProps.data, date: { on_or_before: onOrBefore } },
          ],
        },
        sorts: [{ property: env.notion.postProps.data, direction: 'ascending' }],
      }),
    );

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
      ajustarAgendado(p);
    }
    const info = ETAPA_INFO[p.etapa];
    p.cor = info.cor;
    p.etapaLabel = info.label;
  }

  return out;
}

const _listPostsNoIntervaloCached = cacheComReserva(
  medido('posts do período', listPostsNoIntervaloUncached),
  ['posts-intervalo-v4-agendado'],
  { revalidate: 300, tags: [TAG_POSTS] },
);

export async function listPostsNoIntervalo(
  onOrAfter: string,
  onOrBefore: string,
): Promise<PostCalendario[]> {
  return mesclarComPortal(await _listPostsNoIntervaloCached(onOrAfter, onOrBefore), {
    inicio: onOrAfter.slice(0, 10),
    fim: onOrBefore.slice(0, 10),
  });
}

export type PostDetalhado = {
  id: string;
  titulo: string;
  data: string | null;
  status: string | null;
  /** Fórmula "Status Geral" do Notion: a etapa em que o post está ("Alteração | Arte"). */
  statusGeral: string | null;
  projetoId: string | null;
  projetoNome: string;
  formato: RelacaoItem[];
  funil: RelacaoItem[];
  objetivo: RelacaoItem[];
  /** "O que precisamos de você" — select do Notion */
  demanda: string | null;
  formatoTipo: 'post' | 'reels' | 'story' | 'desconhecido';
  /** Só a arte/entrega do post (o que aparece na aprovação e na programação). */
  driveLinks: { name: string; url: string }[];
  /** Links de materiais do cliente que caíram no campo do Drive (posts antigos). */
  materiaisLinks: { name: string; url: string }[];
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
 * Dedupe in-memory por (blockId + profundidade), TTL de 30s — várias chamadas
 * pra mesma página dentro do warm time compartilham o mesmo fetch sem depender
 * de React.cache (que só é seguro em Server Components).
 */
const blocosMemCache = makeCache<any[]>(30_000);
async function coletarBlocosRecursivo(
  blockId: string,
  profundidade = 0,
): Promise<any[]> {
  const cacheKey = `${blockId}|${profundidade}`;
  return blocosMemCache.get(cacheKey, async () => {
    if (profundidade > 4) return [];
    try {
      const out: any[] = [];
      let cursor: string | undefined;
      do {
        const res = await notion.blocks.children.list({
          block_id: blockId,
          page_size: 100,
          start_cursor: cursor,
        });
        // Os filhos de cada bloco saem ao mesmo tempo (antes era um por um); a ordem fica a mesma.
        const lista = res.results as any[];
        const filhos = await Promise.all(
          lista.map((b) => (b.has_children ? coletarBlocosRecursivo(b.id, profundidade + 1) : Promise.resolve([] as any[]))),
        );
        lista.forEach((b, i) => out.push(b, ...filhos[i]));
        cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
      } while (cursor);
      return out;
    } catch {
      return [];
    }
  });
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

/**
 * Labels de seção que costumam aparecer DEPOIS da legenda no template
 * do Notion (linha isolada com uma palavra). Quando batemos num paragraph
 * que é só um desses labels, a legenda acaba ali — senão vaza pra dentro.
 */
const FIM_LEGENDA_KEYWORDS = new Set([
  'briefing',
  'briefing:',
  'roteiro',
  'roteiro:',
  'voice over',
  'voiceover',
  'voice over:',
  'voz over',
  'copy',
  'copy:',
  'referências',
  'referencias',
  'referência',
  'referencia',
  'referências:',
  'notas',
  'notas:',
  'nota',
  'observações',
  'observacoes',
  'observação',
  'obs',
  'materiais',
  'materiais:',
  'informações e materiais',
  'informacoes e materiais',
  'informações & materiais',
  'informacoes & materiais',
  'informações',
  'informacoes',
  'informação',
  'informacao',
  'informações:',
  'informacoes:',
  'tarefas',
  'tarefas lud',
  'tarefas lud.',
]);

function pareceFimDaLegenda(b: any): boolean {
  const t = rtTexto(b).toLowerCase().replace(/[:.\s]+$/, '').trim();
  if (!t) return false;
  // Só considera se for uma linha curtinha (≤ 30 chars) — legenda de verdade
  // sempre é maior que um label
  if (t.length > 30) return false;
  return FIM_LEGENDA_KEYWORDS.has(t);
}

function ehHeading(b: any): boolean {
  return b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'heading_3';
}

/**
 * Todas as seções da página do post no Notion, na ordem em que aparecem
 * (Ideia do Post, Briefing do Post, Referências, Informações, Materiais,
 * Texto do Voice Over, Roteiro…). Cada título (heading ou callout com título
 * em negrito) abre uma seção; o que vem embaixo vira linhas. Usado no popup
 * interno do post. Seções vazias, a legenda e "Skills usadas" ficam de fora.
 */
export type LinhaSecao = { tipo: 'p' | 'li' | 'ol' | 'arq'; texto: string; destaque?: boolean; negrito?: boolean; url?: string; arq?: 'imagem' | 'video' | 'audio' | 'link' | 'outro' };
export type SecaoDoPost = { titulo: string; linhas: LinhaSecao[] };

async function _lerSecoesDoPost(postId: string): Promise<SecaoDoPost[]> {
  const blocos = await coletarBlocosRecursivo(postId);
  const out: SecaoDoPost[] = [];
  let atual: SecaoDoPost | null = null;
  const ignorar = /^(legenda|v[íi]deo|arte|skills usadas|tarefas cliente)$/i;
  let pulando = false;
  for (const b of blocos) {
    if (b.type === 'tab' || b.type === 'child_database' || b.type === 'divider' || b.type === 'column_list' || b.type === 'column') continue;
    const rt: any[] = b[b.type]?.rich_text ?? [];
    const texto = rt.map((r: any) => r.plain_text).join('').trim();
    const todoNegrito = rt.length > 0 && rt.every((r: any) => r.annotations?.bold || !r.plain_text.trim());
    const ehTitulo = ehHeading(b) || (b.type === 'callout' && texto && texto.length <= 60 && todoNegrito);
    if (ehTitulo) {
      const t = texto.replace(/[:\s]+$/, '');
      pulando = ignorar.test(t);
      atual = pulando ? null : { titulo: t, linhas: [] };
      if (atual) out.push(atual);
      continue;
    }
    // Arquivos (foto, vídeo, áudio, PDF) e links colados viram itens da galeria da seção.
    if (!pulando && atual && ['image', 'video', 'audio', 'file', 'pdf', 'embed', 'bookmark', 'link_preview'].includes(b.type)) {
      const d = b[b.type] ?? {};
      const url: string = d.file?.url ?? d.external?.url ?? d.url ?? '';
      if (url) {
        const nome =
          (d.name as string) ||
          (d.caption ?? []).map((r: any) => r.plain_text).join('').trim() ||
          decodeURIComponent(url.split('?')[0].split('/').pop() ?? '') ||
          'arquivo';
        const arq = b.type === 'image' ? 'imagem' : b.type === 'video' ? 'video' : b.type === 'audio' ? 'audio' : ['embed', 'bookmark', 'link_preview'].includes(b.type) ? 'link' : 'outro';
        atual.linhas.push({ tipo: 'arq', texto: nome, url, arq });
      }
      continue;
    }
    if (pulando || !atual || !texto) continue;
    const destaque = rt.some((r: any) => r.annotations?.color && r.annotations.color !== 'default');
    const negrito = todoNegrito && texto.length <= 80;
    const tipo = b.type === 'bulleted_list_item' || b.type === 'to_do' ? 'li' : b.type === 'numbered_list_item' ? 'ol' : 'p';
    // Parágrafos com quebra de linha viram linhas separadas (mantém o "Rótulo: texto").
    for (const parte of texto.split('\n').map((x: string) => x.trim()).filter(Boolean)) {
      atual.linhas.push({ tipo, texto: parte, ...(destaque ? { destaque } : {}), ...(negrito ? { negrito } : {}) });
    }
  }
  // Seção vazia também continua: a prévia mostra o título e o espaço ("Ainda não preenchido").
  return out;
}

const _lerSecoesDoPostCached = unstable_cache(_lerSecoesDoPost, ['secoes-do-post-v4'], { revalidate: 60, tags: [TAG_POSTS] });
export async function lerSecoesDoPost(postId: string): Promise<SecaoDoPost[]> {
  return _lerSecoesDoPostCached(postId);
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
        // Para em labels de seção (Briefing, Roteiro, Copy, Notas...)
        if (pareceFimDaLegenda(b)) break;
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
  // Conteúdo do portal: tarefa não tem corpo; o post mostra a ideia e o briefing.
  if (ehTarefaDoPortal(pageId)) return null;
  if (ehPostDoPortal(pageId)) {
    const p = await getPostDoPortal(pageId);
    return p ? [p.ideia, p.briefing].filter((x) => x.trim()).join('\n\n') || null : null;
  }
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
  // Conteúdo do portal: as seções são campos do post.
  if (ehPostDoPortal(pageId)) {
    const p = await getPostDoPortal(pageId);
    if (!p) return null;
    const alvo = inicio.toLowerCase();
    if (alvo.includes('materiais')) return p.materiaisNecessarios.trim() || null;
    if (alvo.includes('informa')) return p.informacoesNecessarias.trim() || null;
    return null;
  }
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
 * Lê a copy produzida (voice over, carrossel, legenda) de um post no Notion.
 * Estratégia: pega o body completo em markdown/texto e extrai as seções
 * marcadas por headings "Voice over", "Copy para Carrossel" e "Legenda".
 * Usado pelo painel de revisão da Esteira.
 */
export type CopyDoPost = {
  voice: string | null;
  carrossel: string | null;
  legenda: string | null;
};

type NoCopy = { block: any; index: number; siblings: any[]; parentId: string };

/** Percorre a página do post uma vez só (até 4 níveis: abas, callouts, colunas). */
async function nosDaPagina(postId: string): Promise<NoCopy[]> {
  const nos: NoCopy[] = [];
  async function descer(parentId: string, depth = 0): Promise<void> {
    if (depth > 4) return;
    let cursor: string | undefined;
    const siblings: any[] = [];
    do {
      const res = await comRetry(() => notion.blocks.children.list({ block_id: parentId, page_size: 100, start_cursor: cursor }));
      siblings.push(...(res.results as any[]));
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
    for (let i = 0; i < siblings.length; i++) {
      nos.push({ block: siblings[i], index: i, siblings, parentId });
      if (siblings[i].has_children) await descer(siblings[i].id, depth + 1);
    }
  }
  await descer(postId);
  return nos;
}

export type InfoDoPostEsteira = { formato: string | null; ideia: string | null; briefing: string | null; skills: string[] };

/** Formato, ideia do post e briefing pra equipe (abas Briefing ou Lud), pra prévia da esteira. */
async function _lerInfoDoPostEsteira(postId: string): Promise<InfoDoPostEsteira> {
  const [pagina, nos] = await Promise.all([
    comRetry(() => notion.pages.retrieve({ page_id: postId })) as Promise<any>,
    nosDaPagina(postId),
  ]);
  const formatoIds = (getProp(pagina, 'Formato')?.relation ?? []).map((r: any) => r.id);
  const formato = (await resolverFormato(formatoIds).catch(() => null))?.name ?? null;
  const ehTitulo = (b: any) => b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'heading_3';
  const filhosDe = (id: string) => nos.filter((n) => n.parentId === id).map((n) => n.block);
  function secao(regex: RegExp): string | null {
    const no = nos.find((n) => ehTitulo(n.block) && regex.test(rtTexto(n.block).trim()));
    if (!no) return null;
    const partes: string[] = [];
    for (let i = no.index + 1; i < no.siblings.length; i++) {
      const b = no.siblings[i];
      if (ehTitulo(b) || b.type === 'divider') break;
      const t = rtTexto(b);
      if (t) partes.push(b.type === 'bulleted_list_item' || b.type === 'numbered_list_item' ? `• ${t}` : t);
      // Callout/toggle: o texto fica nos filhos.
      if (b.has_children && (b.type === 'callout' || b.type === 'toggle')) {
        for (const f of filhosDe(b.id)) {
          const tf = rtTexto(f);
          if (tf) partes.push(f.type === 'bulleted_list_item' ? `• ${tf}` : tf);
        }
      }
    }
    return partes.join('\n').trim() || null;
  }
  const skillsTxt = secao(/^skills usadas/i);
  return {
    formato,
    ideia: secao(/^ideia do post/i),
    briefing: secao(/^briefing( do post)?$/i),
    skills: skillsTxt ? skillsTxt.split(/[,\n→>]+/).map((x) => x.replace(/^[•\-\s]+/, '').trim()).filter(Boolean) : [],
  };
}

const _lerInfoDoPostEsteiraCached = unstable_cache(_lerInfoDoPostEsteira, ['info-do-post-esteira-v2'], { revalidate: 60, tags: [TAG_POSTS] });
export const lerInfoDoPostEsteira = (postId: string) => _lerInfoDoPostEsteiraCached(postId);

async function _lerCopyDoPostUncached(postId: string): Promise<CopyDoPost> {
  // 1) Copies produzidas pela esteira: sub-headings "🤖 Copy Produzida — v[N] · [Campo]"
  //    ou "🤖 Reescrita Claude — v[N] · [Campo]". Vale a versão de maior N.
  // 2) Se não tiver marcador: as seções padrão do template, como a skill
  //    criar-copy-completo escreve ("Copy para Carrossel", "Roteiro do Reel", "Legenda").
  const nos = await nosDaPagina(postId);
  const out: CopyDoPost = {
    voice: campoMaisRecente(nos, /voice\s*over/i),
    carrossel: campoMaisRecente(nos, /carrossel/i),
    legenda: campoMaisRecente(nos, /^legenda$/i),
  };
  if (!out.voice && !out.carrossel && !out.legenda) {
    out.carrossel = secaoDoTemplate(nos, /^copy\s*para\s*carrossel/i, false);
    out.voice = secaoDoTemplate(nos, /^roteiro\s*do\s*reel/i, false);
    out.legenda = secaoDoTemplate(nos, /^legenda$/i, true);
  }
  return out;
}

const MARCADOR_COPY = /(?:copy\s*produzida|reescrita\s*claude)\s*[—-]\s*v(\d+)\s*[·•]\s*([^·]+)/i;

function campoMaisRecente(nos: NoCopy[], campoRegex: RegExp): string | null {
  let melhor: { node: NoCopy; versao: number } | null = null;
  for (const n of nos) {
    if (!ehHeading(n.block)) continue;
    const m = rtTexto(n.block).match(MARCADOR_COPY);
    if (!m) continue;
    if (!campoRegex.test(m[2].trim())) continue;
    const versao = parseInt(m[1], 10);
    if (!melhor || versao > melhor.versao) melhor = { node: n, versao };
  }
  if (!melhor) return null;
  const { siblings, index } = melhor.node;
  const partes: string[] = [];
  for (let i = index + 1; i < siblings.length; i++) {
    const b = siblings[i];
    if (b.type === 'divider') break;
    if (b.type === 'heading_1' || b.type === 'heading_2') break;
    if (ehHeading(b) && MARCADOR_COPY.test(rtTexto(b))) break;
    const t = rtTexto(b);
    if (ehHeading(b) && t) {
      if (partes.length > 0) partes.push('');
      partes.push(t);
      continue;
    }
    if (t) partes.push(t);
  }
  return partes.join('\n').trim() || null;
}

/** Texto de uma seção do template até o próximo título. pararNoDivisor: a legenda
 *  termina no "---"; no carrossel o "---" só separa as lâminas. */
function secaoDoTemplate(nos: NoCopy[], regex: RegExp, pararNoDivisor: boolean): string | null {
  const ehTitulo = (b: any) => b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'heading_3';
  const no = nos.find((n) => ehTitulo(n.block) && regex.test(rtTexto(n.block).trim()));
  if (!no) return null;
  const partes: string[] = [];
  for (let i = no.index + 1; i < no.siblings.length; i++) {
    const b = no.siblings[i];
    if (ehTitulo(b)) break;
    if (b.type === 'divider') {
      if (pararNoDivisor) break;
      if (partes.length && partes[partes.length - 1] !== '') partes.push('');
      continue;
    }
    const t = rtTexto(b);
    if (t) partes.push(t);
  }
  return partes.join('\n').trim() || null;
}

const _lerCopyDoPostCached = unstable_cache(
  _lerCopyDoPostUncached,
  ['ler-copy-do-post-v8'],
  { revalidate: 30, tags: [TAG_POSTS] },
);

export async function lerCopyDoPost(postId: string): Promise<CopyDoPost> {
  return _lerCopyDoPostCached(postId);
}

/**
 * Lê o BRIEFING do post no Notion (tudo que a equipe/cliente escreveu no
 * template: Ideia do Post, Informações que precisamos, Materiais, Briefing
 * livre). Usado pela rotina de produção pra dar contexto ao Claude.
 */
export type BriefingDoPost = {
  ideiaPost: string | null;
  informacoes: string | null;
  materiais: string | null;
  briefingLivre: string | null;
};

export async function lerBriefingDoPost(
  postId: string,
): Promise<BriefingDoPost> {
  const rootBlocks = await coletarBlocosRecursivo(postId);
  // O briefing fica dentro do tab "Briefing" — headings e callouts específicos
  const tabs = rootBlocks.filter((b: any) => b.type === 'tab');
  const briefing: BriefingDoPost = {
    ideiaPost: null,
    informacoes: null,
    materiais: null,
    briefingLivre: null,
  };

  for (const tab of tabs) {
    const tabTxt = rtTexto(tab).toLowerCase();
    if (!tabTxt.includes('briefing')) continue;
    const filhos = await coletarBlocosRecursivo(tab.id);

    let secao: 'ideia' | 'info' | 'mat' | 'brief' | null = null;
    for (const b of filhos) {
      if (ehHeading(b)) {
        const t = rtTexto(b).toLowerCase();
        if (t.includes('ideia do post')) secao = 'ideia';
        else if (t.includes('informações') || t.includes('informacoes'))
          secao = 'info';
        else if (t.includes('materiais que precisamos')) secao = 'mat';
        else if (/^briefing$/i.test(rtTexto(b))) secao = 'brief';
        else secao = null;
        continue;
      }
      if (!secao) continue;
      // Callouts têm filhos; parágrafos texto direto
      const t = rtTexto(b);
      if (!t) continue;
      const acumulado =
        secao === 'ideia'
          ? 'ideiaPost'
          : secao === 'info'
            ? 'informacoes'
            : secao === 'mat'
              ? 'materiais'
              : 'briefingLivre';
      briefing[acumulado] = (briefing[acumulado] ? briefing[acumulado] + '\n' : '') + t;
    }
  }

  return briefing;
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
  if (ehPostDoPortal(postId)) {
    await atualizarPostDoPortal(postId, { legenda: (novaLegenda ?? '').trim() }, null);
    return;
  }
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

/**
 * Atualiza o texto da seção 'Ideia do Post' ou 'Briefing do Post' do post
 * no Notion. Se ainda não existe uma seção, cria — puxa pra baixo do heading
 * correto (o que já estiver no template). Aceita qualquer um dos nomes.
 */
export async function atualizarIdeiaDoPost(
  postId: string,
  novoTexto: string,
): Promise<void> {
  if (ehPostDoPortal(postId)) {
    await atualizarPostDoPortal(postId, { ideia: (novoTexto ?? '').trim() }, null);
    return;
  }
  const texto = (novoTexto ?? '').trim();
  const blocks = await coletarBlocosRecursivo(postId);

  // Acha o heading da "Ideia do Post" OU "Briefing do Post" OU só "Briefing"
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[:.\s]+/g, ' ').trim();
  const alvos = ['ideia do post', 'briefing do post', 'briefing'];

  let idxHeading = -1;
  for (const alvo of alvos) {
    idxHeading = blocks.findIndex(
      (b) => ehHeading(b) && normalize(rtTexto(b)).includes(alvo),
    );
    if (idxHeading >= 0) break;
  }
  if (idxHeading < 0) {
    throw new Error('Não achei a seção "Ideia do Post" / "Briefing do Post" nesse post.');
  }

  // Coleta blocos de texto entre o heading e o próximo heading (ou callout ou
  // divider — igual ao pattern da legenda).
  const TIPOS_TEXTO = new Set([
    'paragraph',
    'bulleted_list_item',
    'numbered_list_item',
    'quote',
  ]);
  const conteudoBlocks: any[] = [];
  const headingId = blocks[idxHeading].id as string;
  for (let i = idxHeading + 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (ehHeading(b)) break;
    if (b.type === 'divider') break;
    if (b.type === 'callout') break;
    if (!TIPOS_TEXTO.has(b.type as string)) continue;
    conteudoBlocks.push(b);
  }

  if (conteudoBlocks.length > 0) {
    // Atualiza o primeiro parágrafo, arquiva os outros
    const primeiro = conteudoBlocks[0];
    const tipo = primeiro.type as string;
    await notion.blocks.update({
      block_id: primeiro.id,
      [tipo]: { rich_text: [{ type: 'text', text: { content: texto } }] },
    } as any);
    for (let i = 1; i < conteudoBlocks.length; i++) {
      try {
        await notion.blocks.delete({ block_id: conteudoBlocks[i].id });
      } catch (err: any) {
        console.warn('[atualizarIdeia] falhou arquivar bloco:', err?.message);
      }
    }
  } else {
    // Não achou parágrafo — appenda um novo abaixo do heading
    await notion.blocks.children.append({
      block_id: headingId,
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: texto } }],
          },
        } as any,
      ],
    });
  }
}

export async function getPostComDetalhes(postId: string): Promise<PostDetalhado | null> {
  if (ehPostDoPortal(postId)) return portalPostDetalhado(postId);
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

    // Fallback pra caso a prop seja select em vez de relation — se select,
    // trata como "relacao com id === nome" pra unificar o front.
    const funilSelect = getProp(page, 'Funil')?.select?.name as string | undefined;
    const objetivoSelect = getProp(page, 'Objetivo')?.select?.name as string | undefined;
    const formatoSelect = getProp(page, 'Formato')?.select?.name as string | undefined;

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
      // Template do Notion mudou: hoje o header pode ser "Ideia do Post"
      // (padrão antigo) ou "Briefing do Post" (padrão novo). Tenta os dois.
      (async () => {
        const a = await lerSecaoEntre(postId, 'Ideia do Post', []);
        if (a) return a;
        const b = await lerSecaoEntre(postId, 'Briefing do Post', []);
        if (b) return b;
        return await lerSecaoEntre(postId, 'Briefing', []);
      })(),
      lerMateriaisNecessarios(postId),
      lerInformacoesNecessarias(postId),
    ]);

    const formatoTipo: PostDetalhado['formatoTipo'] = formatoInfo?.tipo ?? 'desconhecido';

    const driveProp = getProp(page, env.notion.postProps.driveLink);
    const driveLinks: PostDetalhado['driveLinks'] = [];
    const materiaisLinks: PostDetalhado['materiaisLinks'] = [];
    for (const f of driveProp?.files ?? []) {
      const url = f.type === 'external' ? f.external?.url : f.file?.url;
      if (!url) continue;
      const item = { name: f.name ?? 'arquivo', url };
      if (ehLinkDeMaterial(item.name)) materiaisLinks.push(item);
      else driveLinks.push(item);
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
      statusGeral: (() => {
        const f = getProp(page, 'Status Geral')?.formula;
        return f?.type === 'string' && f.string ? String(f.string).trim() || null : null;
      })(),
      projetoId,
      projetoNome,
      formato:
        formato.length > 0
          ? formato
          : formatoSelect
            ? [{ id: formatoSelect, name: formatoSelect, icon: null }]
            : formato,
      funil:
        funil.length > 0
          ? funil
          : funilSelect
            ? [{ id: funilSelect, name: funilSelect, icon: null }]
            : funil,
      objetivo:
        objetivo.length > 0
          ? objetivo
          : objetivoSelect
            ? [{ id: objetivoSelect, name: objetivoSelect, icon: null }]
            : objetivo,
      demanda: getProp(page, env.notion.postProps.demanda)?.select?.name ?? null,
      formatoTipo,
      driveLinks,
      materiaisLinks,
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
  if (ehTarefaDoPortal(tarefaId)) return portalAprovarTarefa(tarefaId, comentario);
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
    /** Troca a entrega herdada (ex.: "Alteração", "Aprovação de alteração"). */
    entregaId?: string;
    /** Troca a "Ordem" herdada (a alteração usa a Ordem da aprovação). */
    ordem?: string | null;
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

  if (overrides.entregaId) {
    props['Entregas'] = { relation: [{ id: overrides.entregaId }] };
  }

  if (overrides.pessoaIds && overrides.pessoaIds.length > 0) {
    props['Pessoa'] = { people: overrides.pessoaIds.map((id) => ({ id })) };
  } else {
    const pessoa = getProp(tarefaOriginal, 'Pessoa')?.people;
    if (pessoa && pessoa.length > 0) {
      props['Pessoa'] = { people: pessoa.map((p: any) => ({ id: p.id })) };
    }
  }

  const ordem = overrides.ordem
    ? { name: overrides.ordem }
    : getProp(tarefaOriginal, 'Ordem')?.select;
  if (ordem) props['Ordem'] = { select: { name: ordem.name } };

  const tipoOrig = getProp(tarefaOriginal, 'tipo original')?.select;
  if (tipoOrig) props['tipo original'] = { select: { name: tipoOrig.name } };

  return props;
}

// Entregas do Notion usadas nas alterações (mesmo padrão do botão de reprovar).
const ENTREGA_ALTERACAO = '2bcd04d23b4a8088bb31fb2d83e29fbf';
const ENTREGA_APROVACAO_ALTERACAO = '2e9d04d23b4a80a68ea9d1602cf286f9';

export async function pedirAlteracao(tarefaId: string, comentario: string): Promise<void> {
  if (!comentario || comentario.trim().length < 3) {
    throw new Error('comentario obrigatório e com pelo menos 3 caracteres');
  }
  if (ehTarefaDoPortal(tarefaId)) return portalPedirAlteracao(tarefaId, comentario);
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
        // A aprovação do cliente fechou: a alteração vai pra entrega Alterações.
        entregaId: ENTREGA_ALTERACAO,
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
          // A reaprovação depois da alteração entra na entrega Aprovações.
          entregaId: ENTREGA_APROVACAO_ALTERACAO,
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



export type TipoAlteracao = 'arte' | 'copy';
const BASE_DA_ALTERACAO: Record<TipoAlteracao, string> = {
  arte: 'Arte',
  copy: 'Briefing & Copy',
};

/**
 * Quando o cliente pede alteração no post, a Luiza lê os comentários e decide
 * se é arte, copy ou as duas. Pra cada uma, igual ao padrão do Notion:
 *  - reprova a última "Aprovação | X" interna;
 *  - cria "Alteração | X" (Ordem 02, mesma pessoa da produção, entrega Alteração)
 *    e "Aprovação | X" (Ordem 03, quem aprovou antes, entrega Aprovação de alteração),
 *    as duas penduradas na tarefa de produção original (Mãe);
 *  - conclui a "Alteração | Post" (o pedido do cliente foi lido).
 */
export async function solicitarAlteracaoDoPost(params: {
  postId: string;
  tipos: TipoAlteracao[];
  /** YYYY-MM-DD; a tarefa vence às 17h de Brasília. */
  prazo: string;
  nota: string | null;
  alteracaoPostId: string | null;
}): Promise<{ criadas: { titulo: string; pessoa: string | null }[] }> {
  const { postId, tipos, prazo, nota, alteracaoPostId } = params;
  const tarefas: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await comRetry(() =>
      notion.databases.query({
        database_id: env.notion.tarefasDbId,
        start_cursor: cursor,
        page_size: 100,
        filter: { property: env.notion.taskProps.post, relation: { contains: postId } },
      }),
    );
    tarefas.push(...(res.results as any[]).filter((t) => !t.archived));
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const tituloDe = (t: any) => {
    const tp = Object.values(t.properties).find((p: any) => p.type === 'title') as any;
    return (txt(tp?.title) || '').trim();
  };
  const maisRecente = (titulo: string) =>
    tarefas
      .filter((t) => tituloDe(t) === titulo)
      .sort((a, b) => String(b.created_time).localeCompare(String(a.created_time)))[0] ?? null;
  const pessoasDe = (t: any): string[] =>
    (getProp(t, 'Pessoa')?.people ?? []).map((p: any) => p.id).filter(Boolean);
  const nomeDe = (t: any): string | null => getProp(t, 'Pessoa')?.people?.[0]?.name ?? null;

  const alteracaoPost = alteracaoPostId
    ? tarefas.find((t) => t.id.replace(/-/g, '') === alteracaoPostId.replace(/-/g, '')) ?? null
    : null;
  const prazoIso = `${prazo}T17:00:00`;
  const criadas: { titulo: string; pessoa: string | null }[] = [];

  for (const tipo of tipos) {
    const base = BASE_DA_ALTERACAO[tipo];
    const producao = maisRecente(base);
    const aprovacaoAnterior = maisRecente(`Aprovação | ${base}`);
    const modelo = producao ?? alteracaoPost ?? tarefas[0];
    if (!modelo) throw new Error('Esse post não tem tarefas no Notion pra servir de base.');
    const maeId = (producao ?? alteracaoPost ?? modelo).id;

    const pessoaAlteracao = producao ? pessoasDe(producao) : [];
    // No Notion, alteração e nova aprovação ficam na Ordem da aprovação (ex.: Arte 12 → 13).
    const ordemDoCiclo = aprovacaoAnterior ? getProp(aprovacaoAnterior, 'Ordem')?.select?.name ?? null : null;
    const alteracao = (await comRetry(() =>
      notion.pages.create({
        parent: { database_id: env.notion.tarefasDbId },
        properties: montarPropsHerdadas(modelo, {
          titulo: `Alteração | ${base}`,
          ordemUm: '02',
          maeId,
          postId,
          prazoIso,
          pessoaIds: pessoaAlteracao.length > 0 ? pessoaAlteracao : undefined,
          entregaId: ENTREGA_ALTERACAO,
          ordem: ordemDoCiclo,
        }),
      }),
    )) as any;
    await aplicarTemplateNovaTarefa(alteracao.id);
    criadas.push({ titulo: `Alteração | ${base}`, pessoa: producao ? nomeDe(producao) : nomeDe(modelo) });

    // O que mudar fica escrito na própria tarefa de quem vai alterar.
    if (nota && nota.trim()) {
      await comRetry(() =>
        notion.blocks.children.append({
          block_id: alteracao.id,
          children: [
            {
              object: 'block',
              type: 'callout',
              callout: {
                icon: { type: 'emoji', emoji: '🔁' },
                rich_text: [{ type: 'text', text: { content: nota.trim().slice(0, 1900) } }],
              },
            },
          ] as any,
        }),
      ).catch((err: any) => console.warn('[solicitarAlteracao] nota na tarefa:', err?.message));
    }

    const pessoaAprovacao = aprovacaoAnterior ? pessoasDe(aprovacaoAnterior) : [];
    const aprovacao = (await comRetry(() =>
      notion.pages.create({
        parent: { database_id: env.notion.tarefasDbId },
        properties: montarPropsHerdadas(aprovacaoAnterior ?? modelo, {
          titulo: `Aprovação | ${base}`,
          ordemUm: '03',
          maeId,
          postId,
          prazoIso,
          pessoaIds: pessoaAprovacao.length > 0 ? pessoaAprovacao : undefined,
          entregaId: ENTREGA_APROVACAO_ALTERACAO,
          ordem: ordemDoCiclo,
        }),
      }),
    )) as any;
    await aplicarTemplateNovaTarefa(aprovacao.id);
    criadas.push({
      titulo: `Aprovação | ${base}`,
      pessoa: aprovacaoAnterior ? nomeDe(aprovacaoAnterior) : nomeDe(modelo),
    });

    if (aprovacaoAnterior && getProp(aprovacaoAnterior, env.notion.taskProps.status)?.status?.name !== 'Reprovado') {
      await comRetry(() =>
        notion.pages.update({
          page_id: aprovacaoAnterior.id,
          properties: { [env.notion.taskProps.status]: { status: { name: 'Reprovado' } } },
        }),
      ).catch((err: any) => console.warn('[solicitarAlteracao] reprovar aprovação:', err?.message));
    }
  }

  if (alteracaoPost && !STATUS_TAREFA_FECHADOS.includes(getProp(alteracaoPost, env.notion.taskProps.status)?.status?.name ?? '')) {
    await concluirTarefa(alteracaoPost.id);
  }

  const [, m, d] = prazo.split('-');
  const nomes = tipos.map((t) => (t === 'arte' ? 'arte' : 'copy')).join(' e ');
  await comentarPost(
    postId,
    `🛠 Alteração de ${nomes} pedida pra equipe · prazo ${d}/${m}.${nota && nota.trim() ? `\n\n${nota.trim()}` : ''}`,
  ).catch(() => {});

  invalidarCachesAposMudanca();
  return { criadas };
}

export async function getTarefaComPost(tarefaId: string): Promise<{
  tarefa: TarefaPendente;
} | null> {
  if (ehTarefaDoPortal(tarefaId)) return portalTarefaComPost(tarefaId);
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
  if (ehPostDoPortal(postId)) return portalTarefaClientePronta(postId, exigirPronto);
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

/** Desfaz uma conclusão: volta pro status anterior e limpa "Finalizada em". */
export async function reabrirTarefa(tarefaId: string, status: string): Promise<void> {
  if (ehTarefaDoPortal(tarefaId)) {
    await reabrirTarefaDoPortal(tarefaId, status);
    return;
  }
  await notion.pages.update({
    page_id: tarefaId,
    properties: {
      [env.notion.taskProps.status]: { status: { name: status } },
      [env.notion.taskProps.finalizada]: { date: null },
    },
  });
}

export async function concluirTarefa(tarefaId: string): Promise<void> {
  marcarFeitaRecente(tarefaId);
  if (ehTarefaDoPortal(tarefaId)) {
    await concluirTarefaDoPortal(tarefaId);
    return;
  }
  // Com hora: o histórico do post mostra quando foi concluída.
  const agora = new Date().toISOString();
  await notion.pages.update({
    page_id: tarefaId,
    properties: {
      [env.notion.taskProps.status]: { status: { name: 'Concluído' } },
      [env.notion.taskProps.finalizada]: { date: { start: agora } },
    },
  });
}

/**
 * Muda o prazo (Data Entrega) de uma tarefa. Se a data tinha horário, mantém
 * a mesma hora de Brasília e troca só o dia. Devolve o prazo anterior pro
 * histórico.
 */
export async function atualizarPrazoTarefa(
  tarefaId: string,
  novaData: string,
): Promise<{ anterior: string | null; titulo: string; postId: string | null }> {
  if (ehTarefaDoPortal(tarefaId)) return portalAtualizarPrazo(tarefaId, novaData);
  const page: any = await comRetry(() => notion.pages.retrieve({ page_id: tarefaId }));
  const atual = getProp(page, 'Data Entrega')?.date ?? null;
  const anterior = dataEmSaoPaulo(atual?.start ?? getProp(page, 'Data Inicial')?.date?.start);

  let start = novaData;
  let end: string | null = null;
  let timeZone: string | undefined;
  if (atual?.start && atual.start.length > 10) {
    const hora = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(atual.start));
    start = `${novaData}T${hora}:00`;
    timeZone = 'America/Sao_Paulo';
  }
  // Intervalo: anda o fim junto com o início.
  if (atual?.end && anterior) {
    const delta = Math.round(
      (Date.parse(`${novaData}T00:00:00Z`) - Date.parse(`${anterior}T00:00:00Z`)) / 86_400_000,
    );
    const fimSp = dataEmSaoPaulo(atual.end);
    if (fimSp) {
      const d = new Date(`${fimSp}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + delta);
      end = d.toISOString().slice(0, 10);
    }
  }

  await comRetry(() =>
    notion.pages.update({
      page_id: tarefaId,
      properties: {
        'Data Entrega': { date: { start, end, ...(timeZone ? { time_zone: timeZone } : {}) } },
      } as any,
    }),
  );

  const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
  return {
    anterior,
    titulo: txt(titleProp?.title) || '',
    postId: getProp(page, env.notion.taskProps.post)?.relation?.[0]?.id ?? null,
  };
}

/** Atualiza o Status do post (Agendado, Postado, etc). Usado pelo botão
 *  "Programar" da página /programacao. */
export async function atualizarStatusPost(
  postId: string,
  status: string,
): Promise<void> {
  await notion.pages.update({
    page_id: postId,
    properties: {
      [env.notion.postProps.status]: { status: { name: status } },
    },
  });
}

export async function comentarPost(postId: string, texto: string): Promise<void> {
  if (ehPostDoPortal(postId)) return comentarPostDoPortal(postId, texto, null);
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
  if (ehPostDoPortal(postId)) return lerComentariosDoPortal(postId);
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

// ---------- Opções pra selects/relations do post (Formato, Funil, Objetivo, Demanda) ----------

export type OpcaoRelation = { id: string; nome: string };
export type OpcaoSelect = { nome: string; cor?: string | null };

/** Retorna o tipo da propriedade no DB de posts (ex: 'relation', 'select',
 *  'status', 'date', 'title', 'files', 'formula'…) ou null se não existir. */
async function _tipoDaPropDoPostUncached(propriedade: string): Promise<string | null> {
  const db: any = await comRetry(() =>
    notion.databases.retrieve({ database_id: env.notion.postagensDbId }),
  );
  const prop = db.properties?.[propriedade];
  return prop?.type ?? null;
}
const _tipoDaPropDoPostCached = unstable_cache(
  _tipoDaPropDoPostUncached,
  ['tipo-da-prop-do-post-v1'],
  { revalidate: 3600, tags: [TAG_POSTS] },
);
export const tipoDaPropDoPost = (propriedade: string) =>
  _tipoDaPropDoPostCached(propriedade);

/** Lista opções da prop `propriedade` do post. Se for `relation`, lista
 *  páginas do DB relacionado; se for `select`/`status`, retorna as options
 *  (id === nome). Retorna array vazio se não encontrar. */
async function _listOpcoesRelationUncached(propriedade: string): Promise<OpcaoRelation[]> {
  const db: any = await comRetry(() =>
    notion.databases.retrieve({ database_id: env.notion.postagensDbId }),
  );
  const prop = db.properties?.[propriedade];
  if (!prop) return [];

  // Se for select/status, retorna as options já com id === nome
  if (prop.type === 'select' || prop.type === 'status') {
    const opts = prop[prop.type]?.options ?? [];
    return opts
      .map((o: any) => ({ id: o.name, nome: o.name }))
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  if (prop.type !== 'relation') return [];
  const dbRel = prop.relation.database_id;

  const out: OpcaoRelation[] = [];
  let cursor: string | undefined;
  do {
    const res = await comRetry(() =>
      notion.databases.query({
        database_id: dbRel,
        start_cursor: cursor,
        page_size: 100,
      }),
    );
    for (const p of res.results as any[]) {
      if (p.archived) continue;
      const titleProp = Object.values(p.properties).find((x: any) => x.type === 'title') as any;
      // Algumas bases (ex.: Etapa Funil) têm título vazio e só o emoji no ícone.
      const nome = txt(titleProp?.title).trim() || (p.icon?.type === 'emoji' ? p.icon.emoji : '') || '';
      if (nome) out.push({ id: p.id, nome });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const _listOpcoesRelationCached = unstable_cache(
  _listOpcoesRelationUncached,
  ['list-opcoes-relation-v2'],
  { revalidate: 600, tags: [TAG_POSTS] },
);

export const listOpcoesRelation = (propriedade: string) =>
  _listOpcoesRelationCached(propriedade);

async function _listOpcoesSelectUncached(propriedade: string): Promise<OpcaoSelect[]> {
  const db: any = await comRetry(() =>
    notion.databases.retrieve({ database_id: env.notion.postagensDbId }),
  );
  const prop = db.properties?.[propriedade];
  if (!prop) return [];
  const opts = prop.select?.options ?? prop.status?.options ?? [];
  return opts.map((o: any) => ({ nome: o.name, cor: o.color ?? null }));
}

const _listOpcoesSelectCached = unstable_cache(
  _listOpcoesSelectUncached,
  ['list-opcoes-select-v1'],
  { revalidate: 600, tags: [TAG_POSTS] },
);

export const listOpcoesSelect = (propriedade: string) =>
  _listOpcoesSelectCached(propriedade);

/** Versão SEM cache do listOpcoesRelation — usa direto quando precisa da
 *  leitura fresca (ex: logo depois de um seed, quando o unstable_cache
 *  ainda serviria valores antigos até a próxima request). */
export const listOpcoesRelationUncached = _listOpcoesRelationUncached;

/** Garante que a prop `propriedade` do post tem as options/entries `nomes`.
 *  Funciona pra select (adiciona options faltantes via databases.update) e
 *  pra relation (cria páginas com o title = nome no DB relacionado).
 *  Idempotente — se já existir, não faz nada. */
export async function garantirOpcoesProp(
  propriedade: string,
  nomes: string[],
): Promise<void> {
  const db: any = await comRetry(() =>
    notion.databases.retrieve({ database_id: env.notion.postagensDbId }),
  );
  const prop = db.properties?.[propriedade];
  if (!prop) return;

  if (prop.type === 'select') {
    const opts = prop.select?.options ?? [];
    const existentes = new Set(opts.map((o: any) => o.name));
    const novos = nomes.filter((n) => !existentes.has(n));
    if (novos.length === 0) return;
    await comRetry(() =>
      notion.databases.update({
        database_id: env.notion.postagensDbId,
        properties: {
          [propriedade]: {
            select: { options: [...opts, ...novos.map((name) => ({ name }))] },
          },
        },
      }),
    );
    invalidarCachesAposMudanca();
    return;
  }

  if (prop.type === 'status') return; // status options não são editáveis via API

  if (prop.type !== 'relation') return;
  const dbRel = prop.relation.database_id;

  const dbInfo: any = await comRetry(() =>
    notion.databases.retrieve({ database_id: dbRel }),
  );
  const titlePropEntry = Object.entries(dbInfo.properties).find(
    ([, p]: [string, any]) => p.type === 'title',
  );
  if (!titlePropEntry) return;
  const titlePropName = titlePropEntry[0];

  const existentes = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await comRetry(() =>
      notion.databases.query({
        database_id: dbRel,
        start_cursor: cursor,
        page_size: 100,
      }),
    );
    for (const p of res.results as any[]) {
      const t = Object.values(p.properties).find((x: any) => x.type === 'title') as any;
      const nome = txt(t?.title) || '';
      if (nome) existentes.add(nome);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const faltantes = nomes.filter((n) => !existentes.has(n));
  if (faltantes.length === 0) return;

  for (const nome of faltantes) {
    try {
      await comRetry(() =>
        notion.pages.create({
          parent: { type: 'database_id', database_id: dbRel },
          properties: {
            [titlePropName]: { title: [{ type: 'text', text: { content: nome } }] },
          },
        }),
      );
    } catch (err: any) {
      console.error(`[garantirOpcoesProp] falha criando "${nome}" em ${propriedade}:`, err?.message);
    }
  }
  invalidarCachesAposMudanca();
}

/** Atualiza uma prop `relation` do post — passa `ids` (vazio = limpa). */
export async function atualizarRelationDoPost(
  postId: string,
  propriedade: string,
  ids: string[],
): Promise<void> {
  await notion.pages.update({
    page_id: postId,
    properties: {
      [propriedade]: { relation: ids.map((id) => ({ id })) },
    },
  });
  invalidarCachesAposMudanca();
}

/** Atualiza a Data Postagem do post. `dataISO` em formato YYYY-MM-DD, null limpa. */
export async function atualizarDataDoPost(
  postId: string,
  dataISO: string | null,
): Promise<void> {
  await notion.pages.update({
    page_id: postId,
    properties: {
      [env.notion.postProps.data]: dataISO
        ? { date: { start: dataISO } }
        : { date: null },
    },
  });
  invalidarCachesAposMudanca();
}

/** Atualiza uma prop `select` do post — passa `nome` ou null pra limpar. */
export async function atualizarSelectDoPost(
  postId: string,
  propriedade: string,
  nome: string | null,
): Promise<void> {
  await notion.pages.update({
    page_id: postId,
    properties: {
      [propriedade]: nome ? { select: { name: nome } } : { select: null },
    },
  });
  invalidarCachesAposMudanca();
}

/**
 * Cria uma pauta vazia no Notion (DB de posts) na data e projeto informados.
 * Usado pelo sandbox de teste-edicao — o portal cria o card, aí a equipe
 * preenche na tela de Construção.
 *
 * Nada de bloco/template ainda — deixa a página crua pra ser preenchida.
 * Título fica vazio (Notion aceita); status não é setado (fica default).
 */
export async function criarPostVazio(
  projetoId: string,
  dataISO: string,
): Promise<{ id: string }> {
  const page: any = await notion.pages.create({
    parent: { type: 'database_id', database_id: env.notion.postagensDbId },
    properties: {
      [env.notion.postProps.projeto]: { relation: [{ id: projetoId }] },
      [env.notion.postProps.data]: { date: { start: dataISO } },
    },
  });
  invalidarCachesAposMudanca();
  return { id: page.id };
}

/** Nomes que o portal dava aos links de materiais do cliente no campo do Drive. */
export function ehLinkDeMaterial(nome: string): boolean {
  return /^(materiais\s*[—-]|link enviado pelo cliente|altera[çc][ãa]o pedida pelo cliente)/i.test(nome.trim());
}

/** Notion limita o `name` de file property em 100 chars — corta antes de mandar. */
function truncarNomeArquivo(nome: string): string {
  const NOTION_FILE_NAME_MAX = 100;
  if (nome.length <= NOTION_FILE_NAME_MAX) return nome;
  return nome.slice(0, NOTION_FILE_NAME_MAX - 1) + '…';
}

export async function atualizarLinkDriveDoPost(postId: string, nome: string, url: string): Promise<void> {
  await notion.pages.update({
    page_id: postId,
    properties: {
      [env.notion.postProps.driveLink]: {
        files: [
          {
            name: truncarNomeArquivo(nome),
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
      // Mantém o formato pra não quebrar — Notion exige type: 'external' ou 'file'.
      // Trunca nomes antigos também: se o cliente rebateu esse update e algum
      // arquivo pré-existente tem >100 chars, o Notion recusa o request inteiro.
      if (f.type === 'external') {
        return { name: truncarNomeArquivo(f.name ?? ''), type: 'external', external: f.external };
      }
      // Files internos do Notion não dá pra reescrever em update, então
      // ignora — eles continuam lá só se mantermos como referência.
      return null;
    }).filter(Boolean),
    { name: truncarNomeArquivo(nome), type: 'external', external: { url } },
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
  /** Próxima tarefa em aberto do mesmo post (a que "abriu" depois dessa
   *  ser concluída). Quando exibido, fica "Aprovação | Arte → Copy". */
  proximaTarefa?: string | null;
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

  // 5b) Pra cada evento de tarefa, busca a "próxima tarefa" do mesmo post —
  //     ou seja, a tarefa que abriu DEPOIS dessa concluir, que mostra pra
  //     onde o fluxo foi. Ex: 'Aprovação | Arte → Copy' OR
  //     'Aprovação | Pauta → Alteração Pauta'. Uma query só, filtrada por
  //     Post in (postIds dos eventos).
  const postIdsComTarefa = new Set<string>();
  for (const ev of eventos) {
    if (ev.tipo === 'tarefa') postIdsComTarefa.add(ev.postId);
  }
  if (postIdsComTarefa.size > 0) {
    const filtrosPostRelation = [...postIdsComTarefa].map((pid) => ({
      property: env.notion.taskProps.post,
      relation: { contains: pid },
    }));
    try {
      const tarefasAbertas: any[] = [];
      let curAb: string | undefined;
      do {
        const r = await notion.databases.query({
          database_id: env.notion.tarefasDbId,
          page_size: 100,
          start_cursor: curAb,
          filter: {
            and: [
              { or: filtrosPostRelation },
              {
                property: env.notion.taskProps.status,
                status: { does_not_equal: 'Concluído' },
              },
              {
                property: env.notion.taskProps.status,
                status: { does_not_equal: 'Cancelado' },
              },
            ],
          },
        });
        tarefasAbertas.push(...(r.results as any[]));
        curAb = r.has_more ? r.next_cursor ?? undefined : undefined;
        if (tarefasAbertas.length >= 500) break;
      } while (curAb);

      // Pra cada post, escolhe a "próxima" — preferência:
      //   1. tarefas com Pronto=true (já liberadas)
      //   2. menor 'Ordem' (sequência do template do Notion)
      //   3. mais recentemente editada
      const proximaPorPost = new Map<string, string>();
      const grupoPorPost = new Map<string, any[]>();
      for (const t of tarefasAbertas) {
        const pid = getProp(t, env.notion.taskProps.post)?.relation?.[0]?.id;
        if (!pid) continue;
        if (!grupoPorPost.has(pid)) grupoPorPost.set(pid, []);
        grupoPorPost.get(pid)!.push(t);
      }
      for (const [pid, lista] of grupoPorPost) {
        lista.sort((a, b) => {
          const aProntoProp = getProp(a, env.notion.taskProps.pronto);
          const bProntoProp = getProp(b, env.notion.taskProps.pronto);
          const aPronto = aProntoProp?.formula?.boolean === true ? 1 : 0;
          const bPronto = bProntoProp?.formula?.boolean === true ? 1 : 0;
          if (aPronto !== bPronto) return bPronto - aPronto;
          const aOrdem = getProp(a, 'Ordem')?.select?.name ?? 'zzz';
          const bOrdem = getProp(b, 'Ordem')?.select?.name ?? 'zzz';
          if (aOrdem !== bOrdem) return aOrdem.localeCompare(bOrdem);
          return (b.last_edited_time as string).localeCompare(
            a.last_edited_time as string,
          );
        });
        const primeira = lista[0];
        if (primeira) {
          const tp = Object.values(primeira.properties).find(
            (p: any) => p.type === 'title',
          ) as any;
          const titulo = txt(tp?.title);
          if (titulo) proximaPorPost.set(pid, titulo);
        }
      }

      // Atribui nos eventos de tarefa — só quando a próxima não é a própria
      // tarefa concluída (caso o status local ainda esteja como aberta)
      for (const ev of eventos) {
        if (ev.tipo !== 'tarefa') continue;
        const proxima = proximaPorPost.get(ev.postId);
        if (proxima && proxima !== ev.tarefaTitulo) {
          ev.proximaTarefa = proxima;
        }
      }
    } catch (err: any) {
      console.warn('[atualizacoes] falhou lookup próxima tarefa:', err?.message);
    }
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
  ['list-atualizacoes-recentes-v6-proxima'],
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

const _colaboradoresNaMemoria = naMemoria(() => _listColaboradoresCached(), 120_000);
export async function listColaboradores(): Promise<ColaboradorResumo[]> {
  return _colaboradoresNaMemoria();
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

export type TarefaRegua = {
  tarefaId: string;
  titulo: string;
  status: string | null;
  /** Data Entrega no fuso de São Paulo (YYYY-MM-DD). */
  prazo: string | null;
  postId: string | null;
  postTitulo: string | null;
  projetoId: string | null;
};

function dataEmSaoPaulo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (iso.length <= 10) return iso;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(iso),
  );
}

/** Tarefas da cadeia semanal do post (Arte → Aprovação | Arte → Enviar Post
 *  Aprovação → Aprovação | Post) com Data Entrega no intervalo. */
export async function listarTarefasDaRegua(inicio: string, fim: string): Promise<TarefaRegua[]> {
  const brutas: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      start_cursor: cursor,
      page_size: 100,
      filter: {
        and: [
          { property: 'Data Entrega', date: { on_or_after: inicio } },
          { property: 'Data Entrega', date: { on_or_before: `${fim}T23:59:59-03:00` } },
          {
            or: ['Arte', 'Enviar Post', 'Aprovação | Post'].map((t) => ({
              property: 'Tarefa',
              title: { contains: t },
            })),
          },
        ],
      },
    });
    brutas.push(...(res.results as any[]));
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const postIds = [
    ...new Set(
      brutas
        .map((t) => (getProp(t, env.notion.taskProps.post)?.relation ?? [])[0]?.id as string | undefined)
        .filter((id): id is string => !!id),
    ),
  ];
  const titulos = new Map<string, string>();
  await Promise.all(
    postIds.map(async (id) => {
      try {
        const p = await cachedPageRetrieve(id);
        const tp = Object.values(p.properties).find((x: any) => x.type === 'title') as any;
        titulos.set(id, txt(tp?.title) || 'Post sem título');
      } catch {
        /* post sem acesso: fica sem título */
      }
    }),
  );

  return brutas.map((t) => {
    const tt = Object.values(t.properties).find((x: any) => x.type === 'title') as any;
    const postId = ((getProp(t, env.notion.taskProps.post)?.relation ?? [])[0]?.id as string) ?? null;
    return {
      tarefaId: t.id,
      titulo: (txt(tt?.title) || '').trim(),
      status: getProp(t, env.notion.taskProps.status)?.status?.name ?? null,
      prazo: dataEmSaoPaulo(getProp(t, 'Data Entrega')?.date?.start),
      postId,
      postTitulo: postId ? titulos.get(postId) ?? null : null,
      projetoId: ((getProp(t, 'Projeto')?.relation ?? [])[0]?.id as string) ?? null,
    };
  });
}

async function blocosDaPaginaSemCache(blockId: string, profundidade = 0): Promise<any[]> {
  if (profundidade > 4) return [];
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const b of res.results as any[]) {
      out.push(b);
      if (b.has_children) out.push(...(await blocosDaPaginaSemCache(b.id, profundidade + 1)));
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}

/**
 * Coloca o link dos materiais do cliente na seção "Materiais" (aba Lud.) do
 * post, onde a equipe já guarda esse link. O "Link do Google Drive" fica só
 * com a arte. Não repete um link que já esteja na seção.
 * Retorna false se o post não tem a seção (o link segue no comentário).
 */
export async function registrarMateriaisNoPost(
  postId: string,
  url: string,
  legenda: string,
): Promise<boolean> {
  if (ehPostDoPortal(postId)) {
    const post = await getPostDoPortal(postId);
    if (!post) return false;
    const semQuery = url.split('?')[0];
    if (post.materiaisLinks.some((l) => l.url.split('?')[0] === semQuery)) return true;
    await atualizarPostDoPortal(postId, { materiaisLinks: [...post.materiaisLinks, { name: legenda, url }] }, null);
    return true;
  }
  const blocos = await blocosDaPaginaSemCache(postId);
  const norm = (s: string) => s.toLowerCase().replace(/[:.\s]+/g, ' ').trim();
  const idx = blocos.findIndex((b) => ehHeading(b) && norm(rtTexto(b)) === 'materiais');
  if (idx < 0) return false;

  const semQuery = url.split('?')[0];
  for (let i = idx + 1; i < blocos.length && !ehHeading(blocos[i]); i++) {
    if (JSON.stringify(blocos[i]).includes(semQuery)) return true;
  }

  const heading = blocos[idx];
  const pai = heading.parent?.block_id ?? heading.parent?.page_id;
  if (!pai) return false;
  await notion.blocks.children.append({
    block_id: pai,
    after: heading.id,
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `${legenda}: ` } },
            { type: 'text', text: { content: url, link: { url } } },
          ],
        },
      },
    ],
  });
  return true;
}

/**
 * Tarefas abertas de vários posts (status real de cada post), por post.
 * Guardado por 1 min (a página de entrega chama isso pra dezenas de posts a cada abertura).
 */
export async function listarTarefasAbertasDosPosts(postIds: string[]): Promise<Map<string, TarefaDoProjeto[]>> {
  const ids = [...new Set(postIds)].sort();
  if (!ids.length) return new Map();
  const entradas = await _tarefasAbertasDosPostsCached(ids.join(','));
  return new Map(entradas);
}

const _tarefasAbertasDosPostsCached = cacheComReserva(
  async (idsJuntos: string) => [...(await _listarTarefasAbertasDosPosts(idsJuntos.split(','))).entries()],
  ['tarefas-abertas-dos-posts-v1'],
  { revalidate: 60, tags: [TAG_TAREFAS] },
);

async function _listarTarefasAbertasDosPosts(
  postIds: string[],
): Promise<Map<string, TarefaDoProjeto[]>> {
  const out = new Map<string, TarefaDoProjeto[]>();
  // Posts do portal: tarefas abertas vêm do banco do portal.
  const doPortal = [...new Set(postIds.filter(ehPostDoPortal))];
  if (doPortal.length > 0) {
    for (const t of await listarTarefasDoPortal(doPortal)) {
      if (!tarefaDoPortalAberta(t)) continue;
      const lista = out.get(t.postId) ?? [];
      lista.push(portalTarefaDoProjeto(t));
      out.set(t.postId, lista);
    }
  }
  const unicos = [...new Set(postIds.filter((id) => !ehPostDoPortal(id)))];
  const lotes: string[][] = [];
  for (let i = 0; i < unicos.length; i += 25) lotes.push(unicos.slice(i, i + 25));
  // Os lotes vão juntos pro Notion (antes era um depois do outro).
  await Promise.all(lotes.map(async (lote) => {
    let cursor: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: env.notion.tarefasDbId,
        start_cursor: cursor,
        page_size: 100,
        filter: {
          and: [
            {
              or: lote.map((id) => ({
                property: env.notion.taskProps.post,
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
      for (const t of res.results as any[]) {
        const tt = Object.values(t.properties).find((x: any) => x.type === 'title') as any;
        const postId = (getProp(t, env.notion.taskProps.post)?.relation ?? [])[0]?.id ?? null;
        if (!postId) continue;
        const lista = out.get(postId) ?? [];
        lista.push({
          id: t.id,
          titulo: txt(tt?.title) || 'Tarefa',
          pessoa: getProp(t, 'Pessoa')?.people?.[0]?.name ?? null,
          pessoaAvatar: getProp(t, 'Pessoa')?.people?.[0]?.avatar_url ?? null,
          status: getProp(t, env.notion.taskProps.status)?.status?.name ?? null,
          prazo: dataEmSaoPaulo(
            getProp(t, 'Data Entrega')?.date?.start ?? getProp(t, 'Data Inicial')?.date?.start,
          ),
          postId,
          postTitulo: null,
          postData: null,
          ordem: getProp(t, 'Ordem')?.select?.name ?? null,
          ordemUm: getProp(t, 'Ordem (1)')?.select?.name ?? null,
        });
        out.set(postId, lista);
      }
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
  }));
  return out;
}

// ============================================================================
// Ponte com o conteúdo do portal (ids lud_ / ludt_ — ver lib/conteudo-portal.ts)
// ============================================================================

const semTracos = (id: string) => id.replace(/-/g, '').toLowerCase();

/** Nome do projeto como no Notion ("IG | @…"), pra bater com as outras telas. */
async function nomesDosProjetos(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    for (const p of await listAllProjetos()) out.set(semTracos(p.id), p.nome);
  } catch {
    /* sem nomes: cai no da tabela do portal */
  }
  for (const p of await listarProjetosDoPortal()) {
    if (!out.has(semTracos(p.projetoId)) && p.nome) out.set(semTracos(p.projetoId), p.nome);
  }
  return out;
}

async function nomeDoProjetoPortal(projetoId: string): Promise<string> {
  return (await nomesDosProjetos()).get(semTracos(projetoId)) ?? 'Projeto';
}

async function portalPostDetalhado(postId: string): Promise<PostDetalhado | null> {
  const post = await getPostDoPortal(postId);
  if (!post || post.status === 'Cancelado') return null;
  const tarefas = await listarTarefasDoPortal([postId]);
  return paraPostDetalhado(post, await nomeDoProjetoPortal(post.projetoId), tarefas.map((t) => t.id));
}

async function portalTarefaComPost(tarefaId: string): Promise<{ tarefa: TarefaPendente } | null> {
  const t = await getTarefaDoPortal(tarefaId);
  if (!t) return null;
  const post = await getPostDoPortal(t.postId);
  if (!post) return null;
  return { tarefa: paraTarefaPendente(t, post, await nomeDoProjetoPortal(post.projetoId)) };
}

/** Primeira tarefa do cliente aberta na ordem; "pronta" = tudo antes dela já fechou. */
async function portalTarefaClientePronta(
  postId: string,
  exigirPronto: boolean,
): Promise<{ tarefaId: string; titulo: string } | null> {
  const t = tarefaDoClienteAgora(await listarTarefasDoPortal([postId]), exigirPronto);
  return t ? { tarefaId: t.id, titulo: t.titulo } : null;
}

/** Pendências do cliente que vivem no portal (entram na home dele junto com as do Notion). */
async function tarefasPendentesDoPortal(projetoIds: string[]): Promise<TarefaPendente[]> {
  const projetos = (await listarProjetosDoPortal()).filter((p) =>
    projetoIds.some((id) => semTracos(id) === semTracos(p.projetoId)),
  );
  if (projetos.length === 0) return [];
  const posts = await listarPostsDoPortal({ projetoIds: projetos.map((p) => p.projetoId) });
  if (posts.length === 0) return [];
  const tarefas = await listarTarefasDoPortal(posts.map((p) => p.id));
  const nomes = await nomesDosProjetos();
  const out: TarefaPendente[] = [];
  for (const p of posts) {
    const t = tarefaDoClienteAgora(tarefas.filter((x) => x.postId === p.id));
    if (t) out.push(paraTarefaPendente(t, p, nomes.get(semTracos(p.projetoId)) ?? 'Projeto'));
  }
  return out;
}

async function portalAprovarTarefa(tarefaId: string, comentario?: string): Promise<void> {
  const t = await getTarefaDoPortal(tarefaId);
  if (!t) throw new Error('tarefa não encontrada');
  await concluirTarefaDoPortal(tarefaId);
  const linhas = [`✅ ${t.titulo} — aprovado pelo cliente.`];
  if (comentario && comentario.trim()) linhas.push('', comentario.trim());
  await comentarPostDoPortal(t.postId, linhas.join('\n'), null, tarefaId);
}

/** Próximo dia útil às 17h de Brasília (prazo padrão de alteração). */
function proximoDiaUtil17h(): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const d = new Date(`${hoje}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return `${d.toISOString().slice(0, 10)}T17:00:00-03:00`;
}

async function portalPedirAlteracao(tarefaId: string, comentario: string): Promise<void> {
  const t = await getTarefaDoPortal(tarefaId);
  if (!t) throw new Error('tarefa não encontrada');
  await atualizarTarefaDoPortal(tarefaId, { status: 'Reprovado', finalizadaEm: new Date().toISOString() });
  const base = t.titulo.replace(/^(Alteração|Aprovação) \| /, '');
  const prazo = proximoDiaUtil17h();
  await criarTarefasDoPortal(t.postId, [
    { titulo: `Alteração | ${base}`, ordem: t.ordem, ordemUm: '02', maeId: t.id, prazo },
    { titulo: `Aprovação | ${base}`, ordem: t.ordem, ordemUm: '03', maeId: t.id, prazo },
  ]);
  await comentarPostDoPortal(
    t.postId,
    `🔁 ${t.titulo} — alteração solicitada pelo cliente.\n\n${comentario.trim()}`,
    null,
    tarefaId,
  );
}

async function portalAtualizarPrazo(
  tarefaId: string,
  novaData: string,
): Promise<{ anterior: string | null; titulo: string; postId: string | null }> {
  const t = await getTarefaDoPortal(tarefaId);
  if (!t) throw new Error('tarefa não encontrada');
  const hora = t.prazo
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(t.prazo))
    : '17:00';
  await atualizarTarefaDoPortal(tarefaId, { prazo: `${novaData}T${hora}:00-03:00` });
  return { anterior: dataEmSaoPaulo(t.prazo), titulo: t.titulo, postId: t.postId };
}

function portalTarefaDoProjeto(t: TarefaPortal): TarefaDoProjeto {
  return {
    id: t.id,
    titulo: t.titulo,
    pessoa: t.responsavelNome,
    status: t.status,
    prazo: dataEmSaoPaulo(t.prazo),
    postId: t.postId,
    postTitulo: null,
    postData: null,
    ordem: String(t.ordem).padStart(2, '0'),
    ordemUm: t.ordemUm,
  };
}

function portalPostCalendario(p: PostPortal, tarefas: TarefaPortal[], nome: string): PostCalendario {
  const atual = tarefas.find(tarefaDoPortalAberta) ?? null;
  const etapa: EtapaPost =
    p.status === 'Postado' ? 'publicado' : atual ? tituloParaEtapa(atual.titulo) : 'rascunho';
  const out: PostCalendario = {
    id: p.id,
    titulo: p.titulo,
    data: p.dataPostagem ?? '',
    status: p.status,
    formato: [],
    formatoNome: p.formato,
    tipo: /reel/i.test(p.formato ?? '') ? 'reels' : /stor/i.test(p.formato ?? '') ? 'story' : 'post',
    projetoId: p.projetoId,
    projetoNome: nome,
    cor: ETAPA_INFO[etapa].cor,
    etapa,
    etapaLabel: ETAPA_INFO[etapa].label,
    tarefaAtualTitulo: atual?.titulo ?? null,
    demanda: null,
    statusGeral: atual?.titulo ?? (p.status === 'Postado' ? 'Postado' : null),
    icon: null,
  };
  ajustarAgendado(out);
  out.cor = ETAPA_INFO[out.etapa].cor;
  out.etapaLabel = ETAPA_INFO[out.etapa].label;
  return out;
}

/**
 * Listas de posts (calendário, home, entregas): entram os posts do portal e
 * saem as posições do Notion de projetos que já rodam no portal (a partir
 * da data `desde`), pra não aparecer em dobro.
 */
async function mesclarComPortal(
  posts: PostCalendario[],
  f: { projetoIds?: string[]; inicio: string; fim: string },
): Promise<PostCalendario[]> {
  const projetos = await listarProjetosDoPortal();
  if (projetos.length === 0) return posts;
  const desdePor = new Map(projetos.map((p) => [semTracos(p.projetoId), p.desde]));
  // Depois que o projeto passou pro portal, o post do Notion só fica se já andou lá
  // (produção ou postado): a equipe às vezes segue a produção no Notion, e aí o
  // Notion é que está certo. Nesse caso a cópia do portal (mesma data e título) sai.
  const andouNoNotion = (p: PostCalendario) =>
    p.status === 'Postado' || (!!p.statusGeral && !/pauta|ideia|novo post/i.test(p.statusGeral));
  const filtrados = posts.filter((p) => {
    const desde = desdePor.get(semTracos(p.projetoId));
    return !desde || !p.data || p.data.slice(0, 10) < desde || andouNoNotion(p);
  });
  const normal = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const gemeo = new Set(filtrados.map((p) => `${semTracos(p.projetoId)}|${(p.data ?? '').slice(0, 10)}|${normal(p.titulo)}`));
  const alvo = f.projetoIds
    ? projetos.filter((p) => f.projetoIds!.some((id) => semTracos(id) === semTracos(p.projetoId)))
    : projetos;
  if (alvo.length === 0) return filtrados;
  const doPortal = await listarPostsDoPortal({
    projetoIds: alvo.map((p) => p.projetoId),
    inicio: f.inicio,
    fim: f.fim,
  });
  if (doPortal.length === 0) return filtrados;
  const tarefas = await listarTarefasDoPortal(doPortal.map((p) => p.id));
  const nomes = await nomesDosProjetos();
  const extras = doPortal
    .filter((p) => !gemeo.has(`${semTracos(p.projetoId)}|${(p.dataPostagem ?? '').slice(0, 10)}|${normal(p.titulo ?? '')}`))
    .map((p) =>
    portalPostCalendario(
      p,
      tarefas.filter((t) => t.postId === p.id),
      nomes.get(semTracos(p.projetoId)) ?? 'Projeto',
    ),
  );
  return [...filtrados, ...extras].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
}

/**
 * Posições que o Notion ainda tem pro projeto no mês (ex.: os "Novo Post" de
 * dezembro). Lê direto do Notion, sem a mescla com o portal — serve pra
 * importar as datas pro calendário do portal.
 */
export async function posicoesDoNotionNoMes(
  projetoId: string,
  year: number,
  month: number,
): Promise<{ id: string; titulo: string; data: string; formatoNome: string | null }[]> {
  const posts = await _listPostsDoMesCached([projetoId], year, month);
  return posts
    .filter((p) => semTracos(p.projetoId) === semTracos(projetoId) && p.data)
    .map((p) => ({ id: p.id, titulo: p.titulo, data: p.data.slice(0, 10), formatoNome: p.formatoNome }));
}

// ---------------------------------------------------------------------------
// Dashboard: tarefas abertas de todos os projetos
// ---------------------------------------------------------------------------

export type TarefaDeTodos = TarefaDoProjeto & { projetoId: string | null; pronto?: boolean; tipoOriginal?: string | null };

/**
 * Tarefas abertas de todos os projetos que vencem entre 90 dias atrás e 31
 * dias pra frente — base do dashboard (esta semana, próximos 30 dias e lista
 * de projetos). Duas consultas paginadas (tarefas + posts) em vez de uma por
 * projeto, pra não estourar o limite do Notion. Datas no fuso de São Paulo.
 */
async function _listarTarefasAbertasDeTodosUncached(): Promise<TarefaDeTodos[]> {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const desloca = (n: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const desde = desloca(-90);
  const ate = desloca(31);

  const brutas: any[] = [];
  let cursor: string | undefined;
  do {
    const r = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      page_size: 100,
      start_cursor: cursor,
      filter: {
        and: [
          { property: 'Data Entrega', date: { on_or_after: desde } },
          { property: 'Data Entrega', date: { on_or_before: `${ate}T23:59:59-03:00` } },
          ...STATUS_TAREFA_FECHADOS.map((s) => ({
            property: env.notion.taskProps.status,
            status: { does_not_equal: s },
          })),
        ],
      },
    });
    brutas.push(...(r.results as any[]));
    cursor = r.has_more ? r.next_cursor ?? undefined : undefined;
  } while (cursor && brutas.length < 2000);

  // Títulos e datas dos posts numa consulta só (todos os projetos).
  const posts = new Map<string, { titulo: string; data: string | null }>();
  cursor = undefined;
  try {
    do {
      const r = await notion.databases.query({
        database_id: env.notion.postagensDbId,
        page_size: 100,
        start_cursor: cursor,
        filter: {
          and: [
            { property: env.notion.postProps.data, date: { on_or_after: desloca(-120) } },
            { property: env.notion.postProps.data, date: { on_or_before: desloca(90) } },
          ],
        },
      });
      for (const p of r.results as any[]) {
        const tp = Object.values(p.properties).find((x: any) => x.type === 'title') as any;
        posts.set(p.id, {
          titulo: txt(tp?.title) || 'Post sem título',
          data: getProp(p, env.notion.postProps.data)?.date?.start ?? null,
        });
      }
      cursor = r.has_more ? r.next_cursor ?? undefined : undefined;
    } while (cursor && posts.size < 3000);
  } catch (err: any) {
    console.warn('[dashboard] títulos dos posts:', err?.message);
  }

  return brutas.map((t) => {
    const tt = Object.values(t.properties).find((x: any) => x.type === 'title') as any;
    const postId = ((getProp(t, env.notion.taskProps.post)?.relation ?? [])[0]?.id as string) ?? null;
    const post = postId ? posts.get(postId) : undefined;
    return {
      id: t.id,
      titulo: (txt(tt?.title) || 'Tarefa').trim(),
      pessoa: getProp(t, 'Pessoa')?.people?.[0]?.name ?? null,
      pessoaAvatar: getProp(t, 'Pessoa')?.people?.[0]?.avatar_url ?? null,
      status: getProp(t, env.notion.taskProps.status)?.status?.name ?? null,
      prazo: dataEmSaoPaulo(getProp(t, 'Data Entrega')?.date?.start),
      postId,
      postTitulo: post?.titulo ?? null,
      postData: post?.data ?? null,
      ordem: getProp(t, 'Ordem')?.select?.name ?? null,
      ordemUm: getProp(t, 'Ordem (1)')?.select?.name ?? null,
      entregaId: getProp(t, 'Entregas')?.relation?.[0]?.id ?? null,
      projetoId: ((getProp(t, 'Projeto')?.relation ?? [])[0]?.id as string) ?? null,
      pronto: formulaVerdadeira(getProp(t, env.notion.taskProps.pronto)),
      tipoOriginal: getProp(t, 'tipo original')?.select?.name ?? null,
    };
  });
}

/** Fórmula " Pronto" do Notion: liga quando a tarefa já pode ser feita. */
function formulaVerdadeira(prop: any): boolean {
  const f = prop?.formula;
  if (!f) return false;
  if (f.type === 'boolean') return f.boolean === true;
  if (f.type === 'string') return !!f.string && !/^(false|não|nao|0)$/i.test(f.string.trim());
  if (f.type === 'number') return (f.number ?? 0) > 0;
  return false;
}

const _listarTarefasAbertasDeTodosCached = cacheComReserva(
  medido('tarefas de todos', _listarTarefasAbertasDeTodosUncached),
  ['tarefas-abertas-de-todos-v3'],
  { revalidate: 120, tags: [TAG_TAREFAS] },
);

export async function listarTarefasAbertasDeTodos(): Promise<TarefaDeTodos[]> {
  const feitas = lerFeitasRecentes();
  const ls = await _listarTarefasAbertasDeTodosCached();
  return feitas.size ? ls.filter((t) => !feitas.has(t.id.replace(/-/g, ''))) : ls;
}

// ---------------------------------------------------------------------------
// Página da tarefa (/admin/tarefas/[id])
// ---------------------------------------------------------------------------

export type TarefaDetalhe = {
  id: string;
  titulo: string;
  status: string | null;
  aberta: boolean;
  prazo: string | null;
  finalizada: string | null;
  pessoa: { id: string | null; nome: string; avatar: string | null } | null;
  postId: string | null;
  postTitulo: string | null;
  postData: string | null;
  projetoId: string | null;
  projetoNome: string | null;
  entregaId: string | null;
  entregaNome: string | null;
  ordem: string | null;
  ordemUm: string | null;
  notionUrl: string | null;
};

/** Uma tarefa com o projeto, a entrega e o post dela (a hierarquia da página). */
export async function getTarefaDetalhe(tarefaId: string): Promise<TarefaDetalhe | null> {
  if (ehTarefaDoPortal(tarefaId)) {
    const r = await portalTarefaComPost(tarefaId).catch(() => null);
    if (!r) return null;
    const t = r.tarefa;
    return {
      id: t.tarefaId,
      titulo: t.tarefaTitulo,
      status: null,
      aberta: true,
      prazo: dataEmSaoPaulo(t.tarefaPrazo),
      finalizada: null,
      pessoa: null,
      postId: t.postId,
      postTitulo: t.postTitulo,
      postData: t.postData,
      projetoId: t.projetoId || null,
      projetoNome: t.projetoNome,
      entregaId: null,
      entregaNome: null,
      ordem: null,
      ordemUm: null,
      notionUrl: null,
    };
  }
  try {
    const t = (await notion.pages.retrieve({ page_id: tarefaId })) as any;
    if (t.archived) return null;
    const titulo =
      txt((Object.values(t.properties).find((p: any) => p.type === 'title') as any)?.title) || 'Tarefa';
    const postId = (getProp(t, env.notion.taskProps.post)?.relation ?? [])[0]?.id ?? null;
    const entregaId = (getProp(t, 'Entregas')?.relation ?? [])[0]?.id ?? null;
    const [post, entrega] = await Promise.all([
      postId ? (cachedPageRetrieve(postId).catch(() => null) as Promise<any>) : Promise.resolve(null),
      entregaId ? (cachedPageRetrieve(entregaId).catch(() => null) as Promise<any>) : Promise.resolve(null),
    ]);
    const projetoId =
      (getProp(t, 'Projeto')?.relation ?? [])[0]?.id ??
      (post ? (getProp(post, env.notion.postProps.projeto)?.relation ?? [])[0]?.id : null) ??
      null;
    const projeto = projetoId ? ((await cachedPageRetrieve(projetoId).catch(() => null)) as any) : null;
    const tituloDe = (pg: any) =>
      pg ? txt((Object.values(pg.properties).find((p: any) => p.type === 'title') as any)?.title) || null : null;
    const status = getProp(t, env.notion.taskProps.status)?.status?.name ?? null;
    const pessoa = getProp(t, 'Pessoa')?.people?.[0] ?? null;
    return {
      id: t.id,
      titulo,
      status,
      aberta: !STATUS_TAREFA_FECHADOS.includes(status ?? ''),
      prazo: dataEmSaoPaulo(getProp(t, 'Data Entrega')?.date?.start ?? getProp(t, 'Data Inicial')?.date?.start),
      finalizada: getProp(t, 'Finalizada em ')?.date?.start ?? null,
      pessoa: pessoa ? { id: pessoa.id ?? null, nome: pessoa.name ?? 'Sem nome', avatar: pessoa.avatar_url ?? null } : null,
      postId,
      postTitulo: tituloDe(post),
      postData: post ? getProp(post, env.notion.postProps.data)?.date?.start?.slice(0, 10) ?? null : null,
      projetoId,
      projetoNome: tituloDe(projeto),
      entregaId,
      entregaNome: tituloDe(entrega),
      ordem: getProp(t, 'Ordem')?.select?.name ?? null,
      ordemUm: getProp(t, 'Ordem (1)')?.select?.name ?? null,
      notionUrl: t.url ?? null,
    };
  } catch {
    return null;
  }
}


/** Posts contratados por mês: propriedade numérica "N" da página do projeto no Notion. */
export async function getPostsPorMes(projetoId: string): Promise<number | null> {
  try {
    const pg: any = await comRetry(() => notion.pages.retrieve({ page_id: projetoId }));
    const n = pg.properties?.['N']?.number;
    return typeof n === 'number' ? n : null;
  } catch {
    return null;
  }
}

/** Grava os posts contratados por mês na propriedade "N" do projeto. */
export async function salvarPostsPorMes(projetoId: string, n: number | null): Promise<void> {
  await comRetry(() =>
    notion.pages.update({ page_id: projetoId, properties: { N: { number: n } } as any }),
  );
}

/** Posts da Esteira com copy gerada pelo portal (blocos com o marcador), pra revisão/limpeza. */
export async function listarCopiasDoPortalNaEsteira(): Promise<
  { postId: string; postTitulo: string; projetoNome: string; blocos: number }[]
> {
  const cards = await listarTarefasDaEsteira();
  const unicos = [...new Map(cards.filter((c) => c.postId).map((c) => [c.postId, c])).values()];
  const out: { postId: string; postTitulo: string; projetoNome: string; blocos: number }[] = [];
  // De 6 em 6, pra não estourar o limite do Notion nem o tempo da função.
  for (let i = 0; i < unicos.length; i += 6) {
    await Promise.all(
      unicos.slice(i, i + 6).map(async (c) => {
        const nos = await nosDaPagina(c.postId).catch(() => [] as NoCopy[]);
        const n = nos.filter((x) => ehHeading(x.block) && MARCADOR_COPY.test(rtTexto(x.block))).length;
        if (n) out.push({ postId: c.postId, postTitulo: c.postTitulo, projetoNome: c.projetoNome, blocos: n });
      }),
    );
  }
  return out.sort((a, b) => a.projetoNome.localeCompare(b.projetoNome, 'pt-BR'));
}

/**
 * Apaga dos posts as copies geradas pelo portal: cada sub-título com o marcador
 * "🤖 Copy Produzida — v" / "🤖 Reescrita Claude — v" e o texto embaixo dele, até
 * o próximo título grande, divisor ou outro marcador (mesma regra da limpeza que
 * o próprio portal fazia). simular = só lista o que sairia.
 */
export async function apagarCopiasDoPortal(
  postIds: string[],
  simular: boolean,
): Promise<{ postId: string; blocos: number; depoisDoDivisor: string | null; amostra: string[] }[]> {
  const out: { postId: string; blocos: number; depoisDoDivisor: string | null; amostra: string[] }[] = [];
  for (const postId of postIds) {
    const nos = await nosDaPagina(postId);
    const apagar: any[] = [];
    let depoisDoDivisor: string | null = null;
    const amostra: string[] = [];
    for (const n of nos) {
      if (!ehHeading(n.block) || !MARCADOR_COPY.test(rtTexto(n.block))) continue;
      apagar.push(n.block);
      amostra.push(rtTexto(n.block).slice(0, 80));
      // Só os blocos criados JUNTO com o marcador (mesmo autor, até 5 min depois).
      // Assim não sai a copy da skill nem o template que vêm logo em seguida.
      const autor = n.block.created_by?.id;
      const t0 = Date.parse(n.block.created_time);
      let i = n.index + 1;
      for (; i < n.siblings.length; i++) {
        const b = n.siblings[i];
        if (b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'divider') break;
        if (ehHeading(b) && MARCADOR_COPY.test(rtTexto(b))) break;
        const mesmoLote = b.created_by?.id === autor && Math.abs(Date.parse(b.created_time) - t0) <= 5 * 60_000;
        if (!mesmoLote) break;
        apagar.push(b);
      }
      // O que vem logo depois do divisor (pra conferir se sobrou copy depois dele).
      // O que fica logo depois do trecho apagado (pra conferir).
      const prox = n.siblings[i];
      if (prox) depoisDoDivisor = `${prox.type}: ${rtTexto(prox).slice(0, 60)}`;
    }
    const unicos = [...new Map(apagar.map((b) => [b.id, b])).values()];
    if (!simular) {
      for (const b of unicos) {
        await comRetry(() => notion.blocks.delete({ block_id: b.id })).catch(() => null);
      }
    }
    out.push({ postId, blocos: unicos.length, depoisDoDivisor, amostra });
  }
  return out;
}


// ─── Feedback da aprovação da Esteira Copy ─────────────────────────────────

const FEEDBACKS_COPY_DB_ID = 'd78e1abf9eca4d069aa7aa57fbae5a17';
const REGEX_CAMPO_COPY: Record<'voice' | 'carrossel' | 'legenda', RegExp> = {
  voice: /^roteiro\s*do\s*reel/i,
  carrossel: /^copy\s*para\s*carrossel/i,
  legenda: /^legenda$/i,
};
const ROTULO_CAMPO_COPY = { voice: 'Voice over', carrossel: 'Carrossel', legenda: 'Legenda' } as const;
export type CampoCopy = keyof typeof ROTULO_CAMPO_COPY;

const rtPlano = (t: string) =>
  (t.match(/[\s\S]{1,1900}/g) ?? ['']).map((c) => ({ type: 'text', text: { content: c } }));
const TIPOS_TEXTO = new Set(['paragraph', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout', 'heading_3', 'to_do']);

/**
 * Edita a copy direto na seção do post no Notion.
 * frase: troca o trecho no bloco que o contém. geral: atualiza bloco a bloco
 * (mesmo número de linhas) ou refaz a seção com parágrafos.
 */
export async function editarCopyNoPost(postId: string, campo: CampoCopy, original: string, novo: string, modo: 'frase' | 'geral'): Promise<void> {
  const nos = await nosDaPagina(postId);
  const ehTitulo = (b: any) => b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'heading_3';
  const no = nos.find((n) => ehTitulo(n.block) && REGEX_CAMPO_COPY[campo].test(rtTexto(n.block).trim()));
  if (!no) throw new Error(`Não achei a seção ${ROTULO_CAMPO_COPY[campo]} no post.`);
  const blocos: any[] = [];
  for (let i = no.index + 1; i < no.siblings.length; i++) {
    const b = no.siblings[i];
    if (ehTitulo(b)) break;
    if (b.type === 'divider' && campo === 'legenda') break;
    blocos.push(b);
  }
  const atualizar = (b: any, texto: string) =>
    comRetry(() => notion.blocks.update({ block_id: b.id, [b.type]: { rich_text: rtPlano(texto) } } as any));

  if (modo === 'frase') {
    // Trecho = uma frase, uma linha ou várias linhas seguidas (um card inteiro). O novo pode ter
    // outro número de linhas, ou vir vazio (apagar).
    const linhasOrig = original.split('\n').map((l) => l.trim()).filter(Boolean);
    const linhasNovas = novo.split('\n').map((l) => l.trim()).filter(Boolean);
    const apagar = (b: any) => comRetry(() => notion.blocks.delete({ block_id: b.id }));
    const inserirDepois = (b: any, linhas: string[]) =>
      linhas.length
        ? comRetry(() =>
            notion.blocks.children.append({
              block_id: no.parentId,
              after: b.id,
              children: linhas.map((l) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: rtPlano(l) } })),
            } as any),
          )
        : Promise.resolve(null);
    if (linhasOrig.length <= 1) {
      const alvo = blocos.find((b) => TIPOS_TEXTO.has(b.type) && rtTexto(b).includes(original.trim()));
      if (!alvo) throw new Error('Não achei essa frase no post (ela pode ter mudado no Notion).');
      const resto = rtTexto(alvo).replace(original.trim(), linhasNovas[0] ?? '').trim();
      if (!resto) await apagar(alvo);
      else await atualizar(alvo, resto);
      await inserirDepois(alvo, linhasNovas.slice(1));
      return;
    }
    const comTexto = blocos.filter((b) => TIPOS_TEXTO.has(b.type) && rtTexto(b).trim());
    const ini = comTexto.findIndex((_, i) => linhasOrig.every((l, k) => rtTexto(comTexto[i + k] ?? { type: 'x' }).trim() === l));
    if (ini < 0) throw new Error('Não achei esse trecho no post (ele pode ter mudado no Notion).');
    const trecho = comTexto.slice(ini, ini + linhasOrig.length);
    for (let k = 0; k < Math.min(trecho.length, linhasNovas.length); k++) {
      if (rtTexto(trecho[k]).trim() !== linhasNovas[k]) await atualizar(trecho[k], linhasNovas[k]);
    }
    if (linhasNovas.length > trecho.length) await inserirDepois(trecho[trecho.length - 1], linhasNovas.slice(trecho.length));
    for (const b of trecho.slice(linhasNovas.length)) await apagar(b);
    return;
  }
  const comTexto = blocos.filter((b) => TIPOS_TEXTO.has(b.type) && rtTexto(b));
  const linhas = novo.split('\n').map((l) => l.trim()).filter(Boolean);
  if (linhas.length === comTexto.length) {
    for (let i = 0; i < linhas.length; i++) {
      if (rtTexto(comTexto[i]) !== linhas[i]) await atualizar(comTexto[i], linhas[i]);
    }
    return;
  }
  // Número de linhas mudou: refaz a seção (apaga os blocos de texto e escreve parágrafos).
  for (const b of comTexto) await comRetry(() => notion.blocks.delete({ block_id: b.id })).catch(() => null);
  await comRetry(() =>
    notion.blocks.children.append({
      block_id: no.parentId,
      after: no.block.id,
      children: linhas.map((l) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: rtPlano(l) } })),
    } as any),
  );
}

export async function salvarFeedbackCopy(f: {
  tipo: 'Copy geral' | 'Post inteiro' | 'Frase' | 'Edição da copy' | 'Edição da frase';
  campo: CampoCopy | null;
  texto: string;
  cliente: string;
  post: string;
  postId: string;
  link: string;
  original: string | null;
  novo: string | null;
  skills: string[];
}): Promise<void> {
  const rt = (v: string | null) => ({ rich_text: v ? rtPlano(v) : [] });
  const titulo = (f.texto || (f.novo ? `Editou: ${f.novo}` : f.tipo)).slice(0, 180);
  await comRetry(() =>
    notion.pages.create({
      parent: { database_id: FEEDBACKS_COPY_DB_ID },
      properties: {
        Feedback: { title: [{ type: 'text', text: { content: titulo } }] },
        Tipo: { select: { name: f.tipo } },
        ...(f.campo ? { Campo: { select: { name: ROTULO_CAMPO_COPY[f.campo] } } } : {}),
        Cliente: rt(f.cliente),
        Post: rt(f.post),
        'Post ID': rt(f.postId),
        'Link do post': { url: f.link },
        'Trecho original': rt(f.original),
        'Trecho novo': rt(f.novo),
        'Skills usadas': rt(f.skills.join(', ')),
        Status: { select: { name: 'Novo' } },
      } as any,
      children: f.texto ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: rtPlano(f.texto) } }] : [],
    } as any),
  );
}

/**
 * Post aprovado na Esteira Copy: os feedbacks "Novo" dele viram "Post aprovado".
 * A rodada diária da melhoria contínua só processa esses (feedback de post ainda
 * em ajuste fica de fora). Devolve quantos foram marcados.
 */
export async function marcarFeedbacksDoPostAprovado(postId: string): Promise<number> {
  const sem = postId.replace(/-/g, '');
  const com = sem.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const res: any = await comRetry(() =>
    notion.databases.query({
      database_id: FEEDBACKS_COPY_DB_ID,
      page_size: 100,
      filter: {
        and: [
          { property: 'Status', select: { equals: 'Novo' } },
          { or: [sem, com].map((v) => ({ property: 'Post ID', rich_text: { equals: v } })) },
        ],
      },
    } as any),
  );
  const paginas = (res.results as any[]) ?? [];
  for (const pg of paginas) {
    await comRetry(() => notion.pages.update({ page_id: pg.id, properties: { Status: { select: { name: 'Post aprovado' } } } } as any));
  }
  return paginas.length;
}

// ─── Fila de copy (botão "Produzir copy" da Esteira) ───────────────────────

const FILA_COPY_DB_ID = '5c022436a85d4ec5b6ef2a43179f9429';
export type ItemFilaCopy = { tarefaId: string; postId: string; status: string };

/** Pedidos de copy ainda abertos (Na fila / Produzindo / Erro). */
export async function lerFilaDeCopy(): Promise<ItemFilaCopy[]> {
  const res: any = await comRetry(() =>
    notion.databases.query({
      database_id: FILA_COPY_DB_ID,
      page_size: 100,
      filter: { or: ['Na fila', 'Produzindo', 'Erro'].map((s) => ({ property: 'Status', select: { equals: s } })) },
    } as any),
  );
  return (res.results as any[]).map((p) => ({
    tarefaId: txt(p.properties['Tarefa ID']?.rich_text) || '',
    postId: txt(p.properties['Post ID']?.rich_text) || '',
    status: p.properties['Status']?.select?.name ?? 'Na fila',
  }));
}

/** Coloca o post na fila da skill criar-copy-completo e marca a tarefa B&C em andamento. */
export async function pedirCopyDaSkill(p: { tarefaId: string; postId: string; titulo: string; handle: string; link: string }): Promise<void> {
  const fila = await lerFilaDeCopy().catch(() => [] as ItemFilaCopy[]);
  const semTraco = (x: string) => x.replace(/-/g, '');
  if (fila.some((f) => semTraco(f.postId) === semTraco(p.postId) && f.status !== 'Erro')) return;
  await comRetry(() =>
    notion.pages.create({
      parent: { database_id: FILA_COPY_DB_ID },
      properties: {
        Post: { title: [{ type: 'text', text: { content: p.titulo.slice(0, 180) } }] },
        'Post ID': { rich_text: [{ type: 'text', text: { content: p.postId } }] },
        'Tarefa ID': { rich_text: [{ type: 'text', text: { content: p.tarefaId } }] },
        Cliente: { rich_text: [{ type: 'text', text: { content: p.handle } }] },
        'Link do post': { url: p.link },
        Status: { select: { name: 'Na fila' } },
      } as any,
    } as any),
  );
  await comRetry(() =>
    notion.pages.update({ page_id: p.tarefaId, properties: { [env.notion.taskProps.status]: { status: { name: 'Em Andamento' } } } as any }),
  ).catch(() => null);
}

/** Feedbacks anteriores da Luiza pra um cliente (pra o ajuste na hora respeitar). */
export async function feedbacksAnterioresDoCliente(cliente: string, limite = 15): Promise<string[]> {
  if (!cliente) return [];
  const res: any = await comRetry(() =>
    notion.databases.query({
      database_id: FEEDBACKS_COPY_DB_ID,
      page_size: limite,
      filter: { property: 'Cliente', rich_text: { equals: cliente } },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    } as any),
  ).catch(() => ({ results: [] }));
  return (res.results as any[])
    .map((p) => {
      const t = txt(p.properties?.Feedback?.title);
      const novo = txt(p.properties?.['Trecho novo']?.rich_text);
      const orig = txt(p.properties?.['Trecho original']?.rich_text);
      return novo && orig ? `trocou "${orig.slice(0, 120)}" por "${novo.slice(0, 120)}"` : t;
    })
    .filter((x) => x && !/^TESTE/i.test(x));
}

/** Troca o formato do post (relation "Formato") pela opção escolhida na Esteira. */
export async function mudarFormatoDoPost(postId: string, formatoId: string): Promise<void> {
  await comRetry(() =>
    notion.pages.update({ page_id: postId, properties: { Formato: { relation: [{ id: formatoId }] } } as any }),
  );
}

/**
 * Card da Esteira de uma tarefa só, lendo direto do Notion (sem montar a esteira
 * inteira). Usado na página de revisão, que precisa abrir rápido mesmo com o
 * cache frio.
 */
export async function cardDaEsteiraPorTarefa(tarefaId: string): Promise<CardEsteiraNotion | null> {
  const base = await getTarefaComPost(tarefaId);
  if (!base) return null;
  const t = base.tarefa;
  const pagina: any = await comRetry(() => notion.pages.retrieve({ page_id: tarefaId }));
  const status = (getProp(pagina, 'Status')?.status?.name as string | undefined) ?? null;
  const finalizada = (getProp(pagina, 'Finalizada em ')?.date?.start as string | undefined) ?? null;
  const titulo = t.tarefaTitulo || 'Briefing & Copy';
  let coluna: ColunaEsteira = /^altera/i.test(titulo) ? 'reaprovacao' : /^aprova/i.test(titulo) ? 'revisar' : 'fila';
  if (coluna === 'fila') {
    const c = await lerCopyDoPost(t.postId).catch(() => null);
    if (c && (c.legenda || c.carrossel || c.voice)) coluna = 'revisar';
  }
  return {
    tarefaId: t.tarefaId,
    postId: t.postId,
    postTitulo: t.postTitulo,
    postData: t.postData,
    projetoId: t.projetoId,
    projetoNome: t.projetoNome,
    clienteNome: null,
    responsavelId: null,
    responsavelNome: null,
    responsavelAvatar: null,
    prazo: t.tarefaPrazo,
    status,
    finalizada,
    entregaNome: titulo,
    coluna,
  };
}

/**
 * A cliente editou o texto de gravação (voice over) na tela de materiais: troca os
 * parágrafos da callout "Texto para gravação…" do post pelo texto novo.
 * Devolve o texto antigo (pro comentário da equipe) ou null se não achou a callout.
 */
export async function trocarTextoDeGravacao(postId: string, novo: string): Promise<string | null> {
  const ehCalloutDoTexto = (b: any) =>
    (b.type === 'callout' || b.type === 'quote') && /texto (para|pra) grava|voice ?over/i.test(rtTexto(b));
  async function achar(parentId: string, nivel = 0): Promise<any | null> {
    if (nivel > 4) return null;
    const r = await notion.blocks.children.list({ block_id: parentId, page_size: 100 });
    const blocos = r.results as any[];
    const alvo = blocos.find(ehCalloutDoTexto);
    if (alvo) return alvo;
    for (const b of blocos) {
      if (b.has_children && b.type !== 'child_page' && b.type !== 'child_database') {
        const x = await achar(b.id, nivel + 1);
        if (x) return x;
      }
    }
    return null;
  }
  const callout = await achar(postId);
  if (!callout) return null;
  const filhos = callout.has_children
    ? ((await notion.blocks.children.list({ block_id: callout.id, page_size: 100 })).results as any[])
    : [];
  const antigo = filhos.map((f) => rtTexto(f)).filter(Boolean).join('\n\n');
  // Parágrafos novos (linha em branco separa), em pedaços de até 2000 caracteres.
  const paragrafos = novo
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({
      object: 'block' as const,
      type: 'paragraph' as const,
      paragraph: {
        rich_text: (p.match(/[\s\S]{1,2000}/g) ?? []).map((pedaco) => ({ type: 'text' as const, text: { content: pedaco } })),
      },
    }));
  // Primeiro coloca o novo, depois apaga o antigo: se falhar no meio, nada some.
  await notion.blocks.children.append({ block_id: callout.id, children: paragrafos as any });
  for (const f of filhos) {
    await notion.blocks.delete({ block_id: f.id }).catch(() => null);
  }
  return antigo;
}

/**
 * Posts que mudaram no Notion desde `desdeIso`: o próprio post editado ou alguma
 * tarefa dele (etapa concluída, prazo, responsável…). Usado pelo botão Atualizar
 * pra recarregar só o que mudou, e não todos os posts toda vez.
 */
export async function postsEditadosDesde(desdeIso: string): Promise<string[]> {
  const ids = new Set<string>();
  const filtro = { timestamp: 'last_edited_time', last_edited_time: { on_or_after: desdeIso } } as any;
  const varrer = async (database_id: string, pegar: (p: any) => string[]) => {
    let cursor: string | undefined;
    let voltas = 0;
    do {
      const r: any = await notion.databases.query({ database_id, filter: filtro, page_size: 100, start_cursor: cursor });
      for (const p of r.results) for (const id of pegar(p)) ids.add(id);
      cursor = r.has_more ? r.next_cursor ?? undefined : undefined;
    } while (cursor && ++voltas < 10);
  };
  await Promise.all([
    varrer(env.notion.postagensDbId, (p) => [p.id]),
    varrer(env.notion.tarefasDbId, (t) => (getProp(t, env.notion.taskProps.post)?.relation ?? []).map((r: any) => r.id)),
  ]);
  return [...ids];
}

/** Post de uma tarefa (pra abrir a prévia do post no clique numa tarefa). Null se a tarefa não tem post. */
export async function postDaTarefa(tarefaId: string): Promise<string | null> {
  if (ehTarefaDoPortal(tarefaId)) return null;
  try {
    const t = await cachedPageRetrieve(tarefaId);
    return (getProp(t, env.notion.taskProps.post)?.relation ?? [])[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Última etapa concluída de cada post (o post mudou desde o último envio?)
// ---------------------------------------------------------------------------

/**
 * Pra cada post, quando foi a última tarefa concluída nos últimos `dias` dias.
 * Serve pro sinal de "enviado / visto" das tarefas do cliente: envio ou visualização
 * de antes dessa data é da rodada anterior (o post mudou depois), então não conta.
 */
async function _ultimaConclusaoPorPostUncached(dias: number): Promise<Record<string, string>> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  const out: Record<string, string> = {};
  let cursor: string | undefined;
  let paginas = 0;
  do {
    const r: any = await notion.databases.query({
      database_id: env.notion.tarefasDbId,
      page_size: 100,
      start_cursor: cursor,
      filter: {
        and: [
          { property: env.notion.taskProps.status, status: { equals: 'Concluído' } },
          { property: 'Finalizada em ', date: { on_or_after: desde } },
        ],
      },
    });
    for (const t of r.results as any[]) {
      const postId = (getProp(t, env.notion.taskProps.post)?.relation ?? [])[0]?.id?.replace(/-/g, '');
      const quando = getProp(t, 'Finalizada em ')?.date?.start ?? null;
      if (!postId || !quando) continue;
      // "Enviar Post Aprovação" é o próprio envio, não uma mudança no post.
      const tituloT = txt((Object.values(t.properties).find((p: any) => p.type === 'title') as any)?.title) || '';
      if (/enviar\s*post|enviar.*aprova/i.test(tituloT)) continue;
      if (!out[postId] || Date.parse(quando) > Date.parse(out[postId])) out[postId] = quando;
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor && ++paginas < 15);
  return out;
}

const _ultimaConclusaoPorPostCached = unstable_cache(
  (dias: number) => _ultimaConclusaoPorPostUncached(dias),
  ['ultima-conclusao-por-post-v2'],
  { revalidate: 120, tags: [TAG_TAREFAS] },
);

export async function ultimaConclusaoPorPost(dias = 30): Promise<Record<string, string>> {
  return _ultimaConclusaoPorPostCached(dias);
}
