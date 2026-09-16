# lapsed-poker

Calls `GET /api/cron/lapsed` once a day, so a survey whose date has passed is
analysed without anybody pressing a button.

## Why it is needed

The endpoint does the work; something has to call it. Vercel's cron did that
while the app was hosted there (`vercel.json`), and that disappears when the app
moves to the NAS. This Worker replaces it, and calls the public hostname — so
it reaches whichever host is serving `survey.designally.co` at the time.

## Deploy

Two secrets, then ship it:

```bash
cd workers/lapsed-poker
wrangler login
wrangler deploy                      # creates the Worker
wrangler secret put LAPSED_URL       # https://survey.designally.co/api/cron/lapsed
wrangler secret put LAPSED_SECRET    # the same value as CRON_SECRET in the app
```

Deploy first so the Worker exists before secrets are attached to it, and run all
of it from this folder — wrangler reads `wrangler.toml` from the directory you
are standing in.

`workers_dev = false` is why it never asks to register a `*.workers.dev`
subdomain: this Worker serves no HTTP routes, so it needs no hostname.

**If the account has never had a workers.dev subdomain, the first deploy fails
with error 10063 — after uploading the script.** The Worker then appears in the
dashboard while the cron trigger silently does not. Register the subdomain once,
under Workers & Pages → the account → Subdomain, then run `wrangler deploy`
again. Confirm the trigger either in the deploy output or in the dashboard under
the Worker's Settings → Trigger events.

## Checking it

`wrangler tail` shows each day's reply. A quiet one looks like:

```
lapsed → {"ok":true,"written":[],"failed":[],"deferred":0}
```

`HTTP 401` means `LAPSED_SECRET` does not match the app's `CRON_SECRET`.
`HTTP 503` means the app has no `CRON_SECRET` set at all.

By hand, the same call is:

```bash
curl -s -H "authorization: Bearer $CRON_SECRET" https://survey.designally.co/api/cron/lapsed
```

That spends Anthropic credit when a survey is due, so on production it is a
deliberate, approved action rather than a test.

## One owner

Only one scheduler may call this endpoint in production. `vercel.json` still
carries the old daily cron; it is removed, or the Vercel project is
disconnected, at cutover — see `docs/deploy-nas.md`.
