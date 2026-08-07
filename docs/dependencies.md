# Dependencies

> Source: master plan §B, §G. The P0 scaffold installed the runtime and tooling rows marked
> *installed*; everything else is still target state.

## First-party packages

Single deployable; the split is by directory, not by package.

| Name | Path | Role |
|---|---|---|
| engine | `lib/engine/` | Generic content engine — no pack concepts permitted |
| packradar pack | `packs/packradar/` | Layouts, tokens, caption copy, connector config, seed rows |
| dashboard | `app/(dashboard)/` | Operator UI — system of record |

## Third-party dependencies

| Dependency | Why it is here |
|---|---|
| `next` | *Installed (16.3.0).* App Router: dashboard, API routes, cron endpoints in one deployable |
| `react` / `react-dom` | *Installed (19.2.8).* UI |
| `@vercel/og` / `satori` | Rendering without a browser; ~100 ms in a Function |
| `@vercel/blob` | Public media store — mandatory, Meta fetches the URL |
| `drizzle-orm` + `@neondatabase/serverless` | *Installed.* Neon access over HTTP and typed queries; `schema.ts` is the single source for both the migration and the generated types |
| `drizzle-kit` | *Installed (dev).* Generates the forward migration from the schema. Down migrations are hand-written beside it — drizzle emits forward only |
| `@electric-sql/pglite` | *Installed (dev).* Real Postgres in-process, so migration and constraint tests need no credentials and no network |
| `rrule` | Slot schedules with timezone handling |
| JSON Schema validator | Validates `webhook_push` payloads against the template's schema |
| Telegram Bot API client (or plain `fetch`) | Approval surface |

## Development dependencies

| Dependency | Why it is here |
|---|---|
| `typescript` | Pinned to 6.x — `typescript-eslint` peers on `<6.1.0`, and the lint layer encodes the engine/pack boundary |
| `eslint`, `eslint-config-next`, `typescript-eslint` | Pinned to ESLint 9.x — the Next config's plugin chain does not yet peer on 10 |
| `vitest` | Unit and integration runner — see [testing.md](testing.md) |
| `@types/node`, `@types/react`, `@types/react-dom` | Type definitions |

No formatter is installed. `pnpm lint --fix` is the only formatting gate; adding a second one
would give two tools an opinion on the same file.

## Critical runtime dependencies

| External | Failure consequence |
|---|---|
| **Instagram Graph API** | No publishing. Requires an IG professional account linked to a Facebook Page, Page Publishing Authorization, and `instagram_basic` + `instagram_content_publish` |
| **Meta App Review** | Blocks live publishing entirely until granted — the schedule long pole, started in P0 |
| **Neon Postgres** | All state: templates, slots, items, tokens |
| **Vercel Blob (public)** | Meta cURLs the media; a private store breaks publishing outright |
| **Telegram Bot API** | Approvals stop reaching the operator; items expire unheard |
| **The pack's data source** | PackRadar's API — gates P5 only; the engine has no knowledge of it |

## Licences

Reviewed at P0 against the first manifest. Every direct dependency is MIT, except `typescript`
which is Apache-2.0. Nothing copyleft, nothing source-available. Re-review when a dependency is
added — the check is `pnpm licenses list`.
