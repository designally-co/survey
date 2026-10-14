import type { Config } from 'drizzle-kit';

/**
 * Only ever used for `drizzle-kit generate`, which reads the schema and writes
 * SQL without connecting. Migrations are applied by `npm run db:migrate`, which
 * uses whichever driver src/lib/db is configured for.
 */
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Every table and the migrations' history are in the schema `survey`
  // (decisions/tables-in-schema-survey.md).
  schemaFilter: ['survey'],
  migrations: { schema: 'survey' },
} satisfies Config;
