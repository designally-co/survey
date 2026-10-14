/**
 * Apply drizzle/*.sql to DATABASE_URL, and nothing else.
 *
 * `scripts/migrate.ts` is the one to run on a laptop: it goes through
 * `src/lib/db`, so it migrates the local PGlite database when DATABASE_URL is
 * unset, and it needs tsx. This one is for a release. It ships inside the
 * container image, imports only `postgres` and the drizzle migrator, and runs
 * under plain Node — so a release is migrated by the same immutable image that
 * serves it, as a deliberate step rather than something a container does on
 * its way up.
 *
 * Usage inside the image:
 *   node --experimental-strip-types scripts/migrate-deploy.ts
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. This applies migrations to a real database only.');
  process.exit(1);
}

// One connection, no prepared statements: the same shape the app uses against
// a pooler, and a migration is a single serial job.
const client = postgres(url, { prepare: false, max: 1 });
const db = drizzle(client);

/**
 * The migrations' bookkeeping lives in the schema `survey`, beside the tables
 * (decisions/tables-in-schema-survey.md). Until migration 0004 it lived in
 * Drizzle's default schema, `drizzle`. A database migrated before then has its
 * history there and none in `survey`, and the migrator would read "nothing
 * applied" and run 0000 again over tables that exist. So, once, the history is
 * copied across, timestamps included: Drizzle runs every migration newer than
 * the last recorded one, so with the copy it runs only what is really new. The
 * old table is left in place, untouched. Only the survey's own old layout is
 * adopted (its tables still in public): in a shared database another app's
 * drizzle history must never be, and that schema may not even be readable,
 * which is why the old table is looked up in the catalog. Keep this identical
 * in scripts/migrate.ts and scripts/migrate-deploy.ts (the release image ships
 * the second on its own).
 */
await client.unsafe(`DO $adopt$
BEGIN
  IF to_regclass('survey.__drizzle_migrations') IS NULL
     AND to_regclass('public.question_blocks') IS NOT NULL
     AND EXISTS (SELECT FROM pg_catalog.pg_class c
                 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'drizzle' AND c.relname = '__drizzle_migrations') THEN
    CREATE SCHEMA IF NOT EXISTS survey;
    CREATE TABLE survey.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
    INSERT INTO survey.__drizzle_migrations (hash, created_at)
      SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;
  END IF;
END $adopt$`);

await migrate(db, { migrationsFolder: 'drizzle', migrationsSchema: 'survey' });
await client.end();
console.log('Migrations applied.');
