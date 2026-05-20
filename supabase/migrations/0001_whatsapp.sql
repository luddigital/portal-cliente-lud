-- Lud. Digital — Portal do Cliente — Migração inicial WhatsApp
-- Rodar uma vez no SQL Editor do Supabase.
--
-- Objetivo: espelhar grupos selecionados do WhatsApp dentro do Portal
-- (a Lud. continua falando pelo número dela, mas clientes podem responder
-- pelo Portal — fica registrado no banco quem do lado do cliente respondeu).

------------------------------------------------------------------
-- TABELAS
------------------------------------------------------------------

-- Grupos espelhados (sincronizados a partir da Evolution API)
create table if not exists whatsapp_grupos (
  id           text primary key,                  -- ex: "1203630@g.us"
  nome         text not null,
  foto_url     text,
  ativo        boolean not null default true,     -- liga/desliga visibilidade no Portal
  projeto_id   text,                              -- relaciona com Notion projetosDb (opcional)
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_whatsapp_grupos_ativo on whatsapp_grupos(ativo);
create index if not exists idx_whatsapp_grupos_projeto on whatsapp_grupos(projeto_id);

-- Permissões: quem (por email) pode ver/responder qual grupo
create table if not exists whatsapp_permissoes (
  id              uuid primary key default gen_random_uuid(),
  usuario_email   text not null,
  grupo_id        text not null references whatsapp_grupos(id) on delete cascade,
  pode_ler        boolean not null default true,
  pode_responder  boolean not null default false,
  criado_em       timestamptz not null default now(),
  unique(usuario_email, grupo_id)
);

create index if not exists idx_whatsapp_permissoes_email on whatsapp_permissoes(usuario_email);

-- Mensagens (entrada e saída)
create table if not exists whatsapp_mensagens (
  id                  text primary key,           -- ID nativo da mensagem no WhatsApp
  grupo_id            text not null references whatsapp_grupos(id) on delete cascade,
  remetente_numero    text,                       -- número de quem mandou no WhatsApp
  remetente_nome      text,                       -- nome/contato salvo
  conteudo            text,
  tipo                text not null default 'texto', -- texto, imagem, audio, video, doc, sticker
  midia_url           text,                       -- URL no Supabase Storage / Drive
  midia_mimetype      text,
  enviado_via_portal  boolean not null default false,
  enviado_por_usuario text,                       -- email de quem apertou enviar no Portal (auditoria)
  citada_id           text,                       -- ID da mensagem citada (reply)
  timestamp           timestamptz not null,
  criado_em           timestamptz not null default now()
);

create index if not exists idx_whatsapp_mensagens_grupo_ts
  on whatsapp_mensagens(grupo_id, timestamp desc);

------------------------------------------------------------------
-- REALTIME
-- Habilita publicação Realtime para o frontend escutar mensagens novas.
------------------------------------------------------------------
alter publication supabase_realtime add table whatsapp_mensagens;
alter publication supabase_realtime add table whatsapp_grupos;

------------------------------------------------------------------
-- RLS (Row Level Security)
-- Por enquanto: tudo acessado via service_role (backend Next.js).
-- O frontend só consome via API do Portal, que valida sessão JWT.
-- Realtime via anon key é restrito a SELECT em grupos/mensagens com filtro no client.
------------------------------------------------------------------

alter table whatsapp_grupos       enable row level security;
alter table whatsapp_permissoes   enable row level security;
alter table whatsapp_mensagens    enable row level security;

-- Sem policies = nada acessível via anon key direto.
-- Service role bypassa RLS automaticamente (uso server-side).
-- Realtime no client: precisamos de policy mínima de SELECT.

-- Policy permissiva pra Realtime conseguir entregar payload — a filtragem
-- real (quem vê o quê) é feita no servidor antes de subscrever o canal.
create policy "realtime_read_grupos" on whatsapp_grupos
  for select using (true);

create policy "realtime_read_mensagens" on whatsapp_mensagens
  for select using (true);

-- IMPORTANTE: não exponha NEXT_PUBLIC_SUPABASE_ANON_KEY com privilégio de
-- escrita. Toda escrita passa pela API do Next.js usando service_role key.
