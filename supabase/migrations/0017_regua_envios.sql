-- Mensagens enviadas pela Régua da semana (uma linha por cliente/momento).
-- ciclo = quinta-feira do envio daquela semana.
create table if not exists public.regua_envios (
  id bigserial primary key,
  projeto_id text not null,
  ciclo date not null,
  momento text not null,
  variante text,
  texto text not null,
  post_ids jsonb not null default '[]'::jsonb,
  grupo_id text,
  message_id text,
  enviado_em timestamptz not null default now(),
  enviado_por text
);
create index if not exists regua_envios_ciclo_idx on public.regua_envios (ciclo, projeto_id);

-- Sem policies: acesso só pelo service_role no servidor.
alter table public.regua_envios enable row level security;
