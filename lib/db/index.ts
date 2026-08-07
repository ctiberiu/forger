import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export * from './schema';

export type Database = ReturnType<typeof createDatabase>;

function createDatabase(connectionString: string) {
  return drizzle(neon(connectionString), { schema, casing: 'snake_case' });
}

let database: Database | undefined;

/**
 * Resolved on first use rather than at import time: a route or a test may load this module in an
 * environment that has no database, and only the caller that actually queries should fail.
 */
export function getDatabase(): Database {
  if (database !== undefined) {
    return database;
  }

  const connectionString = process.env.DATABASE_URL;

  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL is not set. See docs/setup.md.');
  }

  database = createDatabase(connectionString);
  return database;
}
