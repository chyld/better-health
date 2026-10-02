# Better Health

Self-hosted calorie calendar: log calories in, calories out, weight, exercises and a note for each day, viewed on a monthly calendar.

## Stack

- **Backend:** Bun, TypeScript, Hono, Zod, Drizzle ORM, SQLite
- **Frontend:** React, Vite, TanStack Query/Router, Tailwind, shadcn/ui
- **Tests:** `bun test`, Vitest + Testing Library, Playwright

## Layout

```
apps/api        Hono API, Drizzle schema, CLI
apps/web        React app
packages/shared Shared schemas and helpers
```

## Development

```sh
bun install          # also installs git hooks (lefthook)
bun run test         # full suite
bun run test:unit    # fast unit tests
bun run lint
bun run typecheck
```

Git hooks: `pre-commit` runs lint, typecheck and unit tests; `pre-push` runs the full suite.
