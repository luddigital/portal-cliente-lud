-- Data de postagem escolhida pela equipe pra esse post.
-- Notion tem a data original ("Data Postagem") do calendário aprovado —
-- essa coluna guarda a data escolhida no /programacao/[postId] (que pode
-- ser igual ou diferente). Rascunho não toca no Notion; Confirmar (versão
-- futura) vai sincronizar.
ALTER TABLE programacao_config
  ADD COLUMN IF NOT EXISTS data_postagem date;
