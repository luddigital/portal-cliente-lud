-- Nota interna da página da entrega de um projeto ("só a equipe vê").
-- Uma nota por entrega + projeto; ids do Notion sem traço.
create table if not exists public.entrega_notas (
  entrega_id text not null,
  projeto_id text not null,
  texto text not null default '',
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  primary key (entrega_id, projeto_id)
);

-- Sem policies: acesso só pelo service_role no servidor.
alter table public.entrega_notas enable row level security;
