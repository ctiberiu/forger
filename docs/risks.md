# Risks

> Source: master plan §I, plus items surfaced while reviewing the dashboard design on 6 Aug 2026.

## Known risks

| Risk | Severity | Mitigation |
|---|---|---|
| Meta App Review latency for `instagram_content_publish` | High — schedule | Start during P0, in parallel with code. The long pole, and not an engineering task |
| Satori's CSS subset cannot express a layout | Medium | Proven against the hardest layout in P1, before nine more are committed to |
| Stale data published during an approval delay | High — brand | The revalidate gate; freshness TTL per template |
| PackRadar concepts leaking into engine code | Medium — future | CI grep guard; P5 is the proof the split held |
| Two of the twelve reference posts are not automatable at all | Accepted | `09-story-poll` needs a poll sticker, `06-story-live` needs a link sticker; neither is API-publishable. Handled as `assisted` renditions, not as failures |

## The constraint that hurts most

`06-story-live` reads "link sticker goes here" — and the link sticker is the **only** mechanism by
which an Instagram story sends traffic to packradar.app. It cannot be applied by any API. Assisted
publishing is therefore not an optional convenience; without it the entire story funnel has no
call to action.

## Security and secrets

- Instagram long-lived tokens are per-account rows in Postgres, not environment variables; they
  expire in ~60 days and must be refreshed on a schedule.
- `.env` values are never committed; `.env.example` carries variable names only.
- The trigger endpoint and the Telegram webhook are both authenticated (`TRIGGER_API_KEY`,
  `TELEGRAM_WEBHOOK_SECRET`); cron endpoints require `CRON_SECRET`.
- Rendered media is deliberately **public** — Meta must fetch it. Nothing sensitive may be rendered
  into an asset.

## Fragile areas

- **The revalidate gate** is the single highest-value mechanism in the product and the easiest to
  quietly break; it must be exercised for every approval policy including `auto`.
- **Timezone handling** in slot schedules — `rrule` plus a per-account timezone; off-by-one-hour
  bugs here publish at the wrong time of day and are invisible in tests that use UTC.
- **Caption/payload agreement** — the moment an LLM writes more than the hook line, the product can
  publish a false claim.

## Unknowns and open questions

| # | Question | What it gates |
|---|---|---|
| Q1 | Does PackRadar expose an API today — endpoints and auth, or "not yet"? | P5 only. Either answer is workable |
| Q2 | Do the Instagram Business account, linked Facebook Page and Meta app already exist? | Everything in P2. If not, this starts today in parallel — App Review is the schedule risk, not the code |
| Q4 | Any objection to the stack in `docs/stack.md`? | P0 scaffold. Assumed accepted |

Q3 (are the example JPGs the final design direction) is **answered**: yes. They are the design
source of truth, and the operator dashboard direction "Pale instrument" was validated against real
post facsimiles on 6 Aug 2026.

## Design-derived gaps carried into the plan

Raised while reviewing the dashboard design; each is a real gap, none blocks P0:

- No carousel treatment exists in the dashboard design — the queue shows 1:1 and 9:16 only.
  Needed before the queue can display carousel items (P4/P5).
- The Schedule and Template-editor screens are unbuilt in the design; they are roadmap, not v1.
- The assisted-publish item shows a countdown styled like a real deadline, but nothing happens when
  it elapses. Needs distinct treatment or a label.
- No behaviour spec for live countdowns: whether they tick client-side, whether the list re-sorts,
  what happens when one reaches zero on screen.
- Six actions appear in the mockups that the master plan never specified — `Delay an hour`,
  `Remind me in 3 days`, `Mark as posted`, `Re-send to phone`, `Download image`, `Renew now`.
  Each implies an endpoint; each needs a decision before the dashboard sub-epics are built.
