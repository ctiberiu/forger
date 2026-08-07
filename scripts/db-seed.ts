import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { packRadarRegistration } from '../packs/packradar/pack.config.ts';
import { seedWorkspace } from '../lib/db/seed.ts';
import type { PackRegistration } from '../lib/db/seed.ts';

/**
 * The composition root: the only place that knows both which pack is installed and how to reach
 * the database. It sits above every layer precisely so that neither has to import the other —
 * `lib/db/` may not import a pack, and a pack may not import `lib/db/`.
 *
 * The annotation below is where the pack's shape is checked against the contract. If a pack
 * stops satisfying `PackRegistration`, this line fails to compile rather than the seed failing
 * at runtime against a live database.
 */
const registration: PackRegistration = packRadarRegistration;

const connectionString = process.env.DATABASE_URL;

if (connectionString === undefined || connectionString === '') {
  throw new Error(
    'DATABASE_URL is not set. Run `vercel env pull .env.local` first — see docs/setup.md.',
  );
}

const outcome = await seedWorkspace(drizzle(neon(connectionString)), registration);

console.log(
  `Seeded pack '${registration.key}': workspace ${outcome.workspaceId} ` +
    `(${outcome.createdWorkspace ? 'created' : 'already present'}), ` +
    `${registration.account.platform} account ${outcome.socialAccountId} ` +
    `(${outcome.createdSocialAccount ? 'created' : 'already present'}).`,
);
