# AI agents guide

> How to work in this repository. Read this and
> [development-standards.md](development-standards.md) before changing code.

## The rule that outranks the others

**No PackRadar concept may appear in `lib/engine/`** — not a table column, not an enum value, not a
field name, not a comment example. Cards, packs, sets, restocks, shops and lei belong to the pack.
The engine knows about workspaces, connectors, signals, templates, renditions, slots, content items
and assets. A CI grep enforces this; if your change trips it, the change is in the wrong layer.

## Where to make changes safely

| Intent | Where |
|---|---|
| New layout, token, caption or hashtag set | `packs/<pack>/` |
| New rule, state, connector kind or publish behaviour | `lib/engine/` |
| New operator screen or action | `app/(dashboard)/` |
| New scheduled job | `app/api/cron/` + a `vercel.json` entry |

If a change seems to require both layers, stop and re-read
[architecture.md](architecture.md) — usually the engine needs a generic capability that the pack
then configures, not a special case.

## Quick loop

```
pnpm dev
pnpm test
pnpm lint --fix
pnpm build
```

All three of test, lint and build must pass before you request review.

## Pitfalls specific to this project

- **Never bypass the revalidate gate.** It runs after approval and before publish in every mode,
  including `auto`. Code that publishes without it is wrong even if tests pass.
- **Media must be public.** Meta cURLs the URL. A signed or private blob URL fails at publish time,
  not at render time — so it will look fine locally.
- **A story is not a cropped feed post.** Only offer a story if a story rendition was authored.
- **An empty slot is not an error.** Log it with the per-candidate reason and move on; do not
  raise, retry, or alert.
- **A stale-cancelled post is a success.** Do not style, log or alert it as a failure.
- **Captions are deterministic.** An LLM may produce the hook line only, and it is validated
  against the payload before the item enters the queue.
- **Carousels** are max 10 slides and every slide is cropped to the first slide's aspect ratio —
  enforce this at render time, not at publish time.

## Guardrails

- No network installs beyond the declared manifest; no new runtime dependency without a note in
  [dependencies.md](dependencies.md).
- Never read or echo `.env` values. `.env.example` carries names only.
- Never commit a token. Instagram tokens live in the database, per account.
- Do not add a metrics/tracing vendor, a workflow engine, or a second rendering stack without
  revisiting [stack.md](stack.md) — each was considered and deliberately scoped out.

## Diff guidance

Keep changes inside one layer where possible. Update `docs/` in the same change when you alter the
domain model, add an environment variable, or change a command. Documentation drift here is
expensive: these files are the context every future agent starts from.
