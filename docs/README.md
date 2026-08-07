# PostForge — Documentation

> **Status: target state.** No application code exists yet. Every claim in `docs/` is sourced
> from `PostForge-Draft-Master-Plan.pdf` (approved 6 Aug 2026) and `design-brief.md`, not from
> observed code. Sections describing an implemented system are marked *Not yet built*.
> This set is rewritten from the codebase once P1 lands.

PostForge is a template-driven Instagram content engine. Templates hold layout and rules; data
arrives by webhook or polling; the engine renders an image, holds it for approval, **re-checks the
facts**, and publishes. PackRadar — a radar sweeping 88 Romanian shops for trading-card stock and
price changes — is its first *pack*, not its subject.

## Contents

| Document | What it answers |
|---|---|
| [overview.md](overview.md) | What this is for, entry points, project shape |
| [ai-agents-guide.md](ai-agents-guide.md) | How an agent works in this repo safely |
| [stack.md](stack.md) | Languages, frameworks, datastores, infrastructure |
| [architecture.md](architecture.md) | Engine vs. Pack, domain model, pipeline, state machine |
| [code-map.md](code-map.md) | Directory map, entry points, config files |
| [setup.md](setup.md) | Prerequisites, install, environment variables, run |
| [operations.md](operations.md) | Build/run/test tasks, maintenance, troubleshooting |
| [testing.md](testing.md) | Frameworks, locations, commands, quality gates |
| [dependencies.md](dependencies.md) | First-party packages, third-party deps, external APIs |
| [risks.md](risks.md) | Known risks, security notes, fragile areas, unknowns |
| [development-standards.md](development-standards.md) | **Mandatory** — enforceable coding standards |

## Repository quick facts

| Fact | Value |
|---|---|
| Language | TypeScript |
| Framework | Next.js (App Router) |
| Deploy target | Vercel |
| Datastore | Postgres (Neon, via Vercel Marketplace) |
| Project shape | Single Next.js app; internal engine/pack split enforced by convention + CI |
| Packages/services | 1 deployable |
| Current phase | P0 — Foundations |

## The one invariant

**Zero PackRadar identifiers in engine code.** No PackRadar concept may appear as a table column,
an enum value, or a field name in the engine layer. Enforced by a grep check in CI. P5 (building
the PackRadar pack with no engine changes) is the proof the split held.
