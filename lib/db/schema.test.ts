import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connectorKind,
  contentItemState,
  publishMode,
  renditionFormat,
  socialPlatform,
} from './schema';

/**
 * Runs the migration against PGlite — a real Postgres, in process. The alternative is a live
 * Neon branch, which would make the suite need credentials and a network to say anything at all.
 */

const migrationSql = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const up = migrationSql('./migrations/0000_domain_model.sql');
const down = migrationSql('./migrations/down/0000_domain_model.sql');

/** The entities of master plan §F. `slot_candidate` carries `Slot.candidates`. */
const expectedTables = [
  'asset',
  'connector',
  'content_item',
  'publish_attempt',
  'rendition',
  'signal',
  'slot',
  'slot_candidate',
  'social_account',
  'template',
  'workspace',
];

let db: PGlite;

async function applyMigration(sql: string): Promise<void> {
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim() !== '') {
      await db.exec(statement);
    }
  }
}

async function tableNames(): Promise<string[]> {
  const result = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigration(up);
});

afterAll(async () => {
  await db.close();
});

describe('the domain model migration', () => {
  it('creates every entity of master plan §F', async () => {
    expect(await tableNames()).toEqual(expectedTables);
  });

  it('gives every table a non-null workspace_id, indexed', async () => {
    const columns = await db.query<{ table_name: string; is_nullable: string }>(
      `SELECT table_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'workspace_id'`,
    );

    // `workspace.id` is itself the tenant key, so it carries no column pointing at itself.
    const tenantScoped = expectedTables.filter((name) => name !== 'workspace');
    expect(columns.rows.map((row) => row.table_name).sort()).toEqual(tenantScoped);
    expect(columns.rows.every((row) => row.is_nullable === 'NO')).toBe(true);

    const indexed = await db.query<{ tablename: string }>(
      `SELECT DISTINCT tablename FROM pg_indexes
       WHERE schemaname = 'public' AND indexdef LIKE '%(workspace_id%'`,
    );
    expect(indexed.rows.map((row) => row.tablename).sort()).toEqual(tenantScoped);
  });

  it('stores every timestamp as UTC-aware and holds no floating-point column', async () => {
    const columns = await db.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public'`,
    );
    const types = columns.rows.map((row) => row.data_type);

    expect(types).not.toContain('timestamp without time zone');
    expect(types.filter((type) => type.startsWith('timestamp')).length).toBeGreaterThan(0);
    // Money is an integer minor unit plus a currency code, never a float — and no engine table
    // holds money at all, because an amount is payload the pack supplies.
    expect(types).not.toContain('real');
    expect(types).not.toContain('double precision');
    expect(types).not.toContain('numeric');
    expect(types).not.toContain('money');
  });

  it('stores payloads and schemas as jsonb', async () => {
    const columns = await db.query<{ table_name: string; column_name: string; udt_name: string }>(
      `SELECT table_name, column_name, udt_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name IN ('payload', 'payload_schema', 'config', 'payload_snapshot',
                             'data_binding', 'condition', 'request', 'response', 'error')`,
    );

    expect(columns.rows.length).toBeGreaterThan(0);
    expect(columns.rows.every((row) => row.udt_name === 'jsonb')).toBe(true);
  });

  it('declares the rendition enums with exactly the specified values', async () => {
    const labels = async (typeName: string) => {
      const result = await db.query<{ enumlabel: string }>(
        `SELECT enumlabel FROM pg_enum
         JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
         WHERE typname = $1 ORDER BY enumsortorder`,
        [typeName],
      );
      return result.rows.map((row) => row.enumlabel);
    };

    expect(await labels('rendition_format')).toEqual([
      'feed_1x1',
      'feed_4x5',
      'story_9x16',
      'carousel',
    ]);
    expect(await labels('publish_mode')).toEqual(['auto', 'assisted']);

    // The TypeScript enums the engine will branch on must not drift from the database's.
    expect(renditionFormat.enumValues).toEqual(await labels('rendition_format'));
    expect(publishMode.enumValues).toEqual(await labels('publish_mode'));
    expect(connectorKind.enumValues).toEqual(await labels('connector_kind'));
    expect(socialPlatform.enumValues).toEqual(await labels('social_platform'));
    expect(contentItemState.enumValues).toEqual(await labels('content_item_state'));
  });
});

describe('tenancy constraints', () => {
  it('rejects a row with no workspace_id', async () => {
    await expect(
      db.exec(`INSERT INTO asset (public_url) VALUES ('https://example.test/a.png')`),
    ).rejects.toThrow(/workspace_id/);
  });

  it('rejects a workspace_id that belongs to no workspace', async () => {
    await expect(
      db.exec(
        `INSERT INTO asset (workspace_id, public_url)
         VALUES ('00000000-0000-0000-0000-000000000000', 'https://example.test/b.png')`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });
});

describe('slot candidate ordering', () => {
  it('reads back in position order, not insertion order', async () => {
    const seed = await db.query<{ workspace_id: string; slot_id: string }>(`
      WITH w AS (INSERT INTO workspace (name) VALUES ('ordering') RETURNING id),
      a AS (
        INSERT INTO social_account
          (workspace_id, platform, ig_user_id, page_id, access_token, timezone, daily_cap)
        SELECT w.id, 'instagram', 'ig-1', 'page-1', 'redacted', 'Europe/Bucharest', 5 FROM w
        RETURNING id, workspace_id
      )
      INSERT INTO slot (workspace_id, social_account_id, name, rrule, timezone, target_format)
      SELECT a.workspace_id, a.id, 'evening', 'FREQ=DAILY;BYHOUR=19', 'Europe/Bucharest', 'feed_1x1'
      FROM a
      RETURNING workspace_id, id AS slot_id
    `);

    const seeded = seed.rows[0];
    expect(seeded).toBeDefined();
    const { workspace_id: workspaceId, slot_id: slotId } = seeded!;

    // Inserted third, second, first — so insertion order and position disagree.
    for (const [key, position] of [
      ['third', 3],
      ['second', 2],
      ['first', 1],
    ] as const) {
      await db.query(
        `WITH t AS (
           INSERT INTO template (workspace_id, key, data_binding, condition,
                                 freshness_ttl_seconds, cooldown_seconds, caption)
           VALUES ($1, $2, '{}'::jsonb, '{}'::jsonb, 300, 3600, 'caption')
           RETURNING id, workspace_id
         )
         INSERT INTO slot_candidate (workspace_id, slot_id, template_id, position)
         SELECT t.workspace_id, $3, t.id, $4 FROM t`,
        [workspaceId, key, slotId, position],
      );
    }

    const candidates = await db.query<{ key: string }>(
      `SELECT template.key FROM slot_candidate
       JOIN template ON template.id = slot_candidate.template_id
       WHERE slot_candidate.slot_id = $1 ORDER BY slot_candidate.position`,
      [slotId],
    );

    expect(candidates.rows.map((row) => row.key)).toEqual(['first', 'second', 'third']);
  });

  it('refuses two candidates at the same position in one slot', async () => {
    const seed = await db.query<{ workspace_id: string; slot_id: string; template_id: string }>(`
      WITH w AS (INSERT INTO workspace (name) VALUES ('collision') RETURNING id),
      a AS (
        INSERT INTO social_account
          (workspace_id, platform, ig_user_id, page_id, access_token, timezone, daily_cap)
        SELECT w.id, 'instagram', 'ig-2', 'page-2', 'redacted', 'UTC', 5 FROM w
        RETURNING id, workspace_id
      ),
      s AS (
        INSERT INTO slot (workspace_id, social_account_id, name, rrule, timezone, target_format)
        SELECT a.workspace_id, a.id, 'morning', 'FREQ=DAILY', 'UTC', 'story_9x16' FROM a
        RETURNING id, workspace_id
      )
      INSERT INTO template (workspace_id, key, data_binding, condition,
                            freshness_ttl_seconds, cooldown_seconds, caption)
      SELECT s.workspace_id, 'only', '{}'::jsonb, '{}'::jsonb, 300, 3600, 'caption' FROM s
      RETURNING workspace_id, (SELECT id FROM s) AS slot_id, id AS template_id
    `);

    const seeded = seed.rows[0];
    expect(seeded).toBeDefined();
    const { workspace_id: workspaceId, slot_id: slotId, template_id: templateId } = seeded!;

    const insertAtPositionOne = () =>
      db.query(
        `INSERT INTO slot_candidate (workspace_id, slot_id, template_id, position)
         VALUES ($1, $2, $3, 1)`,
        [workspaceId, slotId, templateId],
      );

    await insertAtPositionOne();
    await expect(insertAtPositionOne()).rejects.toThrow(/slot_candidate_slot_position_idx/);
  });
});

describe('migration reversibility', () => {
  it('drops everything it created, and applies again afterwards', async () => {
    const scratch = new PGlite();
    const apply = async (sql: string) => {
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim() !== '') {
          await scratch.exec(statement);
        }
      }
    };

    const publicTables = async () => {
      const result = await scratch.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' ORDER BY table_name`,
      );
      return result.rows.map((row) => row.table_name);
    };
    const publicEnums = async () => {
      const result = await scratch.query<{ typname: string }>(
        `SELECT typname FROM pg_type
         JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
         WHERE typtype = 'e' AND nspname = 'public'`,
      );
      return result.rows.map((row) => row.typname);
    };

    await apply(up);
    expect(await publicTables()).toEqual(expectedTables);

    await apply(down);
    expect(await publicTables()).toEqual([]);
    expect(await publicEnums()).toEqual([]);

    await apply(up);
    expect(await publicTables()).toEqual(expectedTables);

    await scratch.close();
  });
});
