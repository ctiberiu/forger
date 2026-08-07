import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FIXTURE_TREES, materialiseFixtureTree } from './__fixtures__/boundary-fixtures';
import { DEFAULT_SCAN_ROOTS, PACK_VOCABULARY, formatViolation, scanRoots } from './check-boundary';
import type { FixtureTree } from './__fixtures__/boundary-fixtures';
import type { Violation } from './check-boundary';

const temporaryDirectories: string[] = [];

function scanFixture(tree: FixtureTree): Violation[] {
  const directory = mkdtempSync(join(tmpdir(), 'postforge-boundary-'));
  temporaryDirectories.push(directory);
  materialiseFixtureTree(tree, directory);
  return scanRoots(DEFAULT_SCAN_ROOTS, directory);
}

function termsFound(violations: Violation[]): string[] {
  return [...new Set(violations.filter((v) => v.rule === 'pack-vocabulary').map((v) => v.term))];
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  }
});

describe('scan roots', () => {
  it('scans lib/engine and lib/db, the two places the boundary can be lost', () => {
    expect(DEFAULT_SCAN_ROOTS).toEqual(['lib/engine', 'lib/db']);
  });

  it('fails loudly when a scan root is missing rather than passing vacuously', () => {
    const directory = mkdtempSync(join(tmpdir(), 'postforge-boundary-'));
    temporaryDirectories.push(directory);

    expect(() => scanRoots(DEFAULT_SCAN_ROOTS, directory)).toThrow(/scan root does not exist/);
  });
});

describe('a deliberate violation in engine code', () => {
  it('reports pack vocabulary with the offending file and line', () => {
    const violations = scanFixture(FIXTURE_TREES.withViolations);
    const engineViolations = violations.filter((v) => v.file.includes('candidates.ts'));

    expect(termsFound(engineViolations)).toEqual(
      expect.arrayContaining(['packradar', 'card', 'shop', 'lei', 'restock']),
    );
    expect(engineViolations.every((v) => v.line > 0)).toBe(true);
  });

  it('reports a pack import in both the aliased and the relative spelling', () => {
    const violations = scanFixture(FIXTURE_TREES.withViolations);
    const importViolations = violations.filter((v) => v.rule === 'pack-import');

    expect(importViolations.map((v) => v.term)).toEqual([
      '@/packs/packradar/tokens',
      '../../packs/packradar/copy',
    ]);
  });
});

describe('a deliberate violation in the schema', () => {
  it('catches pack vocabulary arriving as a column name, which no import rule can see', () => {
    const violations = scanFixture(FIXTURE_TREES.withViolations);
    const schemaViolations = violations.filter((v) => v.file.includes('schema.ts'));

    expect(termsFound(schemaViolations)).toEqual(expect.arrayContaining(['card', 'set', 'shop']));
  });
});

describe('removing the violations', () => {
  it('passes on an engine and a schema file with the pack concepts taken out', () => {
    expect(scanFixture(FIXTURE_TREES.clean)).toEqual([]);
  });
});

describe('the set narrowing', () => {
  it('ignores new Set, .set() and setTimeout, which are ordinary code', () => {
    expect(scanFixture(FIXTURE_TREES.setOrdinaryCode)).toEqual([]);
  });

  it('still catches set_code, parent_set and parentSet', () => {
    const violations = scanFixture(FIXTURE_TREES.setAsPackVocabulary);

    expect(termsFound(violations)).toEqual(['set']);
    expect(violations.map((v) => v.line)).toEqual([2, 3, 4]);
  });
});

describe('the store narrowing', () => {
  it('ignores the blob store and storing a token, which are infrastructure vocabulary', () => {
    expect(scanFixture(FIXTURE_TREES.storeOrdinaryCode)).toEqual([]);
  });

  it('still catches store_id, parent_store and parentStore', () => {
    const violations = scanFixture(FIXTURE_TREES.storeAsPackVocabulary);

    expect(termsFound(violations)).toEqual(['store']);
    expect(violations.map((v) => v.line)).toEqual([2, 3, 4]);
  });
});

describe('pack as the name of the layer', () => {
  it('passes schema comments that use "pack" to describe the boundary itself', () => {
    expect(scanFixture(FIXTURE_TREES.packIsEngineVocabulary)).toEqual([]);
  });

  it('has no bare pack term, which would fail on the engine describing its own architecture', () => {
    expect(PACK_VOCABULARY.map((entry) => entry.term)).not.toContain('pack');
    expect(PACK_VOCABULARY.map((entry) => entry.term)).not.toContain('packs');
  });
});

describe('the term list', () => {
  it('declares every term the architecture requires, in one place', () => {
    expect(PACK_VOCABULARY.map((entry) => entry.term)).toEqual([
      'packradar',
      'pokemon',
      'lorcana',
      'card',
      'booster',
      'restock',
      'sellout',
      'shop',
      'store',
      'sku',
      'tcg',
      'lei',
      'set',
    ]);
  });

  it('narrows exactly the terms that also mean something in engine or infrastructure code', () => {
    const narrowed = PACK_VOCABULARY.filter((entry) => entry.match === 'compound');

    expect(narrowed.map((entry) => entry.term)).toEqual(['store', 'set']);
  });

  it('explains any term that is narrowed, so the narrowing is not mistaken for an omission', () => {
    for (const entry of PACK_VOCABULARY) {
      if (entry.match === 'compound') expect(entry.note).toBeTruthy();
    }
  });
});

describe('output', () => {
  it('prints file:line so a failure points at the code, not just at itself', () => {
    const violations = scanFixture(FIXTURE_TREES.setAsPackVocabulary);
    const first = violations[0];

    expect(first).toBeDefined();
    expect(formatViolation(first as Violation)).toMatch(
      /lib\/engine\/domain\/row\.ts:2 {2}pack vocabulary 'set'/,
    );
  });
});
