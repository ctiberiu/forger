/**
 * PackRadar's registration — the "plus seed rows" half of "a pack is a directory plus seed rows".
 *
 * Nothing in `lib/engine/` or `lib/db/` imports this file. The composition root in
 * `scripts/db-seed.ts` passes it to the generic seed, which is what resolving a pack through
 * configuration means in practice. Both `eslint.config.mjs` and `pnpm check:boundary` enforce
 * that no layer below reaches up to it.
 *
 * It imports no contract type on purpose: a pack may not import `lib/db/`, so the shape below is
 * matched structurally where the two meet.
 */
export const packRadarRegistration = {
  key: 'packradar',
  workspaceName: 'PackRadar',
  account: {
    platform: 'instagram',
    /** Slots and rrules are evaluated in this zone; stored timestamps stay UTC. */
    timezone: 'Europe/Bucharest',
    /**
     * A starting value an operator may raise, not a limit the engine enforces — the platform
     * ceiling of 100 per rolling 24 h is the thing that may never be reached.
     */
    dailyCap: 12,
  },
} as const;
