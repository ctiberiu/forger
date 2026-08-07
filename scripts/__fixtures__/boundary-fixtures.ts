/**
 * Sample sources for the boundary guard's tests, materialised into a temporary directory rather
 * than checked in as `.ts` files under a scanned path.
 *
 * Two constraints force that shape. A fixture holding a deliberate violation cannot live inside
 * `lib/engine/` or `lib/db/`, or `pnpm check:boundary` fails on its own test data forever. And a
 * fixture holding an unresolvable `packs/` import cannot be a real `.ts` file anywhere the
 * project compiles, because `tsconfig.json` includes `**\/*.ts` and `next build` typechecks it.
 * Writing them to a temp tree keeps the scanner reading real files off a real filesystem while
 * staying invisible to build, lint and typecheck.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type FixtureTree = Readonly<Record<string, string>>;

/** An engine file that leaks pack vocabulary and imports a pack, in both specifier spellings. */
const ENGINE_WITH_VIOLATIONS = `import { tokens } from '@/packs/packradar/tokens';
import { fallbackCopy } from '../../packs/packradar/copy';

export interface CardCandidate {
  cardSet: string;
  shop_id: string;
  price_lei: number;
}

export function evaluateRestock(candidate: CardCandidate): boolean {
  return candidate.price_lei > 0 && tokens !== fallbackCopy;
}
`;

/** The same file with the pack concepts removed — the "removing it passes" half. */
const ENGINE_CLEAN = `export interface Candidate {
  entityKey: string;
  sourceId: string;
  amountMinor: number;
}

export function evaluateCandidate(candidate: Candidate): boolean {
  return candidate.amountMinor > 0;
}
`;

/**
 * The case no import rule can see: pack vocabulary arriving as a column name. This is why
 * `lib/db/` is scanned, and it is the path the schema will be checked against retroactively.
 */
const DB_SCHEMA_WITH_VIOLATIONS = `export const signal = pgTable('signal', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  card_set: text('card_set'),
  shopName: text('shop_name'),
});
`;

const DB_SCHEMA_CLEAN = `export const signal = pgTable('signal', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  entityKey: text('entity_key').notNull(),
  payload: jsonb('payload').notNull(),
});
`;

/** Ordinary code that a bare `set` match would flag: the reason the term is compound-only. */
const SET_ORDINARY_CODE = `const seen = new Set<string>();
const settings = { offset_days: 3 };

export function scheduleSweep(offset: number): void {
  setTimeout(() => seen.add(String(settings.offset_days + offset)), 0);
}

export function applyUpdate(builder: { set: (values: Record<string, unknown>) => void }): void {
  builder.set({ updated_at: new Date() });
}
`;

/** The three shapes the compound rule must still catch, with no other term present. */
const SET_AS_PACK_VOCABULARY = `export interface Row {
  set_code: string;
  parent_set: string;
  parentSet: string;
}
`;

/** Infrastructure prose and identifiers that a bare `store` match would flag. */
const STORE_ORDINARY_CODE = `// Rendered media lands in the public blob store because Meta fetches the URL itself.
// Callers store the token on the account row, never in an environment variable.
export function persistToken(token: string): void {
  writeToBlob(token);
}
`;

const STORE_AS_PACK_VOCABULARY = `export interface Row {
  store_id: string;
  parent_store: string;
  parentStore: string;
}
`;

/**
 * "Pack" names the layer, so it is the engine's own vocabulary. These are the real comments from
 * lib/db/schema.ts — a guard that fails them is failing on prose that describes the boundary
 * correctly, inside the file the guard exists to protect.
 */
const PACK_AS_ENGINE_VOCABULARY = `// Generic by construction: the engine knows these columns exist and nothing about what any
// pack puts inside them.
export const signal = pgTable('signal', {
  // Opaque to the engine: the dedupe and cooldown identity, made stable by the pack that emits it.
  entityKey: text('entity_key').notNull(),
});
`;

/** The reviewer's scenario: one engine file, three violations — `card`, `set`, `shop`. */
const CLI_LEAK = `export interface Candidate {
  cardSet: string;
  shopId: string;
}
`;

const CLI_CLEAN = `export interface Candidate {
  entityKey: string;
}
`;

export const FIXTURE_TREES = {
  withViolations: {
    'lib/engine/rules/candidates.ts': ENGINE_WITH_VIOLATIONS,
    'lib/db/schema.ts': DB_SCHEMA_WITH_VIOLATIONS,
  },
  clean: {
    'lib/engine/rules/candidates.ts': ENGINE_CLEAN,
    'lib/db/schema.ts': DB_SCHEMA_CLEAN,
  },
  setOrdinaryCode: {
    'lib/engine/rules/sweep.ts': SET_ORDINARY_CODE,
    'lib/db/.gitkeep.ts': 'export {};\n',
  },
  setAsPackVocabulary: {
    'lib/engine/domain/row.ts': SET_AS_PACK_VOCABULARY,
    'lib/db/.gitkeep.ts': 'export {};\n',
  },
  storeOrdinaryCode: {
    'lib/engine/publish/blob.ts': STORE_ORDINARY_CODE,
    'lib/db/.gitkeep.ts': 'export {};\n',
  },
  storeAsPackVocabulary: {
    'lib/engine/domain/row.ts': STORE_AS_PACK_VOCABULARY,
    'lib/db/.gitkeep.ts': 'export {};\n',
  },
  packIsEngineVocabulary: {
    'lib/db/schema.ts': PACK_AS_ENGINE_VOCABULARY,
    'lib/engine/.gitkeep.ts': 'export {};\n',
  },
  cliLeak: {
    'lib/engine/leak.ts': CLI_LEAK,
    'lib/db/.gitkeep.ts': 'export {};\n',
  },
  cliClean: {
    'lib/engine/leak.ts': CLI_CLEAN,
    'lib/db/.gitkeep.ts': 'export {};\n',
  },
} as const satisfies Readonly<Record<string, FixtureTree>>;

export function materialiseFixtureTree(tree: FixtureTree, baseDirectory: string): string {
  for (const [relativePath, contents] of Object.entries(tree)) {
    const filePath = join(baseDirectory, relativePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }
  return baseDirectory;
}
