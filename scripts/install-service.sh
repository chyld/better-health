#!/usr/bin/env bash
# One-time setup on the homelab: installs the systemd user service and exposes it on the tailnet.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$repo" != "$HOME/better-health" ]]; then
  echo "The service expects the repo at ~/better-health (found $repo)." >&2
  echo "Clone it there, or edit WorkingDirectory in deploy/better-health.service." >&2
  exit 1
fi

bun_path="$(command -v bun)" || { echo "bun is not on PATH" >&2; exit 1; }

mkdir -p "$HOME/.config/systemd/user"
# Point ExecStart at this machine's bun, wherever it is installed.
sed "s|^ExecStart=.* apps/|ExecStart=${bun_path} apps/|" "$repo/deploy/better-health.service" \
  > "$HOME/.config/systemd/user/better-health.service"
systemctl --user daemon-reload
systemctl --user enable better-health
# Keep user services running after logout and across reboots.
sudo loginctl enable-linger "$USER"

# HTTPS at https://<machine>.<tailnet>.ts.net, proxied to the app on localhost only.
sudo tailscale serve --bg 3000

echo "Installed. Next: create a user (bun run user:create <name>), then run scripts/deploy.sh."
