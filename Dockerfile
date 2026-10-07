# syntax=docker/dockerfile:1
# Better Health: the API serving the built web app, with the database on a mounted /data.

ARG BUN_VERSION=1.4

# Every dependency, to build the web app.
FROM oven/bun:${BUN_VERSION} AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# --ignore-scripts skips the git hook install, which needs a git checkout.
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
# The web build bakes in the same version the server reports from VERSION.
RUN bun apps/api/src/lib/version.ts > VERSION && bun run build

# Runtime dependencies only.
FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --ignore-scripts --production

FROM oven/bun:${BUN_VERSION}-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/better-health.db
COPY --from=deps /app ./
COPY package.json ./
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/VERSION ./
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod 755 /usr/local/bin/entrypoint
EXPOSE 3000
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["entrypoint"]
CMD ["bun", "apps/api/src/server.ts"]
