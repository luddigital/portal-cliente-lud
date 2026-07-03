-- Rascunho da aprovação (comentário geral + marcações por card/timestamp)
-- pra o cliente conseguir sair e voltar sem perder o que escreveu.
-- Cross-device: antes ficava só no localStorage do device de origem.
--
-- Chave composta (tarefa, email) — cada pessoa mantém seu próprio rascunho
-- mesmo no modo colaborativo (TKRA), onde vários da equipe podem opinar
-- na mesma tarefa.

CREATE TABLE IF NOT EXISTS rascunho_aprovacao (
  tarefa_id text NOT NULL,
  email text NOT NULL,
  comentario_geral text NOT NULL DEFAULT '',
  marcacoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tarefa_id, email)
);

CREATE INDEX IF NOT EXISTS rascunho_aprovacao_tarefa_idx
  ON rascunho_aprovacao (tarefa_id);
