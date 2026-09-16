/**
 * Ask the app once a day whether any survey has lapsed.
 *
 * The endpoint decides everything itself: which surveys are past their date,
 * have answers, and have no analysis yet. This knows nothing except the URL,
 * which is what keeps the two independent — the schedule can move without the
 * app changing, and the rules can change without the schedule knowing.
 */
export interface Env {
  /** https://survey.designally.co/api/cron/lapsed */
  LAPSED_URL: string;
  /** The same value as CRON_SECRET in the app's environment. */
  LAPSED_SECRET: string;
}

type Ctx = { waitUntil(promise: Promise<unknown>): void };

const worker = {
  async scheduled(_event: unknown, env: Env, ctx: Ctx): Promise<void> {
    if (!env.LAPSED_URL || !env.LAPSED_SECRET) {
      console.error('LAPSED_URL or LAPSED_SECRET is not set — nothing to poke.');
      return;
    }

    /* Held open with waitUntil rather than left to chance: a run writes an
       analysis and can take minutes, and the reply is the only place the
       outcome is visible. Read it with `wrangler tail`. */
    ctx.waitUntil(
      (async () => {
        try {
          const response = await fetch(env.LAPSED_URL, {
            headers: { authorization: `Bearer ${env.LAPSED_SECRET}` },
          });
          const body = await response.text();
          /* A failure is logged, not retried. The next trigger is a day away
             and the endpoint is idempotent; a retry here would risk starting a
             second analysis of the same survey while the first is in flight. */
          if (!response.ok) {
            console.error(`lapsed → HTTP ${response.status} ${body.slice(0, 300)}`);
            return;
          }
          console.log(`lapsed → ${body.slice(0, 300)}`);
        } catch (cause) {
          console.error('lapsed → request failed', cause);
        }
      })(),
    );
  },
};

export default worker;
