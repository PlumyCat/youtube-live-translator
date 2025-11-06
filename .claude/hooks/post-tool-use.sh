#!/bin/bash

##
## Post-tool Hook : Auto-formatting
##
## Lance Prettier sur fichiers modifiés après édition
##

# Vérifier si c'est une édition de fichier
if [[ "$TOOL_NAME" == "Edit" ]] || [[ "$TOOL_NAME" == "Write" ]]; then
  FILE_PATH="$FILE_PATH"

  # Vérifier si fichier est TypeScript/JavaScript
  if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
    echo "🎨 Auto-formatting $FILE_PATH with Prettier..."

    # Lancer Prettier
    npx prettier --write "$FILE_PATH" 2>/dev/null

    if [ $? -eq 0 ]; then
      echo "✅ Formatted successfully"
    else
      echo "⚠️  Prettier failed (non-blocking)"
    fi
  fi
fi

# Success toujours (non-bloquant)
exit 0
