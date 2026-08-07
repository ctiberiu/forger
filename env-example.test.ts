import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

/**
 * docs/setup.md is the declared source of truth for variable names
 * (docs/development-standards.md §7); .env.example must mirror it exactly.
 */
function documentedVariableNames(): string[] {
  const setupDoc = read('./docs/setup.md');
  const table = setupDoc.split('## Environment variables')[1]?.split('\n## ')[0] ?? '';
  const names = table.match(/`[A-Z][A-Z0-9_]*`/g) ?? [];
  return [...new Set(names.map((name) => name.replaceAll('`', '')))].sort();
}

function declaredVariableNames(): string[] {
  const lines = read('./.env.example').split('\n');
  const names = lines
    .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
  return [...new Set(names)].sort();
}

describe('.env.example', () => {
  it('declares every variable documented in docs/setup.md', () => {
    const documented = documentedVariableNames();

    expect(documented.length).toBeGreaterThan(0);
    expect(declaredVariableNames()).toEqual(documented);
  });

  it('carries no values', () => {
    const assignments = read('./.env.example')
      .split('\n')
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line));

    expect(assignments.every((line) => line.endsWith('='))).toBe(true);
  });
});
