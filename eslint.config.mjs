import next from 'eslint-config-next';
import nextTypeScript from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

/**
 * Layer rules mirror docs/development-standards.md §1 and §3. They are the import half of the
 * engine/pack boundary; the CI grep guard is the other half and catches vocabulary — a pack
 * word in a column name is invisible to any import rule.
 *
 * The pack-import rule is deliberately enforced by both halves. That is not redundancy worth
 * cleaning up: one `// eslint-disable-next-line` silences a zone in a single plausible-looking
 * line, and silences nothing in the grep. Cheap check fails fast in the editor; stubborn check
 * cannot be waived.
 */
const layerBoundaries = [
  {
    name: 'postforge/engine-imports-downward-only',
    files: ['lib/engine/**/*.ts', 'lib/engine/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/packs/*', '**/packs/*', '@/app/*', '**/app/*'],
              message:
                'The engine is generic: a pack or a route is resolved through configuration at runtime, never imported. See docs/development-standards.md §3.',
            },
            {
              group: ['next', 'next/*'],
              message:
                'The engine must stay free of request objects, headers() and route context. Keep Next.js in app/. See docs/development-standards.md §3.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'postforge/packs-are-data-and-presentation',
    files: ['packs/**/*.ts', 'packs/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/db/*', '**/lib/db/*', '@/app/*', '**/app/*'],
              message:
                'A pack never reaches the database or a route: it is layouts, tokens, copy and seed rows. See docs/development-standards.md §3.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'postforge/db-is-the-bottom-layer',
    files: ['lib/db/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/engine/*', '@/packs/*', '@/app/*', 'next', 'next/*'],
              message:
                'lib/db/ returns rows; it decides nothing and sits below every other layer. See docs/development-standards.md §3.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'postforge/app-goes-through-the-engine',
    files: ['app/**/*.ts', 'app/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/db/*', '**/lib/db/*'],
              message:
                'Routes and screens read through lib/engine/, which owns the rules. See docs/development-standards.md §1.',
            },
          ],
        },
      ],
    },
  },
];

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
  ...nextTypeScript,
  ...tseslint.configs.recommended,
  ...layerBoundaries,
  {
    name: 'postforge/typescript',
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
