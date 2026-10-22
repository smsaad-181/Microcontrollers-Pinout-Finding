#!/usr/bin/env bash
# Prints a short build status so every session starts with context. Output is added to Claude's context.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
echo "== Pinout Finder build status (docs/STATE.md) =="
if [ -f docs/STATE.md ]; then
  awk '/^## Phases/{f=1;next} /^## /{if(f)exit} f' docs/STATE.md | grep '^|' | head -12
  echo
  awk '/^## Decisions needed/{f=1;next} /^## /{if(f)exit} f' docs/STATE.md | sed '/^$/d' | head -8 | sed 's/^/Decisions: /'
fi
echo "Reminder: read CLAUDE.md; run /go to continue, /status for details."
exit 0
