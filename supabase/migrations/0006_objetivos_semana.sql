-- Objetivos da semana por projeto. Bloco de texto editável pela equipe
-- Lud. na página /gestao — reproduz a seção "OBJETIVOS DA SEMANA" da
-- página do Notion, sem depender do Notion.
--
-- 1 linha por projeto. Auto-save via /api/gestao/objetivos.

CREATE TABLE IF NOT EXISTS objetivos_semana (
  projeto_id text PRIMARY KEY,
  texto text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text
);
