-- Quando o CLIENTE abre um post no portal (admin/colaborador não contam).
-- Base pra régua de lembretes: viu e não aprovou × não viu.
create table if not exists public.post_visualizacoes (
  id bigserial primary key,
  post_id text not null,
  tarefa_id text,
  email text not null,
  visto_em timestamptz not null default now()
);
create index if not exists post_visualizacoes_post_idx
  on public.post_visualizacoes (post_id, visto_em desc);

-- Sem policies: acesso só pelo service_role no servidor.
alter table public.post_visualizacoes enable row level security;
