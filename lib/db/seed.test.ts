import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLATFORM_DAILY_CAP_CEILING, seedWorkspace } from './seed';
import type { PackRegistration } from './seed';

/**
 * Runs against PGlite — a real Postgres, in process — so idempotency is proven against the actual
 * unique constraints rather than against a mock that would agree with whatever the code does.
 *
 * The registration below is a local stand-in, not the installed pack: this file lives in lib/db/
 * and may not reach up into packs/. The real pack is checked against the contract in
 * scripts/db-seed.test.ts, where the two layers are legitimately allowed to meet.
 */

const up = readFileSync(
  fileURLToPath(new URL('./migrations/0000_domain_model.sql', import.meta.url)),
  'utf8',
);

const registration: PackRegistration = {
  key: 'example',
  workspaceName: 'Example Workspace',
  account: {
    platform: 'instagram',
    timezone: 'Europe/Bucharest',
    dailyCap: 12,
  },
};

let client: PGlite;
let db: ReturnType<typeof drizzle>;

async function countOf(table: string): Promise<number> {
  const result = await client.query<{ count: string }>(`SELECT count(*) AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? '-1');
}

beforeEach(async () => {
  client = new PGlite();
  for (const statement of up.split('--> statement-breakpoint')) {
    if (statement.trim() !== '') await client.exec(statement);
  }
  db = drizzle(client);
});

afterEach(async () => {
  await client.close();
});

describe('seeding a registered pack', () => {
  it('creates one workspace and one social account', async () => {
    const outcome = await seedWorkspace(db, registration);

    expect(outcome.createdWorkspace).toBe(true);
    expect(outcome.createdSocialAccount).toBe(true);
    expect(await countOf('workspace')).toBe(1);
    expect(await countOf('social_account')).toBe(1);
  });

  it('names the workspace after the registration', async () => {
    await seedWorkspace(db, registration);

    const created = await client.query<{ name: string }>('SELECT name FROM workspace');
    expect(created.rows[0]?.name).toBe(registration.workspaceName);
  });

  it('seeds the timezone and daily cap as row data, not as constants', async () => {
    await seedWorkspace(db, registration);

    const account = await client.query<{ timezone: string; daily_cap: number }>(
      'SELECT timezone, daily_cap FROM social_account',
    );

    expect(account.rows[0]?.timezone).toBe(registration.account.timezone);
    expect(account.rows[0]?.daily_cap).toBe(registration.account.dailyCap);
  });

  it('seeds no credential — the OAuth exchange in P2 fills the token in', async () => {
    await seedWorkspace(db, registration);

    const account = await client.query<{
      access_token: string;
      ig_user_id: string;
      page_id: string;
      token_expires_at: string | null;
    }>('SELECT access_token, ig_user_id, page_id, token_expires_at FROM social_account');

    expect(account.rows[0]?.access_token).toBe('');
    expect(account.rows[0]?.ig_user_id).toBe('');
    expect(account.rows[0]?.page_id).toBe('');
    expect(account.rows[0]?.token_expires_at).toBeNull();
  });

  it('refuses a cap that reaches the platform ceiling', async () => {
    const overCap: PackRegistration = {
      ...registration,
      account: { ...registration.account, dailyCap: PLATFORM_DAILY_CAP_CEILING },
    };

    await expect(seedWorkspace(db, overCap)).rejects.toThrow(/platform ceiling/);
    expect(await countOf('social_account')).toBe(0);
  });
});

describe('running the seed twice', () => {
  it('adds nothing and returns the same rows', async () => {
    const first = await seedWorkspace(db, registration);
    const second = await seedWorkspace(db, registration);

    expect(second.workspaceId).toBe(first.workspaceId);
    expect(second.socialAccountId).toBe(first.socialAccountId);
    expect(second.createdWorkspace).toBe(false);
    expect(second.createdSocialAccount).toBe(false);
    expect(await countOf('workspace')).toBe(1);
    expect(await countOf('social_account')).toBe(1);
  });

  it('still recognises the account after P2 has filled in the Instagram identity', async () => {
    const first = await seedWorkspace(db, registration);

    // What the OAuth exchange writes. Matching on ig_user_id would stop finding this row and the
    // next seed would add a second account.
    await client.query('UPDATE social_account SET ig_user_id = $1, page_id = $2', [
      '17841400000000000',
      '1122334455',
    ]);

    const second = await seedWorkspace(db, registration);

    expect(second.socialAccountId).toBe(first.socialAccountId);
    expect(second.createdSocialAccount).toBe(false);
    expect(await countOf('social_account')).toBe(1);
  });

  it('does not overwrite a token that P2 already obtained', async () => {
    await seedWorkspace(db, registration);
    await client.query('UPDATE social_account SET access_token = $1', ['a-long-lived-token']);

    await seedWorkspace(db, registration);

    const account = await client.query<{ access_token: string }>(
      'SELECT access_token FROM social_account',
    );
    expect(account.rows[0]?.access_token).toBe('a-long-lived-token');
  });

  it('reuses an existing workspace rather than creating a second of the same name', async () => {
    await client.query('INSERT INTO workspace (name) VALUES ($1)', [registration.workspaceName]);

    const outcome = await seedWorkspace(db, registration);

    expect(outcome.createdWorkspace).toBe(false);
    expect(await countOf('workspace')).toBe(1);
  });
});
