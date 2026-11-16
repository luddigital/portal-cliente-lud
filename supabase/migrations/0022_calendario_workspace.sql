-- Workspace de criação de calendário por projeto+mês.
--
-- Guarda o rascunho atual (texto livre que a Luiza vai colando/editando
-- enquanto conversa com o Claude no claude.ai) + feedbacks (o que mudar na
-- próxima rodada) + um histórico de versões salvas (array JSON).
--
-- É UM por projeto+mês: ao abrir workspace do mesmo mês, carrega o salvo.
-- Pra ver outro mês, basta trocar o seletor no form (cria/carrega outro).

CREATE TABLE IF NOT EXISTS calendario_workspace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id text NOT NULL,
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),

  briefing_livre text NOT NULL DEFAULT '',
  rascunho text NOT NULL DEFAULT '',
  feedbacks text NOT NULL DEFAULT '',
  project_claude_url text,

  -- Histórico de versões: cada entrada é
  -- {"id": uuid, "numero": 1, "rascunho": "...", "feedbacks": "...",
  --  "criado_em": "2026-10-15T20:00:00Z", "criado_por": "oi@lud.digital"}
  versoes jsonb NOT NULL DEFAULT '[]'::jsonb,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text,

  UNIQUE (projeto_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_calendario_workspace_projeto
  ON calendario_workspace (projeto_id, ano DESC, mes DESC);
