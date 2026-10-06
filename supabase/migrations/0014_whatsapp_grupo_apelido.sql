-- Apelido usado na saudação dos lembretes de WhatsApp ("Oi Re!").
alter table public.whatsapp_grupos add column if not exists apelido text;
