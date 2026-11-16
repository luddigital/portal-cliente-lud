/**
 * Hierarquia do portal (visão Lud.), num lugar só pra todo link apontar pro
 * mesmo lugar:
 *
 *   Projetos › projeto › entrega do projeto › tarefa
 *   Entregas › entrega (todos os clientes)
 *   Tarefas  › tarefa
 *   post: prévia (popup) → /post/[id]
 *
 * Regra: o que o clique REPRESENTA decide o destino. Card/linha que junta
 * tarefas de um tipo ("Aprovação | Post · 4 posts") = entrega. Uma tarefa só
 * ("Arte" de um post, quadradinho de concluir) = tarefa. Título do post =
 * prévia do post. Nome/@ do projeto = projeto.
 */
/** "@turismoemchicago" quando o nome do projeto tem o @; senão o nome todo. */
export function nomeCurtoDoProjeto(nome: string | null | undefined): string {
  if (!nome) return 'Projeto';
  return nome.match(/@[\w.]+/)?.[0] ?? nome;
}

/** Rotas da hierarquia, num lugar só (pra todo link apontar pro mesmo lugar). */
export const rotas = {
  projetos: () => '/admin/projetos',
  projeto: (id: string) => `/admin/projetos/${id}`,
  entregasDoProjeto: (id: string) => `/admin/projetos/${id}#entregas`,
  entregaDoProjeto: (projetoId: string, entregaId: string) => `/admin/projetos/${projetoId}/entregas/${entregaId}`,
  entregas: () => '/admin/entregas',
  entrega: (id: string) => `/admin/entregas/${id}`,
  tarefas: () => '/admin/tarefas',
  tarefa: (id: string) => `/admin/tarefas/${id}`,
  post: (id: string) => `/post/${id}`,
  /** Criar post · passo 1 (pauta). `data` = dia do post (YYYY-MM-DD), opcional. */
  novaPauta: (projetoId: string, data?: string | null) => `/admin/projetos/${projetoId}/nova-pauta${data ? `?data=${data}` : ''}`,
  avisosAprovacao: () => '/admin/aprovacoes/avisos',
  contextoClientes: () => '/admin/contexto-clientes',
  clientes: () => '/admin/clientes',
  cliente: (id: string) => `/admin/clientes/${id}`,
};
