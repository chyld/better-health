# Better Health

Self-hosted calorie calendar. Each user logs calories in, calories out, weight (lbs), exercises (e.g. Walking: 3 miles, from their own labels of name, category and unit such as Walking · cardio · miles) and a note for each day, viewed on a monthly calendar that works on phone, tablet and desktop. A History page lists every logged value of one metric (calories in, calories out, net or weight), newest first, and a Notes page lists every note.

## Stack

- **Backend:** Bun, TypeScript, Hono, Zod, Drizzle ORM, SQLite
- **Frontend:** React, Vite, TanStack Query and Router, Tailwind CSS, shadcn/ui, PWA
- **Tests:** `bun test`, Vitest + Testing Library + MSW, Playwright + axe

## Layout

```
apps/api         Hono API, Drizzle schema + migrations, user CLI, deploy ops
apps/web         React app (built into apps/web/dist and served by the API)
packages/shared  Zod schemas, date and calendar helpers, response types
tests/e2e        Playwright specs
deploy/          systemd unit
scripts/         install and deploy scripts
```

## Development

```sh
bun install                         # also installs git hooks (lefthook)
bunx playwright install chromium    # once, for end-to-end tests
bun run user:create <username>      # prompts for a password
bun run dev:api                     # API on http://127.0.0.1:3000
bun run dev:web                     # web app on http://localhost:5173, proxies /api
```

## Tests

| Script | Runs |
| --- | --- |
| `bun run test` | Everything below |
| `bun run test:unit` | Pure logic in `shared` and `api/src` |
| `bun run test:api` | API integration against in-memory SQLite, incl. cross-user isolation |
| `bun run test:cli` | User CLI, subprocess runs, database backups |
| `bun run test:web` | React components with a fake API (MSW) |
| `bun run test:e2e` | Playwright on phone, tablet and desktop viewports, visual snapshots, axe |
| `bun run test:e2e:update` | Re-record visual snapshots after an intended UI change |

Git hooks: `pre-commit` runs lint, typecheck and unit tests; `pre-push` runs the full suite.

## Users

Users are managed only from the CLI on the server; there is no signup or password change on the web.

```sh
bun run user:create <username>          # prompts for a password (or --password-stdin)
bun run user:reset-password <username>  # also signs the user out everywhere
bun run user:list
bun run user:delete <username>          # asks for confirmation (or --yes)
bun run user:admin <username>           # can download the database (--revoke to undo)
```

Admins get an **Admin** page in the header with a button that downloads a consistent copy of the whole database (all users' data and password hashes). Nobody is an admin until granted here.

## Running with Docker

```sh
docker compose up -d --build    # http://<this machine>:3000
docker compose run --rm app bun run user:create <username>
docker compose run --rm app bun run user:admin <username>   # optional
```

The database lives in `./data` on the host, mounted at `/data` in the container. To keep it elsewhere, set `DATA_DIR`, either in the shell or in a `.env` file next to `compose.yaml`:

```sh
DATA_DIR=/srv/better-health   # host directory for the database and backups
HTTP_PORT=3000                # host port
PUID=1000                     # files in DATA_DIR are owned by this user and group
PGID=1000
COOKIE_SECURE=false           # set to true when the app is only reached over HTTPS
```

The directory is created if it is missing and handed to `PUID:PGID` on every start; the app itself never runs as root. Leave `COOKIE_SECURE=false` when browsing to `http://<machine>:3000`: browsers drop HTTPS-only cookies on plain HTTP, and signing in would silently fail. Set it to `true` when the app sits behind HTTPS, for example `tailscale serve --bg 3000` on the host, which the PWA install needs anyway.

To upgrade, pull and rebuild:

```sh
git pull
docker compose up -d --build
```

Migrations run when the container starts, and when a release brings new ones the database is first backed up to `DATA_DIR/backups/`. The other user commands work the same way (`docker compose run --rm app bun run user:list`, and so on), as does `bun run db:backup`. Logs: `docker compose logs -f`. To restore a backup, `docker compose down`, copy it over `DATA_DIR/better-health.db`, delete the `-wal` and `-shm` files next to it, and `docker compose up -d`.

Unlike `bun run deploy`, building the image does not run the test suite; run `bun run test` first if you want that check.

## Deploying to the homelab

### Prerequisites

- Linux with systemd, and a user with `sudo`
- [Bun](https://bun.sh) (developed on 1.4), `git` and `curl`
- [Tailscale](https://tailscale.com), installed and signed in (`sudo tailscale up`)

### One-time setup

On the homelab, as the user that will run the app:

```sh
git clone https://github.com/chyld/better-health.git ~/better-health   # must be this path
cd ~/better-health
bun install
bunx playwright install --with-deps chromium   # the deploy runs the full suite, browser tests included
bun run user:create <username>
scripts/install-service.sh                     # systemd user service + `tailscale serve` HTTPS
bun run deploy                                 # first deploy: builds and starts the app
bun run user:admin <username>                  # optional: lets this user download the database
```

`--with-deps` installs Chromium's system libraries with `sudo` (Debian/Ubuntu); on other distributions, drop it and install them with the package manager if the browser tests fail to launch.

### Every release

```sh
cd ~/better-health
bun run deploy
```

The deploy pulls `main`, installs, runs the full test suite, builds, backs up the database (`data/backups/`, newest 14 kept), applies migrations, restarts the service and checks `/api/health`. It stops at the first failure, before the running app is touched.

The app listens on `127.0.0.1:3000` only; it is reachable at `https://<machine>.<tailnet>.ts.net` through `tailscale serve`, which also provides the HTTPS the PWA install needs.

### Running it

```sh
systemctl --user status better-health
systemctl --user restart better-health
journalctl --user -u better-health -f    # logs
```

The database is `data/better-health.db`. `bun run db:backup` takes a copy into `data/backups/` at any time, and admins can download one from the Admin page. Both live on the same disk, so keep a copy somewhere else too.

### Restoring a backup

```sh
systemctl --user stop better-health
cp data/backups/better-health-<stamp>.db data/better-health.db
rm -f data/better-health.db-wal data/better-health.db-shm
systemctl --user start better-health
```

A backup from an older release is fine: pending migrations run when the app starts.
