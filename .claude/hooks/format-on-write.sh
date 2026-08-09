#!/usr/bin/env bash
# PostToolUse hook: formats/lints files after Write/Edit/MultiEdit.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR" || exit 0

input="$(cat)"
file_path="$(echo "$input" | jq -r '.tool_input.file_path // empty')"

[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

case "$file_path" in
  "$PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac

ext="${file_path##*.}"

case "$ext" in
  ts|tsx|js|jsx|mjs|cjs|json|css|md|mdx)
    npx --no-install prettier --write "$file_path" >/dev/null 2>&1
    ;;
esac

# Strip blank lines from code files so only actual code is visible.
case "$ext" in
  ts|tsx|js|jsx|mjs|cjs|json|css)
    grep -v '^[[:space:]]*$' "$file_path" > "$file_path.tmp" && mv "$file_path.tmp" "$file_path"
    ;;
esac

case "$ext" in
  ts|tsx|js|jsx|mjs|cjs)
    npx --no-install eslint --fix "$file_path" >/dev/null 2>&1
    ;;
esac

exit 0
