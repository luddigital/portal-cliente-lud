-- Config de programação por post (usado na página /programacao/[postId]).
-- Notion não guarda horário nem plataformas de destino — armazenamos aqui.
CREATE TABLE IF NOT EXISTS programacao_config (
  post_id text PRIMARY KEY,
  horario text,                                     -- HH:MM
  plataformas jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ['facebook','instagram']
  formato text,                                     -- 'feed' | 'reels' | 'stories'
  legenda text,                                     -- versão editada (pode diferir da do Notion)
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text
);
