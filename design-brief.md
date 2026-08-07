# PostForge — Design Brief

**From:** Project Architect · **Date:** 6 Aug 2026 · **Status:** ready to design · **Rev 2** (adds §3E Overview, build order)

> Local copy. The canonical version lives in the Claude Design project:
> https://claude.ai/design/p/d2ea160d-1743-4b71-94db-7c512e9b155c?file=BRIEF.md

---

## 1. What PostForge is

A content engine that publishes to Instagram from live data. Templates hold layout + rules; data arrives
by webhook or polling; the engine renders an image, holds it for approval, re-checks the facts, and posts.

Its first user is **PackRadar** — a radar that sweeps 88 Romanian shops for Pokémon/One Piece/Lorcana card
stock and price changes, and posts when something lands. But PostForge is deliberately generic: PackRadar is
a *pack* of templates loaded into it, not the product itself. It may become a product other people use.

**This brief is for the operator dashboard — the web app.** Not the Instagram posts themselves; those are
already designed (12 of them exist).

## 2. Who uses it

One person, running a content account alongside other work. They are not sitting in this dashboard —
they are notified by a Telegram bot and open the dashboard when something needs a decision or a change.

That sets the tone: **this is not an app to spend the day in.** Every screen should answer a question fast
and let the person leave. The most common session is 40 seconds long.

## 3. What to design

Five screens. Each carries a real design problem — the conventional CRUD screens (assets, history, settings)
are deliberately excluded.

**Build order matters for how much polish to invest.** A, B and E ship in v1. C and D are roadmap: in v1
templates and slots are configured as seed files by the developer, so their screens exist to establish the
direction for when this becomes multi-user — design them at direction fidelity, not pixel fidelity.

### A. Review Queue — the hero screen · *v1*
Everything waiting on a human, plus what is scheduled next. A row is a pending post: rendered preview,
which template made it, why it's here, and how long until it goes out by itself.

Simultaneously present in this list:
- **1:1 feed posts**, **9:16 stories**, and **6-slide carousels** — three aspect ratios, one list
- Three different waiting modes (see §4)
- Countdowns from 2 minutes to 6 hours

### B. Item detail / decision view · *v1*
One pending post, full size. The preview at true aspect, the caption, the data it was built from, and the
decision: publish now, cancel, edit caption, or push to phone. Must also express **assisted publish** (§4).

### C. Schedule · *roadmap*
What posts when. Each scheduled opportunity (a "slot") holds an **ordered list of candidate templates** —
the first one whose data condition passes wins, the rest are skipped. The screen has to make three things
legible: the order, why today's winner won, and that a slot which produced nothing is *working as designed*.

### D. Template editor · *roadmap*
The densest screen. One template configures: its data source and condition, one or more renditions
(1:1 / 9:16 / carousel, each auto or assisted), a caption with slots and a pool of hand-written variants,
an approval policy, a freshness window, and a cooldown. This is a lot of form; the problem is making it
feel like a small number of decisions rather than twenty fields.

### E. Overview — the landing screen · *v1*

**The governing idea: this dashboard reports on the engine, not on the audience.** There are no likes,
no reach, no follower counts — that is Instagram's own app's job, and it is data you cannot act on from
here. Every number on this screen should either trigger an action or confirm that silence was intentional.

It answers four questions, in this order of importance:

**1. Is it alive?** The engine runs unattended for days. The single most valuable thing this screen can say
is "still working."
- Last signal received · `4 min ago`
- Last successful publish · `2h ago — price_drop`
- Instagram token expires · `in 47 days` (this becomes urgent under 14; it silently kills the product)
- Connector health · `2 of 2 responding`

**2. What needs me?**
- `2 awaiting decision — one publishes in 4 min`
- Next scheduled: `in_stock_story · today 18:00` · `weekly_report · Sunday 09:00`

**3. What did it decide NOT to do?** — *the distinctive part of this screen*
A normal content tool shows what it published. This one must also show its restraint, because the restraint
is the feature. Over the last 7 days:
- `9 published`
- `3 slots empty` — no candidate's condition passed
- `2 cancelled — data went stale before publish`
- `1 expired unheard`

Those four numbers belong together as one honest ledger. The three non-publishing outcomes are not failures
and must not be styled as failures (see §4⑥). A week of `9 / 3 / 2 / 1` is a healthy week.

**4. Is anything quietly broken?**
- Today's volume against the cap · `3 of 6`
- Templates by fires in 30 days · `restock_alert 14` · `price_drop 9` · `in_stock_story 30` ·
  `weekly_report 4` · `hunter_poll 4` · **`sellout_recap 0`**

That last one is the whole point of the tile: a template that has not fired in 30 days is either broken or
pointless, and nothing else in the product will ever tell you. It should be quietly flagged — not alarming,
but impossible to miss on a 40-second visit.

## 4. The hard problems — this is the real brief

**① Time pressure has to be visible without being stressful.**
A post with 3 minutes left and a post with 6 hours left are different objects. A countdown that ticks toward
auto-publish is unusual in a CMS — most tools wait for you forever. This one doesn't. What does urgency look
like when the resting state is calm?

**② Three waiting modes must be distinguishable at a glance.**
- `auto` — publishes itself, shown only so you know it happened
- `cancel_window` — publishes in N minutes **unless you stop it**
- `require_approval` — never publishes without an explicit yes; expires unheard

These are genuinely different relationships to the same object. The first is a notification, the second is a
deadline, the third is a request.

**③ Assisted publish is a handoff, not a publish.**
Instagram's API cannot attach poll or link stickers. Those posts get rendered, sent to the operator's phone,
and finished by hand in the Instagram app. In the dashboard this is a distinct state: *the system has done
its half and is waiting on your thumbs.* It should not look like a failure or like a normal publish.

**④ Mixed aspect ratios in one list.**
1:1, 9:16, and a 6-slide carousel need to sit in the same queue without the layout going ragged and without
the 9:16 story dominating by height.

**⑤ An empty slot is information.**
When no candidate template's condition passed, nothing posts. That is a correct outcome, not an error — but
the operator still needs to see it happened and why ("no restock over 500 lei in the last 24h").

**⑥ A cancelled-for-staleness post is the system working.**
Before publishing, the engine re-checks the facts. If the price moved or the item sold out, the post is
killed. This is the single most valuable thing the product does and it should feel like a save, not an error.
Red and a warning triangle would be exactly wrong.

**⑦ Density without a wall of fields** (template editor, §3D).

**⑧ Reporting restraint without looking empty** (overview, §3E.3). Three of the four headline numbers describe
things that did *not* happen. Most dashboards would either hide those or paint them red; both are wrong here.

## 5. Aesthetic direction

**The chrome is a frame; the content is the picture.** The posts previewed inside this UI are loud —
near-black tiles with vivid green type. The dashboard must not compete with them.

Hard constraints:

- **Do not use PackRadar's green (`#2EE66B`) as the UI accent.** Two reasons: the previews are already that
  colour and would disappear into a matching chrome; and PostForge is the generic engine — PackRadar is one
  tenant of it, so its brand must not be baked into the product. This is an architectural rule, not taste.
- **Prefer a light, warm-neutral UI.** The content previews are dark; light chrome frames them with the most
  contrast. If you want to argue for dark, show it against a preview and make the case.
- **One accent, reserved for time.** Countdowns and deadlines are the only thing in this product that is
  genuinely urgent. Don't spend the accent anywhere else.
- 1–2 typefaces. A mono face for data (prices, timestamps, counts, template keys) is welcome — it suits the
  domain and the previews already use one. Avoid Inter.
- No emoji. No gradient backgrounds. No rounded card with a coloured left border.

## 6. Real content — please use it, not lorem

The previews inside the mockups should be **HTML facsimiles** of the real posts (they are simple typographic
layouts — no photography needed). Post-card palette: background `#0A0F14`, signal green `#2EE66B`, mint
`#C8F5DC`, muted `#7C8C84`. Two of the twelve invert: green background, near-black type.

Real strings to build from:

| Field | Values |
|---|---|
| Stores | CARDMARKET.RO · RED GOBLIN · LUDICUS · PLAYGROUND TCG · HOBBYGAMES |
| Products | Prismatic Evolutions Booster Box · Surging Sparks ETB · OP-09 Display (One Piece) · Lorcana · Azurite Sea |
| Prices | 899 lei · 349 lei · 799 lei · 620 lei · 399 → 319 lei (−20%) |
| Stats | 88 stores swept · 127 restocks caught · 34 price drops · 18 min fastest sellout |
| Template keys | `restock_alert` · `price_drop` · `in_stock_story` · `weekly_report` · `sellout_recap` · `hunter_poll` |
| Post voice | "SIGNAL DETECTED" · "PRICE DROP DETECTED" · "The radar sees it the minute it lands." |

UI copy tone: plain and specific. "Publishes in 4 min" beats "Pending approval". "No restock cleared the
500 lei threshold" beats "No data available".

## 7. What I'd like back

1. **Three directions for the Review Queue (§3A) first**, side by side on a design canvas — different answers
   to problems ①–④, not three colourways of one idea. I'll pick one before you build anything else.
2. Then **Overview (§3E)** and **Item detail (§3B)** in the chosen direction — these ship with the queue.
3. Then **Schedule (§3C)** and **Template editor (§3D)** at direction fidelity — roadmap, not v1 build.
4. Desktop-first at 1440. Responsive behaviour noted but not designed — approvals happen in Telegram on the
   phone, so the dashboard's mobile case is light editing, not the core flow.
5. The states, not just the happy path: empty queue, an assisted-publish item, a stale-cancelled item, a slot
   that produced nothing, an Instagram token about to expire.

## 8. Out of scope

Marketing site · logo or brand identity · the Instagram post templates themselves (already designed) ·
settings, billing, sign-up, multi-user · asset library · audit log · dark mode variants · anything about
Reels or video · **Instagram engagement analytics** (likes, reach, followers — see §3E).

## 9. Open questions for me

Ask rather than guess — I'm the architect on this and can answer within the hour:

- Anything in §4 that reads as contradictory once you start drawing it
- Whether a screen needs data I haven't specified
- If you want to push back on the light-UI recommendation in §5 — that one is a recommendation with a
  reason, not a rule, unlike the no-green constraint

---

## Kickoff prompt (paste this into Claude Design)

> Read BRIEF.md in this project. Start with §7.1 only: three directions for the Review Queue, side by side
> on a canvas — three different answers to problems ①–④ in §4, not three colourways of one layout. Two hard
> constraints from §5: the UI accent must not be PackRadar's green (#2EE66B), and build the post previews as
> real HTML facsimiles using the palette and strings in §6, not grey boxes. Stop after the three directions.
