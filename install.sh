#!/usr/bin/env bash
# solana-confidential-skill — standard installer (sensible defaults).
# Copies the skill into ~/.claude/skills/ and installs the TS core deps.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="solana-confidential-skill"
TARGET_ROOT="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
TARGET="$TARGET_ROOT/$SKILL_NAME"

echo "==> Installing $SKILL_NAME"
echo "    from: $SRC_DIR"
echo "    to:   $TARGET"

mkdir -p "$TARGET"
# Copy skill content (skip local node_modules / build noise).
for item in skill agents commands rules lib README.md LICENSE; do
  if [ -e "$SRC_DIR/$item" ]; then
    rm -rf "$TARGET/$item"
    cp -R "$SRC_DIR/$item" "$TARGET/$item"
  fi
done

# Install the TypeScript core dependencies with bun (required).
if command -v bun >/dev/null 2>&1; then
  echo "==> Installing lib deps with bun"
  (cd "$TARGET/lib" && bun install)
  echo "==> Running tests"
  (cd "$TARGET/lib" && bun test) || echo "    (tests reported failures — review above)"
else
  echo "!! bun not found. Install bun (https://bun.sh), then: cd '$TARGET/lib' && bun install && bun test"
fi

echo "==> Done. Entry point: $TARGET/skill/SKILL.md"
