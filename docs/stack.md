# Stack

> Source: master plan §G. Recommended and accepted; no objection raised. The P0 scaffold exists;
> everything below the framework row is still target state.

## Languages and versions

| Concern | Choice | Source of truth |
|---|---|---|
| Language | TypeScript 6, strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | `tsconfig.json` |
| Runtime | Node.js 22 on Vercel Functions | `package.json` engines |
| Package manager | pnpm 10 | `package.json` `packageManager` |
| Test runner | Vitest | `vitest.config.ts` — see [testing.md](testing.md) |
| Lint | ESLint 9 flat config; layer boundaries encoded as `no-restricted-imports` zones | `eslint.config.mjs` |

TypeScript is pinned to 6.x rather than 7.x: `typescript-eslint` declares a `<6.1.0` peer bound, so
7 would cost the lint layer that encodes the engine/pack boundary.

## Frameworks and libraries

| Layer | Choice | Reason |
|---|---|---|
| App | Next.js App Router | Dashboard, API triggers and cron in one deployable |
| Rendering | Satori / `@vercel/og` | No browser; ~100 ms; runs in a Function. All ten v1 layouts fit its flexbox subset |
| UI | React Server Components + client islands where interaction demands | Dashboard is read-mostly; the queue needs live countdowns |

## Datastores

| Concern | Choice | Reason |
|---|---|---|
| Database | Postgres (Neon, via Vercel Marketplace) | Relational model with JSONB payloads |
| Schema and queries | Drizzle ORM, `lib/db/schema.ts` | One source for the migration and the TypeScript types, so they cannot drift |
| Migration tests | PGlite | Real Postgres in-process — the migration is proven without credentials or a network |
| Media hosting | **Vercel Blob — public store** | Mandatory: Meta cURLs the media, so the URL must be publicly reachable. No local files, no signed-private URLs |

## Infrastructure and tooling

| Concern | Choice | Notes |
|---|---|---|
| Hosting | Vercel | |
| Scheduling | Vercel Cron | Slot ticks, token refresh, cancel-window sweeper |
| Notifications | Telegram Bot API | Instant, mobile, inline buttons, no app to build |
| Screenshots | Headless Chromium | Only if the meme template (`05-meme`) is later revived — backlog |

## Deliberately rejected

**Vercel Workflow for the cancel window.** It fits the shape — sleep N minutes, then continue — but
the dashboard must query and mutate that same state anyway (list pending, cancel, edit). Durable
workflow state would duplicate the database and fight every Cancel click. A database row plus a
cron sweeper is the simpler correct answer.

## Observability

Not yet specified beyond P6 scope: audit log with data snapshot, failure alerts, token-expiry
warnings. Platform logging is Vercel's default. No metrics or tracing vendor selected — **Unknown**.
