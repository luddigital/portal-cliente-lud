function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optSoft(name: string): string {
  return process.env[name] ?? '';
}

function parseAccountsMap(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
  } catch {
    // ignora JSON inválido — o painel mostra estado "não configurado"
  }
  return {};
}

/**
 * Mapa projetoId -> lista de campanhas. Aceita valor string (1 campanha) OU
 * array de strings (N campanhas), normalizando sempre pra array. Permite um
 * projeto mostrar várias campanhas separadas (ex: seguidores + WhatsApp).
 */
function parseCampaignsMap(raw: string): Record<string, string[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) out[k] = v.map(String);
        else if (typeof v === 'string' && v) out[k] = [v];
      }
      return out;
    }
  } catch {
    // ignora JSON inválido
  }
  return {};
}

export const env = {
  notion: {
    token: must('NOTION_TOKEN'),
    postagensDbId: must('NOTION_POSTAGENS_DB_ID'),
    tarefasDbId: must('NOTION_TAREFAS_DB_ID'),
    projetosDbId: must('NOTION_PROJETOS_DB_ID'),
    postProps: {
      projeto: opt('NOTION_POST_PROP_PROJETO', 'Projeto'),
      demanda: opt('NOTION_POST_PROP_DEMANDA', 'O que precisamos de você '),
      data: opt('NOTION_POST_PROP_DATA', 'Data Postagem'),
      status: opt('NOTION_POST_PROP_STATUS', 'Status'),
      driveLink: opt('NOTION_POST_PROP_DRIVE_LINK', 'Link do Google Drive'),
      tarefas: opt('NOTION_POST_PROP_TAREFAS', 'Tarefas'),
    },
    taskProps: {
      status: opt('NOTION_TASK_PROP_STATUS', 'Status'),
      finalizada: opt('NOTION_TASK_PROP_FINALIZADA', 'Finalizada em '),
      post: opt('NOTION_TASK_PROP_POST', 'Post'),
      pronto: opt('NOTION_TASK_PROP_PRONTO', ' Pronto'),
    },
    projetoProps: {
      email: opt('NOTION_PROJETO_PROP_EMAIL', 'Email do Cliente'),
    },
    clientesDbId: must('NOTION_CLIENTES_DB_ID'),
    clienteProps: {
      email: opt('NOTION_CLIENTE_PROP_EMAIL', 'E-mail da empresa'),
      projetos: opt('NOTION_CLIENTE_PROP_PROJETOS', 'Projetos'),
      aprovacaoColaborativa: opt(
        'NOTION_CLIENTE_PROP_COLABORATIVA',
        'Aprovação colaborativa',
      ),
    },
    acessosDbId: opt('NOTION_ACESSOS_DB_ID', '376d04d23b4a814683a5c93380459777'),
    acessoProps: {
      email: opt('NOTION_ACESSO_PROP_EMAIL', 'E-mail'),
      cliente: opt('NOTION_ACESSO_PROP_CLIENTE', 'Cliente'),
      nome: opt('NOTION_ACESSO_PROP_NOME', 'Nome'),
      funcao: opt('NOTION_ACESSO_PROP_FUNCAO', 'Função'),
      ativo: opt('NOTION_ACESSO_PROP_ATIVO', 'Ativo'),
    },
    prestadoresDbId: opt('NOTION_PRESTADORES_DB_ID', '15fd04d23b4a8034b164f578349737ca'),
    prestadorProps: {
      pessoa: opt('NOTION_PRESTADOR_PROP_PESSOA', 'Pessoa'),
      funcao: opt('NOTION_PRESTADOR_PROP_FUNCAO', 'Função'),
      email: opt('NOTION_PRESTADOR_PROP_EMAIL', 'E-mail'),
      whatsapp: opt('NOTION_PRESTADOR_PROP_WHATSAPP', 'Whatsapp'),
    },
  },
  drive: {
    clientId: must('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: must('GOOGLE_OAUTH_CLIENT_SECRET'),
    refreshToken: optSoft('GOOGLE_OAUTH_REFRESH_TOKEN'),
    rootFolderId: must('GOOGLE_DRIVE_ROOT_FOLDER_ID'),
  },
  auth: {
    secret: must('AUTH_SECRET'),
    adminEmails: opt('ADMIN_EMAILS', 'oi@lud.digital')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },
  mail: {
    resendKey: optSoft('RESEND_API_KEY'),
    from: opt('MAIL_FROM', 'Lud. <oi@lud.digital>'),
  },
  app: {
    url: opt('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  },
  push: {
    vapidPublic: optSoft('NEXT_PUBLIC_VAPID_PUBLIC_KEY'),
    vapidPrivate: optSoft('VAPID_PRIVATE_KEY'),
    vapidSubject: opt('VAPID_SUBJECT', 'mailto:oi@lud.digital'),
  },
  instagram: {
    // Token long-lived do System User do Business Manager da Lud.
    graphToken: optSoft('IG_GRAPH_TOKEN'),
    graphVersion: opt('IG_GRAPH_VERSION', 'v22.0'),
    // Mapa projetoId (Notion) -> ig-user-id. JSON: {"<projetoId>":"<igUserId>"}
    accounts: parseAccountsMap(optSoft('IG_ACCOUNTS')),
  },
  metaAds: {
    // Reaproveita IG_GRAPH_TOKEN (precisa de ads_read + conta atribuída).
    // Mapa projetoId (Notion) -> campanha(s). JSON: {"<projetoId>":"<campaignId>"}
    // ou {"<projetoId>":["<campaignId1>","<campaignId2>"]} pra ver várias separadas.
    // Tem prioridade sobre accounts — mostra SÓ essas campanhas, sem misturar.
    campaigns: parseCampaignsMap(optSoft('META_ADS_CAMPAIGNS')),
    // Mapa projetoId (Notion) -> conta de anúncios (conta inteira). JSON: {"<projetoId>":"act_<id>"}
    accounts: parseAccountsMap(optSoft('META_ADS_ACCOUNTS')),
  },
  hotmart: {
    // Credenciais da API (Hotmart → Ferramentas → Credenciais da API).
    clientId: optSoft('HOTMART_CLIENT_ID'),
    clientSecret: optSoft('HOTMART_CLIENT_SECRET'),
    basic: optSoft('HOTMART_BASIC'),
    // Mapa projetoId (Notion) -> product_id da Hotmart. JSON: {"<projetoId>":"<productId>"}
    products: parseAccountsMap(optSoft('HOTMART_PRODUCTS')),
    // Produto usado quando o projeto não está no mapa (opcional).
    defaultProductId: optSoft('HOTMART_DEFAULT_PRODUCT_ID'),
  },
  test: {
    projetoNomesAllowlist: opt('PORTAL_TEST_PROJETO_NOMES', '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },
  whatsapp: {
    // Evolution API (VPS próprio) — espelha WhatsApp Web da Lud.
    apiUrl: optSoft('EVOLUTION_API_URL'),         // ex: https://evolution.lud.digital
    apiKey: optSoft('EVOLUTION_API_KEY'),
    instance: opt('EVOLUTION_INSTANCE_NAME', 'lud-principal'),
    // Segredo compartilhado entre Evolution e Portal pra validar webhook
    webhookSecret: optSoft('EVOLUTION_WEBHOOK_SECRET'),
  },
  anthropic: {
    // Claude — gera rascunhos de resposta pro atendimento no WhatsApp.
    apiKey: optSoft('ANTHROPIC_API_KEY'),
    model: opt('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001'),
  },
  supabase: {
    url: optSoft('SUPABASE_URL'),
    serviceRoleKey: optSoft('SUPABASE_SERVICE_ROLE_KEY'),
    // Usadas no client (frontend) pra Realtime
    publicUrl: optSoft('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: optSoft('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    /**
     * Lista de projetoIds (Notion page IDs, separados por vírgula) que devem
     * ler do Supabase em vez do Notion. Funciona como feature flag de
     * migração: começamos com 1 cliente piloto, validamos, daí expandimos.
     * Os mesmos IDs também alimentam o botão de "Sincronizar" em /admin/sync.
     */
    projetosViaSupabase: optSoft('PROJETOS_VIA_SUPABASE')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  },
};
