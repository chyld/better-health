#!/bin/sh
# Starts as root only to make the data directory writable by PUID:PGID (default 1000:1000),
# then re-runs itself as that user. Before the server starts, the database is backed up if
# this release brings new migrations.
set -eu

data_dir="$(dirname "$DATABASE_PATH")"

if [ "$(id -u)" = "0" ]; then
  uid="${PUID:-1000}"
  gid="${PGID:-1000}"
  mkdir -p "$data_dir"
  chown -R "$uid:$gid" "$data_dir"
  export HOME=/tmp
  exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$0" "$@"
fi

if [ "$*" = "bun apps/api/src/server.ts" ]; then
  bun apps/api/src/ops/main.ts backup-if-migrating
fi

exec "$@"
