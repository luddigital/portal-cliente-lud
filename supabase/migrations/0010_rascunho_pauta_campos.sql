-- Estende rascunho_pauta pra guardar também os textos de "Informações que
-- precisamos" e "Materiais que precisamos". Mesmo padrão da ideia_texto —
-- autosave da equipe, cliente só vê depois de publicado em lote.
--
-- Colunas com DEFAULT '' pra registros existentes não quebrarem.

ALTER TABLE rascunho_pauta
  ADD COLUMN IF NOT EXISTS informacoes_texto text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS materiais_texto text NOT NULL DEFAULT '';
