import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

// Run by `pnpm db:migrate` through Node's type stripping, so this file imports no local .ts
// module: under --experimental-strip-types those specifiers would need explicit extensions.

const connectionString = process.env.DATABASE_URL;

if (connectionString === undefined || connectionString === '') {
  throw new Error(
    'DATABASE_URL is not set. Run `vercel env pull .env.local` first — see docs/setup.md.',
  );
}

await migrate(drizzle(neon(connectionString)), {
  migrationsFolder: './lib/db/migrations',
});

console.log('Migrations applied.');
