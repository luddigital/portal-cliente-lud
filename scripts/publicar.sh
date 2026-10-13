#!/usr/bin/env bash
# Publica o portal em produção — só o que está SALVO (commit) no ramo main.
# Uso: npm run publicar
set -euo pipefail
cd "$(dirname "$0")/.."

ramo=$(git branch --show-current)
if [ "$ramo" != "main" ]; then
  echo "✋ A publicação só sai do ramo main (agora: '$ramo')."
  echo "   Junte o trabalho no main antes de publicar."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "✋ Tem mudança sem commit na pasta. Só vai pro ar o que foi salvo:"
  git status --short
  echo "   Se for de outra conversa, termine/salve por lá antes de publicar."
  exit 1
fi

echo "→ Conferindo os tipos…"
npx tsc --noEmit

echo "→ Publicando: $(git log --oneline -1)"
npx vercel deploy --prod --yes

# Backup no GitHub (precisa do login do GitHub neste computador).
if git push -q origin main 2>/dev/null; then
  echo "→ main enviado pro GitHub."
else
  echo "⚠️  Não consegui enviar pro GitHub (login). O site foi publicado mesmo assim."
fi
