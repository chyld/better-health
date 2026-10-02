#!/usr/bin/env bash
# Deploys main on the homelab: pull, install, full test suite, build, back up, migrate,
# restart, health check. Stops at the first failure, before touching the running app.
set -euo pipefail

cd "$(dirname "$0")/.."
# Only the backup and migrate steps see the production database path; tests never do.
db_path="${DATABASE_PATH:-$PWD/data/better-health.db}"
unset DATABASE_PATH
port="${PORT:-3000}"

step() { printf '\n==> %s\n' "$1"; }

step "Pulling latest main"
git pull --ff-only

step "Installing dependencies"
bun install --frozen-lockfile

step "Running the full test suite"
bun run test

step "Building the web app"
bun run build

step "Backing up the database"
NODE_ENV=production DATABASE_PATH="$db_path" bun apps/api/src/ops/main.ts backup

step "Applying migrations"
NODE_ENV=production DATABASE_PATH="$db_path" bun apps/api/src/ops/main.ts migrate

step "Restarting the service"
systemctl --user restart better-health

step "Checking health"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
    echo "Deployed $(git rev-parse --short HEAD). Healthy."
    exit 0
  fi
  sleep 1
done

echo "DEPLOY FAILED: health check did not pass within 30s." >&2
echo "Logs: journalctl --user -u better-health -n 50" >&2
exit 1
