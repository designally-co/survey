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

await migrate(db, { migrationsFolder: 'drizzle' });
await client.end();
console.log('Migrations applied.');
