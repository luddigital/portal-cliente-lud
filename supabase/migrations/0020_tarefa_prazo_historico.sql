-- Toda vez que alguém muda o prazo (Data Entrega) de uma tarefa pelo portal.
-- O Notion não guarda histórico de propriedade pela API, então fica aqui.
create table if not exists public.tarefa_prazo_historico (
  id bigserial primary key,
  tarefa_id text not null,
  post_id text,
  tarefa_titulo text,
  prazo_anterior date,
  prazo_novo date not null,
  alterado_por text not null,
  alterado_por_nome text,
  alterado_em timestamptz not null default now()
);
create index if not exists tarefa_prazo_historico_post_idx
  on public.tarefa_prazo_historico (post_id, alterado_em desc);
create index if not exists tarefa_prazo_historico_tarefa_idx
  on public.tarefa_prazo_historico (tarefa_id, alterado_em desc);

-- Sem policies: acesso só pelo service_role no servidor.
alter table public.tarefa_prazo_historico enable row level security;
