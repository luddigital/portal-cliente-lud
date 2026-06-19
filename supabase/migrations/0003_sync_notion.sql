-- Sync Notion → Supabase: tabelas espelho pra postagens e tarefas.
--
-- Estratégia: Notion segue como source of truth (equipe trabalha lá).
-- Supabase é só cache rápido — portal lê daqui pra ser ~10× mais rápido
-- que ir no Notion API. Sync acontece via /api/admin/sync/notion
-- (manual no início, depois cron a cada 5 min).
--
-- IDs primários são os Notion page IDs (UUIDs) — mesma chave pros dois
-- lados, simplifica upsert.

-- ============================================================
-- POSTAGENS
-- ============================================================
create table if not exists postagens_sync (
  id              text primary key,           -- Notion page id
  titulo          text not null,
  projeto_id      text,                       -- Notion projeto id
  data_postagem   date,
  status          text,
  status_geral    text,
  demanda         text,
  formato_nome    text,
  formato_tipo    text,                       -- post | reels | story | desconhecido
  ideia_do_post   text,
  legenda         text,
  body_completo   text,
  icon            text,
  drive_links            jsonb default '[]'::jsonb,
  tarefa_ids             jsonb default '[]'::jsonb,
  materiais_necessarios  jsonb,
  informacoes_necessarias jsonb,
  aprovacao_colaborativa boolean default false,
  notion_last_edited     timestamptz,
  synced_at              timestamptz not null default now()
);

create index if not exists postagens_sync_projeto_idx on postagens_sync (projeto_id);
create index if not exists postagens_sync_data_idx on postagens_sync (data_postagem desc);
create index if not exists postagens_sync_status_idx on postagens_sync (status);

-- ============================================================
-- TAREFAS
-- ============================================================
create table if not exists tarefas_sync (
  id               text primary key,          -- Notion page id
  titulo           text not null,
  status           text,
  post_id          text,
  projeto_id       text,
  pessoa_user_id   text,
  pessoa_nome      text,
  prazo            timestamptz,
  data_inicial     date,
  pronto           boolean default false,
  finalizada_em    timestamptz,
  ordem            text,
  tipo             text,
  notion_last_edited  timestamptz,
  synced_at           timestamptz not null default now()
);

create index if not exists tarefas_sync_post_idx on tarefas_sync (post_id);
create index if not exists tarefas_sync_projeto_idx on tarefas_sync (projeto_id);
create index if not exists tarefas_sync_pessoa_idx on tarefas_sync (pessoa_user_id);
create index if not exists tarefas_sync_status_idx on tarefas_sync (status);
create index if not exists tarefas_sync_finalizada_idx on tarefas_sync (finalizada_em desc);
create index if not exists tarefas_sync_pronto_idx on tarefas_sync (pronto) where pronto = true;

-- ============================================================
-- LOG DE SYNCS
-- Pra debug + monitorar saúde ("última sync OK há quanto tempo?")
-- ============================================================
create table if not exists sync_logs (
  id              bigint generated always as identity primary key,
  iniciado_em     timestamptz not null default now(),
  terminado_em    timestamptz,
  escopo          text,                       -- 'postagens' | 'tarefas' | 'projeto:<id>'
  itens_lidos     integer default 0,
  itens_escritos  integer default 0,
  erro            text,
  ok              boolean
);

create index if not exists sync_logs_iniciado_idx on sync_logs (iniciado_em desc);

-- ============================================================
-- CLIENTES NO SUPABASE (feature flag por cliente)
-- Lista controlada de quais clientes leem do Supabase.
-- Default vazio → ninguém lê de Supabase. Adiciona cliente um por um.
-- ============================================================
create table if not exists clientes_supabase (
  cliente_id     text primary key,            -- Notion cliente id
  cliente_nome   text,                        -- display
  habilitado_em  timestamptz default now()
);
