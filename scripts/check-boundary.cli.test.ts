import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { FIXTURE_TREES, materialiseFixtureTree } from './__fixtures__/boundary-fixtures';
import type { FixtureTree } from './__fixtures__/boundary-fixtures';

/**
 * Runs the guard the way CI runs it — as a process, asserting the exit code. The library-level
 * suite next door calls scanRoots directly and passes even when the CLI never executes its own
 * main(), which is how a gate that failed open on any checkout path containing a space survived
 * a green build.
 */

const guardSource = fileURLToPath(new URL('./check-boundary.ts', import.meta.url));

const temporaryDirectories: string[] = [];

interface GuardRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Copies the guard into a checkout directory of the given name and runs it there. The name is the
 * variable under test: it becomes part of `process.argv[1]`, which is what the entry-point check
 * compares against.
 */
function prepareCheckout(checkoutName: string, tree: FixtureTree): string {
  const root = mkdtempSync(join(tmpdir(), 'postforge-cli-'));
  temporaryDirectories.push(root);

  const checkout = join(root, checkoutName);
  mkdirSync(join(checkout, 'scripts'), { recursive: true });
  cpSync(guardSource, join(checkout, 'scripts', 'check-boundary.ts'));
  materialiseFixtureTree(tree, checkout);

  return checkout;
}

function spawnGuard(checkout: string): GuardRun {
  const result = spawnSync(
    process.execPath,
    [
      '--disable-warning=ExperimentalWarning',
      '--experimental-strip-types',
      join(checkout, 'scripts', 'check-boundary.ts'),
    ],
    { cwd: checkout, encoding: 'utf8' },
  );

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runGuardIn(checkoutName: string, tree: FixtureTree): GuardRun {
  return spawnGuard(prepareCheckout(checkoutName, tree));
}

/**
 * Reaches the same checkout through a symlink the test creates itself.
 *
 * The symlink is deliberate rather than inherited: on macOS `os.tmpdir()` is already a symlink
 * (`/var` → `/private/var`) and on Linux it is not, so a test relying on the platform's temp
 * directory exercises this on one machine and silently skips it on the runner — which is the
 * shape of bug this whole file exists to prevent.
 */
function runGuardThroughSymlinkTo(checkoutName: string, tree: FixtureTree): GuardRun {
  const checkout = prepareCheckout(checkoutName, tree);
  const linked = join(dirname(checkout), 'linked-checkout');
  symlinkSync(checkout, linked, 'dir');

  return spawnGuard(linked);
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  }
});

describe('pnpm check:boundary, run as a process', () => {
  it('exits 1 and names the file when the checkout path is plain ASCII', () => {
    const run = runGuardIn('probe_nospace', FIXTURE_TREES.cliLeak);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('leak.ts');
    expect(run.stderr).toContain('3 violation(s)');
  });

  it('exits 1 when the checkout path contains a space', () => {
    const run = runGuardIn('probe space', FIXTURE_TREES.cliLeak);

    expect(run.status).toBe(1);
    expect(run.stderr).not.toBe('');
    expect(run.stderr).toContain('leak.ts');
  });

  it('exits 1 when the checkout path contains a non-ASCII character', () => {
    const run = runGuardIn('dévplace', FIXTURE_TREES.cliLeak);

    expect(run.status).toBe(1);
    expect(run.stderr).not.toBe('');
    expect(run.stderr).toContain('leak.ts');
  });

  it('reports the same violations regardless of what the checkout is called', () => {
    const ascii = runGuardIn('probe_nospace', FIXTURE_TREES.cliLeak);
    const spaced = runGuardIn('probe space', FIXTURE_TREES.cliLeak);
    const accented = runGuardIn('dévplace', FIXTURE_TREES.cliLeak);

    const violationCount = (stderr: string) => stderr.match(/pack vocabulary/g)?.length ?? 0;

    expect(violationCount(ascii.stderr)).toBe(3);
    expect(violationCount(spaced.stderr)).toBe(violationCount(ascii.stderr));
    expect(violationCount(accented.stderr)).toBe(violationCount(ascii.stderr));
  });

  it('exits 1 when the checkout is reached through a symlink', () => {
    const run = runGuardThroughSymlinkTo('probe_symlinked', FIXTURE_TREES.cliLeak);

    expect(run.status).toBe(1);
    expect(run.stderr).not.toBe('');
    expect(run.stderr).toContain('leak.ts');
  });

  it('exits 1 through a symlink whose target path also contains a space', () => {
    const run = runGuardThroughSymlinkTo('probe space', FIXTURE_TREES.cliLeak);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('3 violation(s)');
  });

  it('exits 0 on a clean tree, including from a path containing a space', () => {
    const run = runGuardIn('probe space', FIXTURE_TREES.cliClean);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('no pack identifiers');
  });
});
