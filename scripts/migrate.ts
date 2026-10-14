/**
 * Applies drizzle/*.sql to whichever database src/lib/db resolved —
 * Neon when DATABASE_URL is set, PGlite otherwise.
 *
 * For a release, `scripts/migrate-deploy.ts` is the one to run: it ships inside
 * the container image and needs neither tsx nor this app's database module.
 */
import { sql } from 'drizzle-orm';

import { getDb, usingLocalDatabase } from '../src/lib/db';

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
const ADOPT_LEGACY_BOOKKEEPING = `DO $adopt$
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
END $adopt$`;

const migrationConfig = { migrationsFolder: './drizzle', migrationsSchema: 'survey' };

async function main() {
  const db = await getDb();
  await db.execute(sql.raw(ADOPT_LEGACY_BOOKKEEPING));

  if (usingLocalDatabase()) {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, migrationConfig);
  } else {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, migrationConfig);
  }

  console.log(
    `Migrations applied to ${usingLocalDatabase() ? 'local PGlite (.pglite)' : 'DATABASE_URL'}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
