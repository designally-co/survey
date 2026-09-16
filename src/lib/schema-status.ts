import 'server-only';
import { sql } from 'drizzle-orm';

import journal from '../../drizzle/meta/_journal.json';
import type { getDb } from '@/lib/db';

/**
 * Whether the database has the schema this build expects.
 *
 * `select 1` succeeds perfectly well against a database that is two migrations
 * behind the code querying it, so a health check that asks only "does the
 * database answer" reports green while every page that touches a new column
 * answers 500. Migrations here are applied as a deliberate step before a
 * release is pointed at (docs/deploy-nas.md), which is exactly the arrangement
 * where the two can drift apart.
 *
 * Counting applied migrations against the number this build ships catches it,
 * and costs one cheap query.
 */
export type SchemaCheck = {
  ok: boolean | null;
  applied?: number;
  expected: number;
  pending?: string[];
  note?: string;
};

/** How many migrations this build ships. */
export const expectedMigrationCount = journal.entries.length;

export async function checkSchema(db: Awaited<ReturnType<typeof getDb>>): Promise<SchemaCheck> {
  const expected = expectedMigrationCount;
  try {
    const result = await db.execute(
      sql`select count(*)::int as applied from drizzle."__drizzle_migrations"`,
    );
    // postgres-js returns the rows directly; PGlite wraps them in `.rows`.
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows) ?? [];
    const applied = Number((rows[0] as { applied?: number } | undefined)?.applied ?? 0);
    if (applied >= expected) return { ok: true, applied, expected };
    return {
      ok: false,
      applied,
      expected,
      // Named, so the fix is "apply these" rather than "work out which".
      pending: journal.entries.slice(applied).map((entry) => entry.tag),
      note: 'The database is behind this build. Apply the migrations before serving traffic.',
    };
  } catch (error) {
    // A missing bookkeeping table means no migration has ever been applied
    // here, which is its own answer. Anything else is unknown, not unhealthy.
    const message = error instanceof Error ? error.message : 'unknown';
    return /__drizzle_migrations|does not exist/i.test(message)
      ? { ok: false, expected, note: 'No migrations have been applied to this database.' }
      : { ok: null, expected, note: `could not be checked: ${message.slice(0, 120)}` };
  }
}
