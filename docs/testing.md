# Testing

> Runner confirmed in P0. This states the shape and the non-negotiable coverage targets.

## Frameworks and locations

| Concern | Choice |
|---|---|
| Unit / integration | **Vitest** — confirmed in P0. Native ESM and TypeScript with no separate transform step, and it reads the same path aliases as the app |
| E2E | Playwright, only where a browser flow is the thing under test — *not installed until a browser flow exists* |
| Location | Colocated `*.test.ts` beside the unit under test |

Vitest runs in the `node` environment. A test that needs the DOM opts in per file with
`// @vitest-environment jsdom`, which pulls in the dependency at that point and not before.

## Commands

```
pnpm test
pnpm test:watch
```

## What must be covered

Tests are proportionate: they cover the acceptance criteria of the sub-epic that introduced the
behaviour, and normal-use paths. There is no blanket coverage percentage. These specific behaviours
are load-bearing enough that shipping them untested is a defect:

- **Revalidate gate** — a moved fact aborts or swaps; an unmoved fact publishes. Every approval
  policy, including `auto`.
- **Candidate selection** — first passing condition wins; none pass logs the slot empty with a
  per-candidate reason; ordering is respected.
- **Suppression** — cooldown per `(template, entity_key)`, minimum gap, daily cap, no re-alert of
  the same entity inside the window.
- **Caption/payload agreement** — a caption whose claims contradict the rendered payload is
  rejected before the item can enter the queue.
- **State machine** — every legal transition, and that illegal ones are refused.
- **Rate limiting** — the 100-per-rolling-24 h ceiling and the account's own daily cap.
- **Carousel geometry** — max 10 items; all slides forced to the first item's aspect ratio.

## Test data

Payload fixtures derive from `examples/` — real store names, four-digit prices, missing photos.
Fixtures must include the awkward cases the design brief calls out: a long store name, a product
with no photo, a price that moves between render and publish.

## Quality gates

`pnpm build`, `pnpm lint --fix` and `pnpm test` must all pass before review is requested.
The engine/pack grep guard (no PackRadar identifiers in `lib/engine/`) runs in CI as a hard gate.
