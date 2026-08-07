/**
 * The vocabulary half of the engine/pack boundary.
 *
 * The `no-restricted-imports` zones in eslint.config.mjs catch a module that crosses a layer.
 * They cannot see a pack word that arrives as a column name, an enum member or a field — which
 * is why `lib/db/` is scanned here as well as `lib/engine/`. The two halves are deliberately
 * overlapping on `packs/` imports: lint fails fast and can be waived with a disable comment,
 * this cannot.
 *
 * Extending: add to PACK_VOCABULARY below when a new pack introduces new vocabulary. That list
 * is the only place terms are declared.
 *
 * A term earns a bare match only if it has no legitimate meaning in engine or infrastructure
 * vocabulary. `card` and `restock` pass that test; `set`, `store` and `pack` do not, so the first
 * two are narrowed to compound forms and the third is absent entirely — "pack" is the name of the
 * layer, and a guard that fails on prose describing the boundary is failing inside the files it
 * exists to protect. Apply that test when adding a term.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { existsSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * `word` matches a whole part of an identifier: `card`, `card_set`, `cardSet` and `CARD_ID` all
 * hit the term `card`, while `discard` and `cards` do not.
 *
 * `compound` matches only where the term is joined to another word — `term_x`, `x_term`, `xTerm`.
 * It exists for terms that are also ordinary code.
 */
export type MatchMode = 'word' | 'compound';

export interface VocabularyTerm {
  readonly term: string;
  readonly match: MatchMode;
  readonly note?: string;
}

export const PACK_VOCABULARY: readonly VocabularyTerm[] = [
  { term: 'packradar', match: 'word' },
  { term: 'pokemon', match: 'word' },
  { term: 'lorcana', match: 'word' },
  { term: 'card', match: 'word' },
  { term: 'booster', match: 'word' },
  { term: 'restock', match: 'word' },
  { term: 'sellout', match: 'word' },
  { term: 'shop', match: 'word' },
  {
    term: 'store',
    match: 'compound',
    // "The blob store", "store the token" and "Vercel Blob public store" are correct
    // infrastructure vocabulary and will recur throughout lib/engine/publish/. `shop` carries the
    // domain concept unnarrowed, so sparing the prose form costs nothing.
    note: 'Compound only: the blob store and storing a token are infrastructure, not a pack.',
  },
  { term: 'sku', match: 'word' },
  { term: 'tcg', match: 'word' },
  { term: 'lei', match: 'word' },
  {
    term: 'set',
    match: 'compound',
    // A plain match on `set` hits `new Set()`, `setTimeout` and the query builder's `.set({...})`,
    // which would make the gate unusable in lib/db/ and get the term deleted. Compound form keeps
    // `card_set`, `set_code` and `cardSet` failing while leaving those alone.
    note: 'Compound only: bare Set, .set() and setTimeout are ordinary code, not pack vocabulary.',
  },
];

export const DEFAULT_SCAN_ROOTS = ['lib/engine', 'lib/db'] as const;

const SCANNED_EXTENSIONS = ['.ts', '.tsx'] as const;

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', '.git']);

export type ViolationRule = 'pack-vocabulary' | 'pack-import';

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly rule: ViolationRule;
  readonly term: string;
  readonly text: string;
}

/** Captures the specifier of `from 'x'`, `import 'x'`, `import('x')` and `require('x')`. */
const IMPORT_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;

/** Matches `packs/…` anywhere in a specifier, covering both `@/packs/x` and `../../packs/x`. */
const PACKS_SPECIFIER = /(?:^|\/)packs\//;

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;

/**
 * Splits an identifier into its lowercase parts, so that `cardSet`, `card_set` and `CARD_SET`
 * all yield `['card', 'set']`. The joined form is compared too, so `PackRadar` still matches
 * the single-word term `packradar`.
 */
function identifierCandidates(token: string): string[] {
  const parts = token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.toLowerCase());

  return [token.toLowerCase(), parts.join(''), ...parts];
}

function compoundPatterns(term: string): RegExp[] {
  const capitalised = term.charAt(0).toUpperCase() + term.slice(1);
  return [
    // set_code — but not offset_days, where `set` is the tail of another word.
    new RegExp(`(?<![A-Za-z0-9])${term}_(?=[A-Za-z0-9])`, 'gi'),
    // card_set and card_sets — but not card_settings.
    new RegExp(`(?<=[A-Za-z0-9])_${term}s?(?![A-Za-z0-9])`, 'gi'),
    // cardSet — case-sensitive, so `offset` and `.set(` stay clean.
    new RegExp(`(?<=[A-Za-z0-9])${capitalised}s?(?![a-z])`, 'g'),
  ];
}

const WORD_TERMS = new Map(
  PACK_VOCABULARY.filter((entry) => entry.match === 'word').map((entry) => [entry.term, entry]),
);

const COMPOUND_TERMS = PACK_VOCABULARY.filter((entry) => entry.match === 'compound').map(
  (entry) => ({ term: entry.term, patterns: compoundPatterns(entry.term) }),
);

function findTermsInLine(line: string): string[] {
  const found = new Set<string>();

  for (const match of line.matchAll(IDENTIFIER)) {
    const token = match[0];
    if (token === undefined) continue;
    for (const candidate of identifierCandidates(token)) {
      if (WORD_TERMS.has(candidate)) found.add(candidate);
    }
  }

  for (const { term, patterns } of COMPOUND_TERMS) {
    if (patterns.some((pattern) => pattern.test(line))) found.add(term);
    for (const pattern of patterns) pattern.lastIndex = 0;
  }

  return [...found];
}

function findPackImportsInLine(line: string): string[] {
  const specifiers: string[] = [];
  for (const match of line.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (specifier !== undefined && PACKS_SPECIFIER.test(specifier)) specifiers.push(specifier);
  }
  return specifiers;
}

export function scanFile(filePath: string, displayPath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const text = line.trim();

    for (const specifier of findPackImportsInLine(line)) {
      violations.push({
        file: displayPath,
        line: lineNumber,
        rule: 'pack-import',
        term: specifier,
        text,
      });
    }

    for (const term of findTermsInLine(line)) {
      violations.push({ file: displayPath, line: lineNumber, rule: 'pack-vocabulary', term, text });
    }
  });

  return violations;
}

function collectFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      files.push(...collectFiles(entryPath));
    } else if (SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(entryPath);
    }
  }
  return files;
}

/**
 * Throws on a missing root rather than passing vacuously: a renamed directory would otherwise
 * turn the gate green while checking nothing.
 */
export function scanRoots(roots: readonly string[], baseDirectory: string): Violation[] {
  const violations: Violation[] = [];

  for (const root of roots) {
    const absoluteRoot = join(baseDirectory, root);
    if (!existsSync(absoluteRoot)) {
      throw new Error(`check:boundary scan root does not exist: ${root}`);
    }
    for (const file of collectFiles(absoluteRoot)) {
      violations.push(...scanFile(file, relative(baseDirectory, file)));
    }
  }

  return violations;
}

export function formatViolation(violation: Violation): string {
  const reason =
    violation.rule === 'pack-import'
      ? `imports a pack (${violation.term})`
      : `pack vocabulary '${violation.term}'`;
  return `${violation.file}:${violation.line}  ${reason}\n    ${violation.text}`;
}

function main(): void {
  const baseDirectory = process.cwd();
  let violations: Violation[];

  try {
    violations = scanRoots(DEFAULT_SCAN_ROOTS, baseDirectory);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  if (violations.length === 0) {
    process.stdout.write(
      `check:boundary — no pack identifiers in ${DEFAULT_SCAN_ROOTS.join(', ')}\n`,
    );
    return;
  }

  process.stderr.write(
    `check:boundary — ${violations.length} violation(s). The engine and the schema stay generic; ` +
      'this vocabulary belongs in packs/. See docs/development-standards.md §3.\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(`${formatViolation(violation)}\n\n`);
  }
  process.exit(1);
}

/**
 * Whether this module is the process entry point, decided by comparing canonical filesystem
 * paths.
 *
 * Two things make the naive comparisons wrong, and both fail the same way — `main()` is skipped,
 * nothing is scanned, and the process exits 0, which is indistinguishable from a pass:
 *
 * - `import.meta.url` is percent-encoded, so string-matching it against `process.argv[1]` misses
 *   any checkout path containing a space or a non-ASCII character.
 * - Node resolves a module URL through symlinks while `process.argv[1]` keeps the path as it was
 *   typed, so comparing merely-resolved paths misses a symlinked checkout — `/var` on macOS, or
 *   any working copy reached through a link.
 */
export function isProcessEntryPoint(moduleUrl: string, entryPoint: string | undefined): boolean {
  if (entryPoint === undefined) return false;

  const canonical = (path: string): string => {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  };

  return canonical(fileURLToPath(moduleUrl)) === canonical(entryPoint);
}

if (isProcessEntryPoint(import.meta.url, process.argv[1])) main();
