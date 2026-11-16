-- Processo de conteúdo 100% no portal (piloto: Emanuel Transfer Paris a
-- partir de dezembro/2026). Posts, tarefas e comentários desses projetos
-- ficam aqui, não no Notion. Ver docs/PROCESSO-NO-PORTAL.md.
--
-- Ids com prefixo (lud_ / ludt_) pra qualquer tela saber que o dado é do
-- portal sem consultar nada. Cliente/projeto continuam com o id do Notion.

create table if not exists public.conteudo_projetos (
  projeto_id text primary key,         -- page id do projeto no Notion
  nome text,
  desde date not null,                 -- posts com data >= desde vivem no portal
  criado_em timestamptz not null default now()
);

create table if not exists public.conteudo_posts (
  id text primary key default ('lud_' || replace(gen_random_uuid()::text, '-', '')),
  projeto_id text not null,
  titulo text not null default 'Nova pauta',
  data_postagem date,
  horario text,
  formato text,                        -- Carrossel, Reels, Post, Stories
  editoria text,
  funil text,
  objetivo text,
  ideia text not null default '',
  informacoes_necessarias text not null default '',
  materiais_necessarios text not null default '',
  referencias text not null default '',
  briefing text not null default '',
  roteiro text not null default '',
  legenda text not null default '',
  arte_links jsonb not null default '[]'::jsonb,       -- [{name,url}]
  materiais_links jsonb not null default '[]'::jsonb,  -- [{name,url}]
  status text not null default 'Pauta',  -- Pauta, Em Produção, Agendado, Postado, Cancelado
  criado_em timestamptz not null default now(),
  criado_por text,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
create index if not exists conteudo_posts_projeto_data_idx
  on public.conteudo_posts (projeto_id, data_postagem);

create table if not exists public.conteudo_tarefas (
  id text primary key default ('ludt_' || replace(gen_random_uuid()::text, '-', '')),
  post_id text not null references public.conteudo_posts(id) on delete cascade,
  titulo text not null,
  ordem int not null default 99,
  ordem_um text not null default '01',  -- 01 original, 02 alteração, 03 nova aprovação
  status text not null default 'Iniciar',
  responsavel_email text,
  responsavel_nome text,
  prazo timestamptz,
  finalizada_em timestamptz,
  mae_id text,
  criado_em timestamptz not null default now()
);
create index if not exists conteudo_tarefas_post_idx on public.conteudo_tarefas (post_id, ordem, ordem_um);
create index if not exists conteudo_tarefas_aberta_idx on public.conteudo_tarefas (titulo, status, prazo);

create table if not exists public.conteudo_comentarios (
  id bigserial primary key,
  post_id text not null references public.conteudo_posts(id) on delete cascade,
  tarefa_id text,
  autor_email text,
  texto text not null,
  criado_em timestamptz not null default now()
);
create index if not exists conteudo_comentarios_post_idx on public.conteudo_comentarios (post_id, criado_em);

-- Sem policies: acesso só pelo service_role no servidor.
alter table public.conteudo_projetos enable row level security;
alter table public.conteudo_posts enable row level security;
alter table public.conteudo_tarefas enable row level security;
alter table public.conteudo_comentarios enable row level security;

insert into public.conteudo_projetos (projeto_id, nome, desde)
values ('191d04d2-3b4a-80c0-9ed0-cf33333be3d0', 'Emanuel Transfer Paris', '2026-12-01')
on conflict (projeto_id) do nothing;
