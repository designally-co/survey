import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { checkSchema, expectedMigrationCount, type SchemaCheck } from '@/lib/schema-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/health — what is actually deployed, and can it reach what it needs.
 *
 * A change that is server-side only — a migration, an environment variable, a
 * container pointed at a new image — is invisible from outside the app, so "is
 * my fix live?" has no answer short of asking somebody to open the deployment
 * dashboard. This answers it: `commit` is the revision serving the request.
 *
 * Deliberately unauthenticated, because its whole job is to be reachable when
 * nobody can sign in, which is exactly when it is needed. It is therefore
 * careful about what it says. Configuration is reported as present/absent
 * booleans and never by value, and the database is proved with `select 1`
 * rather than by reading a row — a survey response is a client's words.
 */
type ProviderCheck = { ok: boolean | null; status?: number; ms?: number; note?: string };

let anthropicCache: { at: number; result: ProviderCheck } | null = null;
const CHECK_TTL_MS = 60_000;

/**
 * Whether the Anthropic key actually works, not merely whether it is set.
 *
 * A key can be present, correctly formatted, and revoked, and every analysis
 * then fails with a 401 that the browser reports as an anonymous server error.
 * `GET /v1/models` is the cheapest way to ask — it costs no tokens.
 *
 * Deliberately NOT part of `ok`. Analysis is one feature; collecting a client's
 * answers is the product, and it does not touch Anthropic. Reporting the whole
 * service unhealthy because a key went stale would cry wolf, and on a container
 * whose health check restarts nothing, it would only hide real faults.
 *
 * Cached for a minute: an unauthenticated route that makes an outbound call on
 * demand is something to point at other people's infrastructure.
 */
async function checkAnthropic(): Promise<ProviderCheck> {
  if (anthropicCache && Date.now() - anthropicCache.at < CHECK_TTL_MS) {
    return { ...anthropicCache.result, note: 'cached' };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, note: 'ANTHROPIC_API_KEY is not set' };

  const t0 = Date.now();
  let result: ProviderCheck;
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    result = { ok: res.ok, status: res.status, ms: Date.now() - t0 };
    if (res.status === 401) result.note = 'key rejected — revoked, deleted, or mistyped';
  } catch (error) {
    // Unreachable is not the same as invalid, and must not be reported as it.
    result = {
      ok: null,
      ms: Date.now() - t0,
      note: error instanceof Error ? `unreachable: ${error.name}` : 'unreachable',
    };
  }
  anthropicCache = { at: Date.now(), result };
  return result;
}

export async function GET() {
  const started = Date.now();

  // A container image carries its commit as APP_COMMIT_SHA, set by the
  // Dockerfile from a build argument; Vercel supplies its own.
  const commitSha = process.env.APP_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || undefined;

  // Presence only. Never the value, and never a length — a length is a hint.
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    AUTH_GOOGLE_ID: Boolean(process.env.AUTH_GOOGLE_ID),
    AUTH_GOOGLE_SECRET: Boolean(process.env.AUTH_GOOGLE_SECRET),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    // Without it the lapsed-survey endpoint answers 503 and nothing is analysed
    // on its own.
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
    // Behind a reverse proxy both of these have to be set explicitly: the
    // standalone server reports itself as 0.0.0.0:3000, so sign-in callbacks
    // and the survey links handed to clients would carry that address.
    AUTH_URL: Boolean(process.env.AUTH_URL),
    SURVEY_ORIGIN: Boolean(process.env.SURVEY_ORIGIN),
  };

  const [anthropic] = await Promise.all([checkAnthropic()]);

  let database: { ok: boolean; ms?: number; error?: string };
  let schema: SchemaCheck = { ok: null, expected: expectedMigrationCount, note: 'not checked' };
  try {
    const t0 = Date.now();
    const db = await getDb();
    await db.execute(sql`select 1`);
    database = { ok: true, ms: Date.now() - t0 };
    // Only worth asking once the connection is known good — otherwise it would
    // report a schema problem for what is really an unreachable database.
    schema = await checkSchema(db);
  } catch (error) {
    // The message, not the stack, and not the connection string it came from.
    database = { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : 'unknown' };
  }

  const missing = Object.entries(env)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  const body = {
    // `schema.ok === null` means the check could not be made, which is not the
    // same as the schema being wrong and must not be reported as it.
    ok:
      database.ok &&
      schema.ok !== false &&
      env.DATABASE_URL &&
      env.AUTH_SECRET &&
      env.AUTH_GOOGLE_ID &&
      env.AUTH_GOOGLE_SECRET,
    commit: commitSha?.slice(0, 7) ?? 'local',
    // The whole SHA as well, because a container image is tagged with it.
    commitSha: commitSha ?? null,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    database,
    schema,
    // Public already: it is the address in every survey link this app hands
    // out, and getting it wrong is the failure this reports.
    surveyOrigin: process.env.SURVEY_ORIGIN ?? null,
    anthropic,
    env,
    missing,
    tookMs: Date.now() - started,
  };

  return Response.json(body, {
    status: body.ok ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
