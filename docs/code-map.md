# Code map

> The P0 scaffold created the directory skeleton below. The directories exist; most hold only a
> `.gitkeep` until the sub-epic that owns them lands.

## Repository today

| Path | Purpose |
|---|---|
| `app/` | Root layout plus the dashboard route group; `app/api/*` are empty placeholders |
| `lib/engine/`, `lib/db/`, `packs/packradar/` | Skeleton only — see the planned map below |
| `examples/` | Twelve reference post JPGs — the design source of truth for layouts and tokens |
| `docs/` | This documentation set |
| `design-brief.md` | Operator dashboard brief (five screens, hard problems, aesthetic direction) |
| `PostForge-Draft-Master-Plan.pdf` | The approved master plan — phases, domain model, decisions |
| `.github/workflows/ci.yml` | Build, lint and test gates on every push |
| `.claude/`, `.devchain/` | Agent tooling configuration |

## Planned directory map

| Path | Purpose |
|---|---|
| `app/(dashboard)/` | Operator screens: overview, queue, item detail, schedule, templates |
| `app/api/trigger/` | `webhook_push` entry point; validates payload against template JSON Schema |
| `app/api/telegram/` | Telegram webhook: inline Approve / Cancel / Edit / Snooze |
| `app/api/cron/` | Slot tick, cancel-window sweeper, token refresh, connector polling |
| `app/api/render/` | Satori render endpoint; writes PNG to the public blob store |
| `lib/engine/domain/` | Entities and the ContentItem state machine |
| `lib/engine/rules/` | Condition evaluation, candidate selection, cooldown, dedupe, caps |
| `lib/engine/publish/` | Instagram adapter, revalidate gate, rate limiting, retry |
| `lib/engine/render/` | Layout contract, Satori pipeline, format geometry |
| `lib/db/schema.ts` | The domain model: tables, enums, indexes, generated types |
| `lib/db/migrations/` | Forward SQL from `drizzle-kit`; `migrations/down/` holds the hand-written reverse |
| `lib/db/index.ts` | The lazily-created database client, and the re-export of schema and types |
| `packs/packradar/layouts/` | The ten v1 layout components |
| `packs/packradar/tokens.ts` | `#0A0F14`, `#2EE66B`, `#C8F5DC`, `#7C8C84` and type scale |
| `packs/packradar/seed/` | Templates, slots, connector config as seed rows |

## Application entry points

| Kind | Entry |
|---|---|
| HTTP (web) | `app/(dashboard)/` route handlers |
| HTTP (API) | `app/api/trigger/`, `app/api/telegram/` |
| Scheduled | `app/api/cron/*` invoked by `vercel.json` cron entries |

## Important configuration files

| File | Controls |
|---|---|
| `vercel.json` | Cron schedules |
| `.env.example` | Variable *names* only — never values; see [setup.md](setup.md) |
| `packs/<pack>/pack.config.ts` | Which layouts, tokens and connector a workspace loads |
| `tsconfig.json` | Strict TypeScript; the `@/engine`, `@/db`, `@/packs`, `@/app` path aliases |
| `eslint.config.mjs` | Layer boundaries as `no-restricted-imports` zones — the import half of the engine/pack rule |
| `vitest.config.ts` | Test runner; mirrors the tsconfig aliases |

## Generated code and build outputs

- `.next/` — build output, never committed.
- Rendered PNGs — written to Vercel Blob (public), not to the repository.

## Ignored paths and rationale

`examples/*.jpg` are read as design reference only — never scanned as text. `.next/`, `node_modules/`
and `.vercel/` are build output, dependencies and platform state respectively.
