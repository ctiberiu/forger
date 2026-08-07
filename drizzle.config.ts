import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` reads only the schema, so an absent DATABASE_URL must not stop it.
// Commands that do connect fail on the empty string with their own message.
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
