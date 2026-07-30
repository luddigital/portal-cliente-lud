-- Rascunho da PAUTA que a equipe da Lud. constrói antes de mandar pro
-- cliente aprovar. Cliente NÃO vê essa tabela — só o que já foi publicado
-- (movido pro Notion via /api/pauta/[postId]/publicar).
--
-- Um rascunho por post (colaborativo entre a equipe, sem chave por email).
-- publicado_em / publicado_por marcam a última vez que o rascunho virou
-- versão oficial no Notion — se publicado_em < atualizado_em, tem edição
-- pendente de publicação.

CREATE TABLE IF NOT EXISTS rascunho_pauta (
  post_id text PRIMARY KEY,
  ideia_texto text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text,
  publicado_em timestamptz,
  publicado_por text
);
