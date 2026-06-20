#!/usr/bin/env bash
# One-command VPS deploy for the solana-confidential-skill live demo.
#
#   AICREDITS_API_KEY=sk-live-... bash deploy/setup.sh
#
# Installs Bun if missing, installs deps, writes .env, registers a systemd
# service, and starts it. Idempotent — safe to re-run after a git pull.
set -euo pipefail

# --- config (override via env) ---
PORT="${PORT:-8787}"
MODEL="${MODEL:-deepseek/deepseek-v4-flash}"
MODEL_FALLBACK="${MODEL_FALLBACK:-deepseek/deepseek-chat}"
BASE_URL="${AICREDITS_BASE_URL:-https://api.aicredits.in/v1}"
SERVICE="${SERVICE:-solana-confidential-demo}"

# demo-app dir = parent of this script's dir
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$HERE/.." && pwd)"
cd "$APP_DIR"

echo "==> app dir: $APP_DIR"

if [ -z "${AICREDITS_API_KEY:-}" ] && [ ! -f "$APP_DIR/.env" ]; then
  echo "!! AICREDITS_API_KEY not set and no .env present."
  echo "   Re-run as: AICREDITS_API_KEY=sk-live-... bash deploy/setup.sh"
  exit 1
fi

# --- bun ---
if ! command -v bun >/dev/null 2>&1; then
  echo "==> installing bun"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
BUN_BIN="$(command -v bun)"
echo "==> bun: $BUN_BIN ($($BUN_BIN --version))"

# --- deps ---
echo "==> installing deps"
"$BUN_BIN" install

# --- .env (only write if a key was passed; otherwise keep existing) ---
if [ -n "${AICREDITS_API_KEY:-}" ]; then
  echo "==> writing .env"
  cat > "$APP_DIR/.env" <<EOF
AICREDITS_API_KEY=${AICREDITS_API_KEY}
MODEL=${MODEL}
MODEL_FALLBACK=${MODEL_FALLBACK}
AICREDITS_BASE_URL=${BASE_URL}
PORT=${PORT}
EOF
  chmod 600 "$APP_DIR/.env"
fi

# --- systemd service ---
if command -v systemctl >/dev/null 2>&1; then
  UNIT="/etc/systemd/system/${SERVICE}.service"
  echo "==> installing systemd unit: $UNIT"
  sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=solana-confidential-skill live demo (DeepSeek via AICredits)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=${BUN_BIN} run server.ts
EnvironmentFile=${APP_DIR}/.env
Restart=on-failure
RestartSec=3
User=$(whoami)

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE"
  sudo systemctl restart "$SERVICE"
  sleep 2
  echo "==> service status:"
  systemctl --no-pager --lines=8 status "$SERVICE" || true
  echo ""
  echo "==> health:"
  curl -s "http://127.0.0.1:${PORT}/api/health" || echo "(not up yet — check: journalctl -u ${SERVICE} -n 50)"
  echo ""
else
  echo "!! systemctl not found — start manually:  cd $APP_DIR && bun run server.ts"
fi

echo ""
echo "==> done. Demo on port ${PORT}."
echo "   Open a firewall port or front it with nginx (see deploy/nginx.conf.example)."
