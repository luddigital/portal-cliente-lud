-- Fila de publicação no Instagram (agendamento).
-- O Instagram não agenda nativamente; guardamos aqui o horário e um cron
-- (/api/cron/publicar-ig) publica quando `ig_agendado_para` <= agora.
ALTER TABLE programacao_config
  ADD COLUMN IF NOT EXISTS ig_status text,               -- null | 'na_fila' | 'publicando' | 'publicado' | 'erro'
  ADD COLUMN IF NOT EXISTS ig_conta text,                -- ig-user-id da conta destino (do projeto)
  ADD COLUMN IF NOT EXISTS ig_agendado_para timestamptz, -- data+horário combinados (instante UTC)
  ADD COLUMN IF NOT EXISTS ig_media_id text,             -- id do post publicado no IG
  ADD COLUMN IF NOT EXISTS ig_permalink text,
  ADD COLUMN IF NOT EXISTS ig_erro text,
  ADD COLUMN IF NOT EXISTS ig_publicado_em timestamptz;

-- O cron busca por (status, hora) — índice ajuda quando a tabela crescer.
CREATE INDEX IF NOT EXISTS idx_programacao_ig_fila
  ON programacao_config (ig_status, ig_agendado_para);
