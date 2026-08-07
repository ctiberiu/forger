# Overview

> Target state. Source: master plan §A, §D, §E. Not yet built.

## Purpose and scope

A content engine that publishes to Instagram from live data. A template holds a layout and the
rules that decide whether it should fire; data arrives from a connector; the engine renders an
image, optionally holds it for a human, re-validates the underlying facts, and publishes.

In scope for v1: images, carousels and stories, for one Instagram account, driven by one pack.
Out of scope for v1: reels/video, the meme screenshot pipeline, UGC consent flow, a visual layout
editor, multi-tenant signup and billing.

## The product decision that shapes everything

PostForge is **not internal tooling**. It is a product used for PackRadar first and possibly
generalised to market later. Consequence: no PackRadar concept may exist in engine code, and
`workspace_id` sits on every row from day one — even though v1 configures exactly one workspace
and no signup or billing UI exists.

## High-level capabilities

- **Ingest** — receive a signal by webhook push, or poll a URL on a schedule.
- **Decide** — evaluate template conditions; a scheduled slot picks the first candidate whose
  condition passes; suppress by cooldown, dedupe, minimum gap and daily cap.
- **Render** — compose a layout to a PNG at 1:1, 4:5, 9:16 or as a carousel; no browser involved.
- **Review** — hold the item under one of three approval policies, notify by Telegram.
- **Revalidate** — re-read the source signal immediately before publishing; abort or swap if the
  fact moved. This is the feature, not a safeguard.
- **Publish** — via the Instagram Content Publishing API, or hand off to the operator's phone when
  the post needs an interactive sticker the API cannot attach.

## Primary entry points

| Entry point | Kind | Purpose |
|---|---|---|
| `/api/trigger` | HTTP POST | External systems push `{template_key, payload}`; validated against the template's JSON Schema |
| Vercel Cron | Scheduled | Slot ticks, cancel-window sweeper, token refresh, connector polling |
| Telegram webhook | HTTP POST | Inline Approve / Cancel / Edit / Snooze from the phone |
| Dashboard (web UI) | Browser | System of record: queue, item detail, overview |
| Instagram Graph API | Outbound | Publish; media is fetched by Meta from a public URL |

## Project shape

Single Next.js application deployed to Vercel — dashboard, API triggers and cron all ship in one
deployable. The meaningful boundary is not between services but between **engine** and **pack**
inside the one codebase; see [architecture.md](architecture.md).

## Key directories

> Planned layout — see [code-map.md](code-map.md) for the authoritative map once scaffolded.

| Path | Role |
|---|---|
| `app/` | Next.js routes: dashboard screens, API handlers, cron endpoints |
| `lib/engine/` | Generic engine: domain, state machine, rules, publishing, rendering |
| `packs/packradar/` | PackRadar pack: layouts, tokens, caption copy, connector config, seed rows |
| `docs/` | This documentation set |
| `examples/` | The twelve reference post JPGs — the design source of truth |
