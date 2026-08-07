# Architecture

> Target state. Source: master plan §E, §F. Not yet built.

## System shape

One Next.js deployable. The architecturally significant boundary is internal:

| Layer | Contains | PackRadar's version |
|---|---|---|
| **Engine** (generic) | Accounts, connectors, templates, layouts, slots, rules, state machine, approval, publishing, asset library | — |
| **Pack** (data + components) | Connector config, layout components, design tokens, caption copy, hashtag sets, asset rules | Ten layouts from `examples/`, the PackRadar connector, the green-on-black token set |

A pack is a directory plus seed rows. Swap it and the same engine runs a sneaker-drop account or a
flight-deal account.

**Testable invariant:** zero PackRadar identifiers in engine code. Enforced in CI in two halves,
which catch different things and do not overlap:

- **Imports** — `eslint.config.mjs` encodes the layer direction as `no-restricted-imports` zones,
  so an engine file importing a pack fails `pnpm lint`.
- **Vocabulary** — `pnpm check:boundary` greps `lib/engine/` **and** `lib/db/` for pack terms. This
  is the only half that can catch a pack concept in a *column name*, which no import rule can see.

Two cheap guards that keep the generalisation honest as the codebase grows.

## Domain model

```
Workspace ─┬─ SocialAccount  (platform, ig_user_id, page_id, token, tz, daily_cap)
           ├─ Connector      (kind, config, payload_schema)
           │    └─ Signal    (entity_key, payload, fetched_at, expires_at)
           ├─ Template       (data_binding, condition, freshness_ttl, cooldown, caption,
           │                  approval_policy: auto | cancel_window | require_approval,
           │                  approval_window_minutes)
           │    └─ Rendition (format: feed_1x1 | feed_4x5 | story_9x16 | carousel,
           │                  layout_id, publish_mode: auto | assisted)
           ├─ Slot           (rrule + tz, target_format)
           │    └─ SlotCandidate (template_id, position — a table, not an array)
           ├─ ContentItem    (the state-machine unit)
           │    └─ PublishAttempt (request, response, ig_media_id, error)
           └─ Asset          (media library, public URL, entity keys, tags)
```

Notes that are easy to get wrong:

- A **Template** is one logical content unit with *explicitly authored* renditions. It offers a
  story only if a story rendition exists — a story is never an auto-scaled crop of the feed post.
- A **Slot** holds an *ordered candidate list*. Evaluate top-down; the first template whose
  condition passes wins; none pass → the slot is logged empty, which is a correct outcome.
  Fallback is list position, not a pointer between templates, so cycles are impossible.
- `publish_mode` is per **Rendition**, not per template — the same template can publish its feed
  post automatically and hand its story off for manual finishing.

## Pipeline

```
triggered → gathering → rendering → review → (REVALIDATE) → publishing → published
                                      │           │              │
                                  cancelled     stale →        failed →
                                  expired      abort / swap    retry + alert
```

## Approval policies

| Policy | Behaviour |
|---|---|
| `auto` | Skip review entirely; revalidate, then publish |
| `cancel_window` | Render → notify → wait N minutes → publish unless cancelled |
| `require_approval` | Never publishes without an explicit yes; expires after N minutes |

**Non-negotiable:** the revalidate gate sits after approval and before publish in **every** mode,
including `auto`. It is the mechanism that makes a delayed post safe. Before publishing, the engine
re-reads the signal, diffs it against what was rendered, and aborts or swaps to a variant if the
fact moved. Freshness TTL is per template — restock 5 minutes, weekly report 7 days.

## Connectors

Two kinds cover everything described:

- `webhook_push` — an external app POSTs `{template_key, payload}`; the engine validates against the
  template's JSON Schema, then triggers.
- `http_pull` — the engine polls a URL on a schedule, normalises the response, and stores signals.

The engine needs no knowledge of any pack's API — only that pack's connector does.

## Cross-cutting concerns

- **Suppression** — cooldown per `(template, entity_key)`, a global minimum gap between posts, a
  daily cap per account, and no re-alert of the same entity within N hours.
- **Captions** — derived deterministically from the same payload as the image. An LLM may write
  only the hook line, validated against that payload before the item may enter the queue. This
  prevents a caption claiming 899 over a card rendering 925.
- **Media** — every rendered asset lands in a public blob store, because Meta fetches the URL
  itself. Product photos come from a curated asset library, never scraped at publish time; when no
  photo exists, a mandatory typographic fallback layout is used. Never a broken image.
- **Tenancy** — `workspace_id` on every row from day one; one account configured in v1, model
  supports N.

## Deployment topology

Vercel: Next.js app (dashboard + API routes), Vercel Functions for rendering and publishing,
Vercel Cron for slot ticks and sweepers, Vercel Blob for public media, Neon Postgres for state.
