-- Reuniões com clientes (agendamentos + anotações).
-- Permite registrar o que foi feito e alimentar a contagem real do painel.

CREATE TABLE IF NOT EXISTS reuniao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id text NOT NULL,
  cliente_nome text,
  data timestamptz NOT NULL,
  titulo text NOT NULL DEFAULT '',
  pauta text NOT NULL DEFAULT '',
  feita boolean NOT NULL DEFAULT false,
  feita_em timestamptz,
  anotacoes text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text
);
CREATE INDEX IF NOT EXISTS idx_reuniao_projeto_data ON reuniao (projeto_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_reuniao_data ON reuniao (data DESC);
