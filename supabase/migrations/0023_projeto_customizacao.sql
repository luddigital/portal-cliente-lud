-- Customizações do projeto (coisas visuais que não vivem no Notion).
-- Por enquanto só a cover do header. Pode crescer com cor custom, etc.

CREATE TABLE IF NOT EXISTS projeto_customizacao (
  projeto_id text PRIMARY KEY,
  cover_url text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text
);
