-- Pipeline fino de produção de copy (as 6 etapas do método da Lud.).
--
-- O Notion guarda o estado MACRO do post (rascunho -> produção -> aprovação ->
-- publicado). As 6 etapas internas do método de copy (pesquisa, dor, hook,
-- briefing, copy, revisão) NÃO existem no Notion — elas moram aqui, no portal.
--
-- Fluxo híbrido de cada etapa:
--   status = 'na_fila'          -> ainda não rodou
--   status = 'rascunho'         -> rascunho instantâneo gerado pelo app (Anthropic)
--   status = 'producao_pedida'  -> a Luiza pediu a produção FINAL (fila do Claude Code)
--   status = 'pronto'           -> produção final entregue (método completo + regras)
--
-- Uma linha por (post, etapa). O post_id é o id da página do post no Notion.

CREATE TABLE IF NOT EXISTS pipeline_copy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       text NOT NULL,
  projeto_id    text NOT NULL,
  etapa         text NOT NULL,              -- pesquisa | dor | hook | briefing | copy | revisao
  status        text NOT NULL DEFAULT 'na_fila',
  output        text,                        -- conteúdo gerado da etapa
  contexto_extra text,                       -- contexto adicionado pela Luiza (botão +)
  fonte         text,                        -- 'rascunho_app' | 'producao_claude_code'
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text,
  UNIQUE (post_id, etapa)
);

-- O board carrega todas as etapas de um projeto de uma vez.
CREATE INDEX IF NOT EXISTS idx_pipeline_copy_projeto
  ON pipeline_copy (projeto_id);

-- O Claude Code varre a fila de produção final por (status).
CREATE INDEX IF NOT EXISTS idx_pipeline_copy_fila
  ON pipeline_copy (status);
