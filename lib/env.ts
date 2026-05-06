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
  test: {
    projetoNomesAllowlist: opt('PORTAL_TEST_PROJETO_NOMES', '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },
};
