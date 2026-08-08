# Development Standards

**Mandatory.** Every coding sub-epic lists this file as a preread. Where this document and a
sub-epic disagree, this document wins unless the sub-epic names the exception explicitly.

- Primary language: TypeScript (strict)
- Framework: Next.js App Router on Vercel
- Architecture pattern: layered, with a hard engine/pack boundary
- Key technologies: Postgres (Neon), Vercel Blob (public), Satori, Vercel Cron, Telegram Bot API
- Project type: single deployable web application with scheduled jobs

## Contents

1. [Architecture overview](#1-architecture-overview)
2. [Project principles](#2-project-principles)
3. [Layer responsibilities](#3-layer-responsibilities)
4. [Data contracts](#4-data-contracts)
5. [Error handling](#5-error-handling)
6. [Logging standards](#6-logging-standards)
7. [Configuration management](#7-configuration-management)
8. [Testing standards](#8-testing-standards)
9. [Security and compliance](#9-security-and-compliance)
10. [Directory layout](#10-directory-layout)
11. [Design principles](#11-design-principles)
12. [Failure handling and resilience](#12-failure-handling-and-resilience)

---

## 1. Architecture overview

Layered application inside one Next.js deployable. The significant boundary is horizontal
(engine vs. pack), not vertical (service vs. service).

```
        app/            routes, dashboard screens, API + cron handlers
          │
        lib/engine/     domain, rules, state machine, render, publish   ← generic, reusable
          │
        packs/<pack>/   layouts, tokens, copy, connector config, seeds  ← tenant-specific
          │
        lib/db/         schema and queries
```

Dependencies point **downward and inward only**. `app/` may import from `lib/engine/` and from a
pack. `lib/engine/` may import from `lib/db/`. **A pack may never be imported by the engine**;
packs are resolved at runtime through configuration, never by a static import in engine code.

Runtime shape: HTTP routes for triggers, Telegram and the dashboard; Vercel Cron for slot ticks,
sweepers, polling and token refresh; Vercel Functions for rendering and publishing; Postgres for
all state; a public blob store for media.

## 2. Project principles

- **Generic engine, specific pack.** If a rule mentions cards, shops, restocks or lei, it belongs
  in the pack. This is an architectural constraint, not a preference.
- **Correctness before publishing.** The revalidate gate runs in every approval mode. Nothing
  publishes on facts that were true only at render time.
- **Not publishing is a first-class outcome.** Empty slots, stale cancels and expiries are normal
  operation. They are recorded with a reason and never modelled, styled or logged as errors.
- **Deterministic content.** Captions and rendered claims derive from the same payload. Generative
  text is confined to a hook line that is validated against that payload.
- **Smallest thing that meets the goal.** Prefer a database row and a cron pass over a durable
  workflow; prefer configuration over a code branch; prefer a new pack over a new engine feature.
- **Multi-tenant model, single-tenant UI.** `workspace_id` on every row from day one; no signup,
  billing or tenancy UI in v1.

## 3. Layer responsibilities

### `app/`
- Contains: route handlers, dashboard screens, request/response mapping, auth checks on inbound
  requests, rendering React for the UI.
- Prohibited: business rules, direct SQL, publishing logic, condition evaluation.

### `lib/engine/`
- Contains: entities, the ContentItem state machine, condition and candidate evaluation,
  suppression rules, the revalidate gate, the render pipeline contract, platform adapters.
- Prohibited: any pack identifier; any import from `packs/`; anything Next.js-specific such as
  request objects, `headers()` or route context.

### `packs/<pack>/`
- Contains: layout components, design tokens, caption copy and hashtag sets, asset rules,
  connector configuration, seed rows.
- Prohibited: database access, publishing calls, state transitions. A pack is data and
  presentation; it never drives the pipeline.

### `lib/db/`
- Contains: schema, migrations, typed queries.
- Prohibited: business rules. A query returns rows; it does not decide whether to publish.

### Composition roots — where two layers that cannot see each other get wired together

The boundary rules above are mutual: `lib/db/` may not import `packs/`, and `packs/` may not
import `lib/db/`. So any operation needing both — seeding pack rows into the database, handing a
pack's layout to the engine's renderer, loading a pack's connector config — **cannot live in
either layer**. It belongs in a composition root: a thin file in `app/` or `scripts/` whose only
job is to import from both sides and pass one to the other.

- A composition root contains wiring and nothing else. No rules, no queries, no rendering.
- It is the *expected* answer when a sub-epic's file list appears to be missing a file. Reviewers:
  a third file above both layers is the boundary working, not scope creep.
- If you find yourself wanting to relax a layer rule to avoid one, you have found a composition
  root, not an exception.

Precedent: `scripts/db-seed.ts` wires `packs/packradar` seed data into `lib/db/`. The same shape
will recur for the render pipeline (engine contract + pack layouts) and connector loading.

## 4. Data contracts

- **Inbound trigger** — `{ template_key, payload }`. `payload` is validated against the template's
  stored JSON Schema before anything else happens. An invalid payload is rejected at the boundary
  with a 4xx and never creates a ContentItem.
- **Signals** carry `entity_key`, the raw `payload` as JSONB, `fetched_at` and `expires_at`. The
  `entity_key` is the dedupe and cooldown identity — it is the pack's job to make it stable.
- **Renditions** declare `format` (`feed_1x1` | `feed_4x5` | `story_9x16` | `carousel`),
  `layout_id` and `publish_mode` (`auto` | `assisted`). Adding a format is an engine change;
  adding a layout is a pack change.
- **Layout contract** — every layout is a pure function of its payload plus tokens, and must render
  inside Satori's supported CSS subset. A layout that needs a browser is not a layout.
- **Naming** — `snake_case` in the database and in JSON payloads; `camelCase` in TypeScript;
  conversion happens once, in `lib/db/`.
- **Versioning** — payload schemas are versioned per template. A schema change that is not
  backwards compatible requires a new template key, not an edit in place; rendered history must
  stay reproducible.
- **Timestamps** are stored in UTC and rendered in the account's timezone. Never store local time.
- **Money** is stored as an integer minor unit plus a currency code. Never a float.

## 5. Error handling

- Distinguish three kinds and treat them differently:
  1. **Rejections** — invalid payload, unknown template, failed schema validation. Return a 4xx at
     the boundary. Do not retry, do not alert.
  2. **Non-events** — no candidate passed, cooldown suppressed, cap reached, revalidate aborted,
     approval expired. These are *outcomes*, not errors: record them on the item with a
     human-readable reason and stop. Never throw, never alert, never mark red.
  3. **Failures** — the platform, database or blob store did not do what was asked. Retry with
     backoff, then alert.
- Use typed result objects for expected outcomes in the engine; reserve exceptions for genuine
  failures. A function whose "error" case is a normal business outcome must not throw.
- Every error carries a stable machine-readable code plus a message written for the operator.
  The dashboard shows the operator message; logs carry both plus context.
- User-facing copy is plain and specific: state what happened and what will happen next.
  "No restock cleared the 500 lei threshold" — never "No data available".

## 6. Logging standards

- Structured JSON only. Every line carries `workspace_id`, and `content_item_id` where one exists.
- Levels: `DEBUG` local diagnosis only; `INFO` state transitions, publishes, non-events with their
  reason; `WARN` retried failures, approaching caps, token expiry inside 14 days; `ERROR` an
  operation that will not be retried, or a retry budget exhausted.
- A state transition is always logged with the reason that caused it.
- Never log: tokens, API secrets, full Telegram payloads, or complete signal payloads. Log the
  `entity_key` and the fields that drove the decision.
- Logging must not be in a hot rendering path; log the outcome, not each step.

## 7. Configuration management

- Precedence: environment variables → pack configuration → per-row database configuration
  (template, slot, account). Database configuration wins for anything an operator can change at
  runtime — caps, cooldowns, windows and schedules are data, never constants.
- Environment variable names are `SCREAMING_SNAKE_CASE`, prefixed by the system they address
  (`IG_`, `TELEGRAM_`, `BLOB_`).
- Every variable is declared by name in `.env.example` and documented in `docs/setup.md`. Values
  are never committed.
- Secrets never appear in pack configuration; a pack is checked in.
- Required variables are validated once at startup and fail loudly. Optional ones must have a safe
  default that degrades rather than crashes.

## 8. Testing standards

- Shape: mostly unit tests around rules and the state machine; integration tests for connector →
  item → render → publish with the platform adapter stubbed; E2E only where a browser flow is the
  thing under test.
- Coverage is **proportionate**: tests cover the acceptance criteria of the sub-epic that
  introduced the behaviour, plus normal-use paths. No blanket percentage target.
- Tests are colocated as `*.test.ts` beside the unit. Name them for the behaviour and its
  condition, not for the function.
- Structure every test Arrange-Act-Assert with no branching.
- Fixtures use realistic pack data — long store names, four-digit prices, missing photos — because
  those are the cases the layouts break on.
- Mock at the boundary only: the platform API, the blob store, the clock. Never mock the engine's
  own modules.
- Time-dependent logic takes an injected clock. Tests must not sleep, and must cover a non-UTC
  account timezone.
- **Test a CLI the way CI invokes it, not the way its library reads.** Any script wired to a
  `package.json` command — a gate, a migration, a seed — needs at least one test that *spawns it
  as a subprocess* and asserts its exit code and output. Testing only its exported functions
  leaves the thing CI actually runs untested, and an entry point that silently does nothing exits
  0, which is indistinguishable from a pass. This is not hypothetical: it is how the boundary
  guard shipped able to fail open.
- **A gate that can fail open needs a test that proves it fails closed** — written first, run
  against the unfixed code, and seen to fail. Asserting it after the fix proves only that the
  assertion matches the implementation. Both the original defect and its first attempted fix
  survived review by looking correct.
- Entry-point and path logic is canonicalised before comparison — resolve symlinks, do not
  string-match a URL against a filesystem path. CI temp directories and working copies reached
  through links are both real, both common, and both silent when this is wrong.
- **A test criterion should name the condition it depends on, not a proxy for it.** "On Linux" was
  once written here where the real dependency was "a temp root that is not itself a symlink".
  Platform, environment and machine are usually proxies; say the thing, so the criterion can be
  satisfied deliberately instead of by luck.
- **A CI configuration that has only ever been green is itself unverified.** As of P0 no gate in
  this repository has ever legitimately failed, so "a non-zero exit fails the workflow" is believed
  from documentation, not observed — the same fail-open shape as everything else in this list, one
  level up. Do not manufacture a red run to close it. **Do** record the first genuine gate failure
  as the confirmation it is, rather than treating it only as a problem to fix.
- CI gates: `build`, `lint`, `test`, and the engine/pack grep guard must all pass.

## 9. Security and compliance

- The trigger endpoint, the Telegram webhook and every cron route are authenticated —
  `TRIGGER_API_KEY`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` respectively. An unauthenticated
  route that mutates state is a defect.
- Instagram long-lived tokens are stored per `SocialAccount` row, refreshed on a schedule, and
  never written to logs, environment variables or the dashboard.
- Rendered media is deliberately public because Meta fetches it. Nothing private may be rendered
  into an asset.
- Product photos come from the curated asset library. Never scrape an image at publish time — it is
  a copyright exposure and an unstable URL.
- All database access is parameterised. Payloads from connectors are untrusted input: validate
  against the schema, and never interpolate them into a query or into rendered HTML.
- Dependencies are added deliberately and recorded in `docs/dependencies.md`; prefer the platform
  primitive over a package.

## 10. Directory layout

| Path | Contents |
|---|---|
| `app/(dashboard)/` | Operator screens |
| `app/api/trigger/` | Inbound `webhook_push` |
| `app/api/telegram/` | Telegram webhook |
| `app/api/cron/` | Scheduled jobs, one route per job |
| `app/api/render/` | Render endpoint |
| `lib/engine/domain/` | Entities, state machine |
| `lib/engine/rules/` | Conditions, candidates, suppression |
| `lib/engine/publish/` | Platform adapters, revalidate gate, rate limiting |
| `lib/engine/render/` | Layout contract, Satori pipeline, format geometry |
| `lib/db/` | Schema, migrations, queries |
| `packs/<pack>/` | Layouts, tokens, copy, connector config, seeds |
| `docs/` | This documentation set |

Naming: files `kebab-case.ts`; React components `PascalCase.tsx`; types and components
`PascalCase`; functions and variables `camelCase`; database identifiers `snake_case`. A new
capability goes in the layer that owns it — when in doubt it is a pack concern, not an engine one.

## 11. Design principles

- Explicit over clever. This codebase is read by agents; favour long names and flat control flow.
- Functions do one thing at one level of abstraction. A function that both decides and performs is
  two functions.
- Comment *why*, never *what*. The only comments worth writing here explain a platform constraint
  or a deliberate rejection.
- No dead code, no commented-out code, no speculative abstraction for a second pack that does not
  exist yet.
- **Before requesting review, run and pass:**

  | Step | Command |
  |---|---|
  | Build | `pnpm build` |
  | Lint | `pnpm lint --fix` |
  | Test | `pnpm test` |
  | Boundary guard | `pnpm check:boundary` — greps `lib/engine/` and `lib/db/` for pack identifiers |

  A review request with any of these failing is returned unread.
- The boundary guard scans `lib/db/` as well as the engine, because a pack word that arrives as a
  column name is invisible to the `no-restricted-imports` zones in `eslint.config.mjs`. `app/` and
  `packs/` are deliberately unscanned: a route may reference a pack, and a pack is where that
  vocabulary belongs. Terms are declared in one place — `PACK_VOCABULARY` in
  `scripts/check-boundary.ts` — and that list is extended when a new pack introduces new
  vocabulary. A term earns a bare match only if it has no legitimate meaning in engine or
  infrastructure vocabulary; `set` and `store` are narrowed to compound forms for that reason, and
  `pack` is absent because it names the layer.
- Review checklist: does it respect the layer boundary; does it preserve the revalidate gate; are
  non-events treated as outcomes rather than errors; are new configuration values data rather than
  constants; are timestamps UTC; is documentation updated in the same change.

## 12. Failure handling and resilience

- **Retries** — only for genuine failures (5xx, timeout, transient network). Exponential backoff,
  a bounded attempt count, and every attempt recorded as a `PublishAttempt` row. Never retry a
  rejection or a non-event.
- **Idempotency** — a publish must not double-post if a retry races a slow success. Reconcile
  against the recorded `ig_media_id` before attempting again.
- **Timeouts** — every outbound call has an explicit timeout. A hung publish must not hold a
  Function open until the platform limit kills it silently.
- **Rate limiting** — the account's daily cap and the platform's 100-per-rolling-24 h ceiling are
  checked before rendering, not after. A carousel counts as one.
- **Graceful degradation** — if a product photo is missing, render the typographic fallback layout;
  never a broken image. If Telegram is unreachable, the item stays in the queue and the dashboard
  remains the system of record. If a connector is down, the slot logs empty with that reason.
- **Health** — the dashboard's overview is the health surface: last signal received, last successful
  publish, token expiry, connector responsiveness. Anything that can silently kill the product —
  above all token expiry — must appear there before it becomes urgent.
