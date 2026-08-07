# Setup

> The project installs, builds, lints, tests, migrates and seeds. Every command below exists.

## Prerequisites

**Supported developer platforms: macOS and Linux.** Decided 7 Aug 2026. CI runs Ubuntu and the
deploy target is Linux, so those are the two that must work. Windows is not supported and is not
tested — do not add Windows-only branches to code or tests on reflex. If Windows support is ever
wanted, it starts with someone actually running the suite there and fixing what breaks, not with
defensive guards written against documentation.

- Node.js 22 or later and pnpm 10 — confirmed in P0. The pinned version is `packageManager` in
  `package.json`; `corepack enable pnpm` picks it up
- A Vercel account with the project linked (`vercel link`)
- Neon Postgres provisioned through the Vercel Marketplace
- A Vercel Blob **public** store
- An Instagram professional account linked to a Facebook Page, with Page Publishing Authorization
- A Meta app with `instagram_basic` and `instagram_content_publish` — **App Review is the schedule
  long pole; start it during P0**
- A Telegram bot token (from BotFather) and the operator's chat id

## Install

```
pnpm install
vercel env pull .env.local
pnpm db:migrate       # applies lib/db/migrations/ to DATABASE_URL
pnpm db:seed          # workspace + social account + PackRadar pack
```

`pnpm db:migrate` reads `.env.local` if it is there and otherwise takes `DATABASE_URL` from the
environment. After editing `lib/db/schema.ts`, run `pnpm db:generate` to emit the next forward
migration, then hand-write its reverse in `lib/db/migrations/down/` — drizzle generates forward
migrations only, and `lib/db/schema.test.ts` asserts the round trip.

## Environment variables

Names only — never commit values. Mirror this list in `.env.example`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob public store credentials |
| `IG_APP_ID` / `IG_APP_SECRET` | Meta app credentials for the OAuth exchange |
| `IG_REDIRECT_URI` | OAuth callback |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API |
| `TELEGRAM_CHAT_ID` | Operator's chat for notifications |
| `TELEGRAM_WEBHOOK_SECRET` | Verifies inbound Telegram webhooks |
| `CRON_SECRET` | Authenticates Vercel Cron invocations |
| `TRIGGER_API_KEY` | Authenticates `webhook_push` callers |

Long-lived Instagram tokens are stored per `SocialAccount` in the database, not in environment
variables — they are refreshed on a schedule and expire in roughly 60 days.

## Run

```
pnpm dev              # local dashboard + API routes
pnpm build && pnpm start
```

Cron endpoints are HTTP routes; invoke them directly with `CRON_SECRET` to exercise slot ticks and
the cancel-window sweeper locally.

## Test and lint

```
pnpm test
pnpm lint --fix
pnpm build
```

Run all three before requesting review — see [development-standards.md](development-standards.md).
