import { describe, expect, it } from 'vitest';
import { packRadarRegistration } from '../packs/packradar/pack.config';
import { PLATFORM_DAILY_CAP_CEILING } from '../lib/db/seed';
import type { PackRegistration } from '../lib/db/seed';

/**
 * The composition root's test, and the only place the installed pack and lib/db/ meet. Keeping it
 * out of lib/db/ is not a style choice: a `packs/` import there fails both the lint zones and
 * pnpm check:boundary, which is exactly what those two are for.
 */

describe('the installed pack', () => {
  it('satisfies the registration contract without importing it', () => {
    const registration: PackRegistration = packRadarRegistration;

    expect(registration.key).toBe('packradar');
    expect(registration.workspaceName).toBeTruthy();
    expect(registration.account.platform).toBe('instagram');
  });

  it('registers an IANA timezone, so slots resolve in the account s zone rather than the server s', () => {
    expect(() =>
      new Intl.DateTimeFormat('en', { timeZone: packRadarRegistration.account.timezone }).format(),
    ).not.toThrow();
  });

  it('seeds a daily cap below the platform ceiling of 100 per rolling 24 h', () => {
    expect(packRadarRegistration.account.dailyCap).toBeGreaterThan(0);
    expect(packRadarRegistration.account.dailyCap).toBeLessThan(PLATFORM_DAILY_CAP_CEILING);
  });

  it('carries no credential: a pack is checked in, so a secret here would be committed', () => {
    const declared = JSON.stringify(packRadarRegistration);

    expect(declared).not.toMatch(/token|secret|password|api[_-]?key/i);
  });
});
