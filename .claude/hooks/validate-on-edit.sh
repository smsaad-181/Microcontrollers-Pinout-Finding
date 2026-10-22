#!/usr/bin/env bash
# After an edit to catalog YAML, run the catalog validator (once it exists) and feed errors back to Claude.
# Exit 2 = blocking feedback shown to Claude; exit 0 = fine / not applicable.
input="$(cat)"
file="$(printf '%s' "$input" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path",""))' 2>/dev/null)"
case "$file" in
  */catalog/*.yaml|*/catalog/*.yml|*/catalog/**/*.yaml) ;;
  *) exit 0 ;;
esac
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f package.json ] || exit 0
[ -f catalog/.drafting ] && exit 0   # Phase 2a drafting: references may not resolve yet
grep -q '"catalog:validate"' package.json || exit 0
out="$(pnpm -s catalog:validate 2>&1)"; rc=$?
if [ $rc -ne 0 ]; then
  echo "catalog:validate failed after editing $file:" >&2
  printf '%s\n' "$out" | tail -40 >&2
  exit 2
fi
exit 0
