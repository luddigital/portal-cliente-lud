-- Adiciona campo de Referências no rascunho_pauta. Nessa rodada é só texto
-- livre (equipe cola links e notas). Próxima rodada vira lista estruturada
-- com upload de prints.

ALTER TABLE rascunho_pauta
  ADD COLUMN IF NOT EXISTS referencias_texto text NOT NULL DEFAULT '';
