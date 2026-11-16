-- Projeto escondido da área do cliente (ex.: a cliente só vê o Instagram,
-- não o E-book nem o Tráfego). Ids do Notion sem traço.
create table if not exists public.projeto_visibilidade (
  projeto_id text primary key,
  oculto_do_cliente boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

-- Sem policies: acesso só pelo service_role no servidor.
alter table public.projeto_visibilidade enable row level security;
