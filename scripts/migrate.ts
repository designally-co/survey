/**
 * Applies drizzle/*.sql to whichever database src/lib/db resolved —
 * Neon when DATABASE_URL is set, PGlite otherwise.
 *
 * For a release, `scripts/migrate-deploy.ts` is the one to run: it ships inside
 * the container image and needs neither tsx nor this app's database module.
 */
import { getDb, usingLocalDatabase } from '../src/lib/db';

async function main() {
  const db = await getDb();

  if (usingLocalDatabase()) {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: './drizzle' });
  } else {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: './drizzle' });
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
