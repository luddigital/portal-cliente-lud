-- Textos editáveis das mensagens padrão (ex.: lembrete de aprovação no WhatsApp).
-- Só guarda o que foi alterado; o resto vem do padrão no código.
create table if not exists public.mensagens_padrao (
  chave text primary key,
  texto text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

-- Sem policies: acesso só pelo service_role no servidor.
alter table public.mensagens_padrao enable row level security;
