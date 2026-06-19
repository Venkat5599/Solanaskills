#!/usr/bin/env bash
# solana-confidential-skill — interactive installer.
# Choose install location (personal / project / custom) and whether to run tests.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="solana-confidential-skill"

echo "Install $SKILL_NAME where?"
echo "  1) personal  (~/.claude/skills)"
echo "  2) project   (./.claude/skills)"
echo "  3) custom path"
read -r -p "Choice [1]: " choice
choice="${choice:-1}"

case "$choice" in
  1) TARGET_ROOT="$HOME/.claude/skills" ;;
  2) TARGET_ROOT="$(pwd)/.claude/skills" ;;
  3) read -r -p "Custom path: " TARGET_ROOT ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

TARGET="$TARGET_ROOT/$SKILL_NAME"
echo "==> Installing to: $TARGET"
mkdir -p "$TARGET"

for item in skill agents commands rules lib README.md LICENSE; do
  if [ -e "$SRC_DIR/$item" ]; then
    rm -rf "$TARGET/$item"
    cp -R "$SRC_DIR/$item" "$TARGET/$item"
  fi
done

read -r -p "Install lib deps + run tests now with bun? [y/N]: " runtests
if [[ "${runtests:-N}" =~ ^[Yy]$ ]]; then
  if command -v bun >/dev/null 2>&1; then
    (cd "$TARGET/lib" && bun install && bun test)
  else
    echo "!! bun not found — skipping. See https://bun.sh"
  fi
fi

echo "==> Done. Entry point: $TARGET/skill/SKILL.md"
