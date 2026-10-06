-- Lembrete avulso (botão 📱 lembrar) também fica registrado aqui, sem ciclo.
alter table public.regua_envios alter column ciclo drop not null;

-- Histórico de envios por post (página do post, visão Lud.).
create index if not exists regua_envios_post_ids_idx on public.regua_envios using gin (post_ids);
