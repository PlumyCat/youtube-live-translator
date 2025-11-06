#!/bin/bash

##
## Notification Hook : Alertes Sonores/Desktop
##
## Notifie l'utilisateur sur événements importants
##

EVENT="$EVENT_TYPE"

# Fichiers sons (optionnels)
SOUND_SUCCESS="$HOME/.claude/sounds/success.mp3"
SOUND_ERROR="$HOME/.claude/sounds/error.mp3"
SOUND_NEED_HUMAN="$HOME/.claude/sounds/need-human.mp3"

# Fonction notification desktop (multi-plateforme)
notify_desktop() {
  local title="$1"
  local message="$2"

  # macOS
  if command -v osascript &> /dev/null; then
    osascript -e "display notification \"$message\" with title \"$title\""

  # Linux
  elif command -v notify-send &> /dev/null; then
    notify-send "$title" "$message"

  # Windows (WSL)
  elif command -v powershell.exe &> /dev/null; then
    powershell.exe -Command "
      \$notify = New-Object -ComObject Wscript.Shell
      \$notify.Popup('$message', 0, '$title', 64)
    "
  fi
}

# Fonction son (macOS)
play_sound() {
  local sound_file="$1"

  if [ -f "$sound_file" ]; then
    if command -v afplay &> /dev/null; then
      afplay -v 0.3 "$sound_file" &
    elif command -v mpg123 &> /dev/null; then
      mpg123 -q "$sound_file" &
    fi
  fi
}

# Gérer événements
case "$EVENT" in
  "permission_needed")
    notify_desktop "Claude Code" "Permission requise"
    play_sound "$SOUND_NEED_HUMAN"
    ;;

  "task_completed")
    notify_desktop "Claude Code" "Tâche terminée avec succès"
    play_sound "$SOUND_SUCCESS"
    ;;

  "error_occurred")
    notify_desktop "Claude Code" "Erreur détectée"
    play_sound "$SOUND_ERROR"
    ;;

  "test_failed")
    notify_desktop "Claude Code" "Tests échoués"
    play_sound "$SOUND_ERROR"
    ;;

  "build_complete")
    notify_desktop "Claude Code" "Build terminé"
    play_sound "$SOUND_SUCCESS"
    ;;
esac

exit 0
