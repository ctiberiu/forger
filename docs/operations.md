# Operations

> Target state. Operational tooling ships in P6. Not yet built.

## Common tasks

| Task | Command |
|---|---|
| Run locally | `pnpm dev` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Lint | `pnpm lint --fix` |
| Boundary guard | `pnpm check:boundary` |
| Migrate | `pnpm db:migrate` |
| Seed workspace + pack | `pnpm db:seed` |

`pnpm db:seed` is idempotent: it matches the workspace by name and the social account by platform,
so re-running it after the P2 OAuth exchange has filled in the Instagram identity recognises the
existing row instead of adding a second account.

## Maintenance routines

- **Instagram token refresh** — scheduled job; long-lived tokens expire in roughly 60 days. Without
  it the app dies silently two months after launch and the audience notices before the logs do.
  A token-expiry warning surfaces on the dashboard; it becomes urgent under 14 days.
- **Cancel-window sweeper** — cron pass that publishes or expires items whose window has elapsed.
- **Connector polling** — `http_pull` connectors on their configured schedule.
- **Asset library** — product photos are curated, never scraped at publish time. Adding a photo is
  a manual operation keyed by product/set.

## Publishing limits to respect

| Limit | Value |
|---|---|
| API posts | 100 per rolling 24 h per account; a carousel counts as 1 |
| Carousel size | Max 10 items, all cropped to the first item's aspect ratio |
| Daily cap | Configured per account, below the platform ceiling |
| Minimum gap | Global, between any two posts |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Publish fails with a media fetch error | The media URL is not publicly reachable — Meta cURLs it; check the blob store is the *public* one |
| Everything renders, nothing publishes | Instagram token expired, or Page Publishing Authorization lapsed |
| A slot produced nothing | Correct outcome — no candidate's condition passed; the reason per candidate is recorded |
| An item was cancelled just before publish | The revalidate gate found the fact had moved. Working as designed |
| Interactive sticker missing | Poll/link/quiz/question stickers cannot be published by any API; that rendition is `assisted` and finishes on the phone |

## Dry-run mode

P6 ships a dry-run mode: the full pipeline runs and renders, but the publish adapter is stubbed.
Use it to exercise rules and rendering without consuming the daily cap.
