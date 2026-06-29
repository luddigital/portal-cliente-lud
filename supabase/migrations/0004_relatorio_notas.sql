-- Notas editáveis do relatório de Instagram. Cada combinação de
-- (projeto + período) tem uma linha — equipe edita inline pela página
-- de relatório, cliente só lê.
--
-- Saímos do Notion pra essa parte: o cliente já vê a página, e os
-- aprendizados ficavam em placeholders estáticos. Agora persiste no
-- Supabase e sobrevive a reloads / serverless cold starts.

CREATE TABLE IF NOT EXISTS relatorio_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id text NOT NULL,            -- id da página de projeto no Notion
  inicio date NOT NULL,
  fim date NOT NULL,
  funcionou text NOT NULL DEFAULT '',
  nao_funcionou text NOT NULL DEFAULT '',
  plano text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por text,                 -- email de quem salvou por último
  UNIQUE (projeto_id, inicio, fim)
);

CREATE INDEX IF NOT EXISTS relatorio_notas_projeto_idx
  ON relatorio_notas (projeto_id);
