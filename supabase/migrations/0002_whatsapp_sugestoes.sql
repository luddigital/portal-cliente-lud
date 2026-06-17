-- Lud. Digital — Portal do Cliente — Sugestões de resposta da Claude
-- Rodar uma vez no SQL Editor do Supabase (depois da 0001).
--
-- Objetivo: a Claude gera um RASCUNHO de resposta quando chega mensagem
-- nova num grupo habilitado. O time revisa no chat e Aprova / Edita / Descarta.
-- Nada é enviado ao cliente sem alguém clicar "Aprovar e enviar".

------------------------------------------------------------------
-- Liga/desliga a sugestão automática por grupo (default: desligado).
------------------------------------------------------------------
alter table whatsapp_grupos
  add column if not exists auto_sugestao boolean not null default false;

------------------------------------------------------------------
-- Sugestões geradas pela Claude
------------------------------------------------------------------
create table if not exists whatsapp_sugestoes (
  id                  uuid primary key default gen_random_uuid(),
  grupo_id            text not null references whatsapp_grupos(id) on delete cascade,
  -- mensagem do cliente que disparou a sugestão (1 sugestão por mensagem)
  mensagem_id         text unique,
  texto               text not null,                 -- rascunho proposto pela Claude
  status              text not null default 'pendente'
                        check (status in ('pendente', 'aprovada', 'rejeitada')),
  modelo              text,                           -- ex: claude-haiku-4-5-...
  enviada_mensagem_id text,                           -- id da msg enviada ao aprovar
  aprovada_por        text,                           -- email de quem aprovou (auditoria)
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists idx_whatsapp_sugestoes_grupo_status
  on whatsapp_sugestoes(grupo_id, status, criado_em desc);

------------------------------------------------------------------
-- REALTIME — o chat escuta sugestões novas em tempo real.
------------------------------------------------------------------
alter publication supabase_realtime add table whatsapp_sugestoes;

------------------------------------------------------------------
-- RLS — escrita só via service_role (backend). Select liberado p/ Realtime,
-- a filtragem real (quem vê o quê) é feita na API do Portal.
------------------------------------------------------------------
alter table whatsapp_sugestoes enable row level security;

create policy "realtime_read_sugestoes" on whatsapp_sugestoes
  for select using (true);
