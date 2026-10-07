-- Projeto pode ter mais de um grupo (ex.: grupo do IG + grupo de revisões).
-- O principal é o padrão dos lembretes; nos popups dá pra escolher outro.
alter table public.whatsapp_grupos add column if not exists principal boolean not null default false;
