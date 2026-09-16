# The Survey platform on the Designally NAS

How this app moves from Vercel to the Designally NAS — Portainer, Caddy, images
from GHCR — and changes its public name to `survey.designally.co`. It follows
the same shape as Article Studio, which moved on 15 September 2026.

**This document and the pull request that adds it change nothing in production.**
Each step marked **Ake approves** is a gate from the infrastructure runbook:
deploying, DNS or Caddy, Portainer access, database moves, entering or rotating
secrets, calling the production cron, and deleting or resetting data.

No value of any secret appears here, and none may be added: not in this file,
the compose file, a pull request, a ticket or a chat.

---

## 1. What runs where

| Part | Today | After cutover |
|---|---|---|
| App | Vercel | Container `survey` on the NAS, behind Caddy on `caddy_default` |
| Public URL | `https://s.designally.co` | `https://survey.designally.co` |
| Old survey links | `https://s.designally.co/s/<token>` | Still work: Caddy keeps answering there and sends them to the new name, same path and token |
| Database | Neon Postgres, 4 migrations | Unchanged. Runtime-only move (see §9) |
| Analysis | Anthropic API | Unchanged |
| Lapsed-survey schedule | Vercel cron, daily 01:00 UTC | Cloudflare Worker `lapsed-poker`, daily 01:00 UTC |
| Sign-in | Google OAuth, designally.co only | Same, with the new callback registered (see §7) |

**Two name changes, and why they are separable.** The host moves (Vercel → NAS)
and the name changes (`s` → `survey`). Doing them together is fine because
nothing about a token depends on the name: a survey link is a row, and
`SURVEY_ORIGIN` decides only what the team copies out of the app from now on.
Links already with clients keep working because `s.designally.co` keeps
answering.

**The team app's address changes too.** Today the team app is reached at the
Vercel project's own domain, with `s.designally.co` as a second hostname on the
same project. On the NAS there is one app behind one name, so the team app is
at `https://survey.designally.co` — signed in, as it already is. Bookmarks to
the `.vercel.app` address stop working when the project is retired.

---

## 2. The image

`ghcr.io/designally-co/survey:sha-<full 40-character commit>`, linux/amd64. Built by [`.github/workflows/release.yml`](../.github/workflows/release.yml).

**On every pull request** the workflow runs lint (reported, not enforced — see
the note in the workflow), the production build and the type check. It then
builds the image and checks it:

- the image is `linux/amd64` and has a `HEALTHCHECK`;
- no credential-shaped string is in its layer history;
- `scripts/migrate-deploy.ts`, run inside the image, applies every migration to
  a throwaway Postgres 17;
- the server starts against that database, and `/api/health` reports the built
  commit, the database answering and every migration applied;
- a public survey URL is served rather than crashing.

Nothing is pushed.

**To release**, tag a commit that is already on `main`:

```bash
git tag release-2026-09-20 <full commit>
```

```bash
git push origin release-2026-09-20
```

The same checks run, and the exact image that passed is pushed as
`sha-<commit>`. The run summary records the image, its digest and the commit:
that is the release evidence. There is no `latest` tag, and the publish job
refuses a commit that is not on `main`.

**What changed in the app to make this possible**

- `next.config.ts` now builds `output: 'standalone'`, which is what the image runs.
- `scripts/migrate-deploy.ts` applies migrations with plain Node, so the release
  image can migrate without `tsx` or the app's own database module.
- `/api/health` is new: revision, database, migration state and configuration
  presence, with no secret values.

---

## 3. The stack and the route

[`deploy/compose.production.yml`](../deploy/compose.production.yml):

- container `survey`, `restart: unless-stopped`;
- no published ports, attached to the external `caddy_default` network;
- `AUTH_URL` and `SURVEY_ORIGIN` set to `https://survey.designally.co`;
- the runbook's health check;
- logs capped at 3 × 10 MB.

Every secret value comes from Portainer stack variables. A required variable
that is missing stops the stack from starting.

Caddy, added at the end of the Caddyfile on the NAS:

```
survey.designally.co {
	reverse_proxy survey:3000
}

s.designally.co {
	redir https://survey.designally.co{uri} 302
}
```

**Both blocks matter.** The first is the app. The second keeps every link
already sent to a client working: `{uri}` carries the path, so
`s.designally.co/s/<token>` lands on `survey.designally.co/s/<token>` with the
same token.

**302, not 301.** A permanent redirect is cached by browsers, which would make
a rollback to Vercel invisible to anyone who had followed one. Change it to
`permanent` once the migration is closed and the old name is retired for good.

The Caddyfile is mounted read-only into the Caddy container, so it is edited on
the NAS itself. Apply it with `caddy validate` then `caddy reload` — never a
restart, which would interrupt every other site.

---

## 4. Runtime variables

Names only. Values are entered in Portainer, copied from the current Vercel
production environment. They never pass through Git, tickets or chat.

| Name | Required | Notes |
|---|---|---|
| `IMAGE_TAG` | yes | `sha-<full commit>` from the release run summary. |
| `DATABASE_URL` | yes | Neon, the **pooled** connection string. |
| `AUTH_SECRET` | yes | **Copy the exact value.** A different one signs everybody out. |
| `AUTH_GOOGLE_ID` | yes | The existing OAuth client. |
| `AUTH_GOOGLE_SECRET` | yes | The existing OAuth client. |
| `ANTHROPIC_API_KEY` | yes | Analysis. Reported by `/api/health`, but a bad key does not make the container unhealthy. |
| `CRON_SECRET` | yes | **Copy the exact value.** It must equal the Worker's `LAPSED_SECRET`, or every call answers 401. |

The stack sets these itself: `NODE_ENV=production`, `HOSTNAME=0.0.0.0`,
`PORT=3000`, `AUTH_URL=https://survey.designally.co` and
`SURVEY_ORIGIN=https://survey.designally.co`. The image sets `APP_COMMIT_SHA`.

**Check before cutover whether each Vercel value can still be revealed.** A
value marked Sensitive there cannot be read back. That is what happened with
Article Studio's database URL, and the password had to be reset mid-migration.
If `AUTH_SECRET` cannot be recovered, everyone is signed out once, which is
survivable; the others each have their own replacement path. Never reset the
Neon password while Vercel is still serving.

---

## 5. Migrations

The container never migrates on start; the app has no start-up migration at
all. Migrations are a one-off command, run with the release's own image:

```bash
docker run --rm --env DATABASE_URL ghcr.io/designally-co/survey:sha-<full commit> node --experimental-strip-types scripts/migrate-deploy.ts
```

`--env DATABASE_URL`, with no `=`, passes the value from the environment it is
run in, so the connection string never appears on a command line or in shell
history.

**Ake approves** each run against production. Before it: a verified backup, and
the migration count from `/api/health` (`schema.applied`). After it,
`schema.applied` must equal `schema.expected`. This pull request adds no
migrations; production has 4.

Vercel deploys from `main` today and applies nothing — this app has never
migrated on deploy — so there is no second owner to switch off.

---

## 6. The scheduler

`GET /api/cron/lapsed` writes the analysis for a survey whose date has passed.
It refuses without `CRON_SECRET`, and 401s on a wrong one.

- **Today:** Vercel cron, daily at 01:00 UTC (`vercel.json`).
- **After cutover:** the Cloudflare Worker in
  [`workers/lapsed-poker`](../workers/lapsed-poker), on the same schedule,
  calling `https://survey.designally.co/api/cron/lapsed`. Its README has the
  deploy steps.
- **Only one owner.** At cutover, remove the `crons` entry from `vercel.json`
  or disconnect the Vercel project, so the two cannot both run. The endpoint is
  idempotent — it only writes an analysis where there is none — but two
  schedulers could still start two runs of the same survey at once.
- **Do not call it by hand on production without approval.** It spends
  Anthropic credit.

The NAS has no function time limit, so the 300-second ceiling the route was
written against no longer applies. It is left alone: the route's own
`START_UNTIL_MS` budget stops it starting work it cannot finish, which is still
the behaviour we want.

---

## 7. Sign-in and survey links

- **OAuth callback:** `https://survey.designally.co/api/auth/callback/google`.
  **Add it to the Google OAuth client before cutover**, in Google Cloud Console
  → Credentials → the client → Authorised redirect URIs. Google refuses any
  callback it does not know, and today's list will not have this name. Adding
  one is additive and safe: leave the existing entries in place until the
  Vercel project is retired, so rollback still signs in.
- **`AUTH_URL` is required, and the stack sets it.** Without it, sign-in breaks
  behind Caddy: the standalone server reports its own address as
  `0.0.0.0:3000`, and Auth.js builds the Google callback from that despite
  `trustHost: true`. Google then refuses. This is not theoretical — it happened
  at Article Studio's cutover.
- **`SURVEY_ORIGIN` is required for the same reason**, and it is also what
  makes new links say `survey.designally.co`. `surveyOrigin()` otherwise falls
  back to the forwarded host, and a link built from `0.0.0.0:3000` would be
  copied into a message to a client.

Check both without signing in:

- `GET /api/auth/providers` → `callbackUrl` must be on `https://survey.designally.co`.
- `/api/health` → `surveyOrigin` must be `https://survey.designally.co`.

---

## 8. Cutover, proposed

Each step waits for the one before it.

1. Merge this pull request. Vercel stays production.
2. Tag a release (§2). Record the image, digest and commit.
3. Add the new OAuth callback (§7).
4. Record the counts the smoke suite compares against (§10), while Vercel is
   still serving.
5. **Ake approves:** create the Portainer stack with `IMAGE_TAG` and the §4
   variables. Record the rollback point: the current Vercel deployment and its
   commit, and the current DNS target for `s.designally.co`.
6. Start the stack. Check health inside the NAS, before any traffic:

   ```bash
   docker exec survey wget -qO- http://127.0.0.1:3000/api/health
   ```

   Expect `ok: true`, `commitSha` equal to the release commit, `schema.applied`
   = `schema.expected` = 4, and `surveyOrigin` `https://survey.designally.co`.
7. **Ake approves:** the Caddy blocks (§3), then DNS:
   - **create** `survey.designally.co` → the NAS (CNAME, DNS only, like `app`
     and `article-studio`);
   - **move** `s.designally.co` from Vercel to the NAS, so old links reach the
     redirect.

   Caddy issues a certificate for each name on its first visit.
8. Check the public site: `/api/health` shows the release commit, an existing
   survey link on the **old** name redirects and opens, a link on the new name
   opens, and sign-in returns to the right place.
9. Deploy the `lapsed-poker` Worker and remove the Vercel cron (§6).
10. Run the smoke suite (§10).
11. The agreed observation window, with the Vercel project kept.

---

## 8a. Vercel afterwards: the internal clone

Vercel is kept, not deleted. It has two jobs, and they do not overlap in time.

**During the migration it is the rollback.** That means it stays as it is: the
production database, cron off, and no deploys landing on it. A rollback is then
one DNS change away.

**After sign-off it becomes a clone** — a running copy of the app to try things
on. Converting it is four settings, and each one exists to stop the clone
touching anything real:

| | Clone |
|---|---|
| Address | the `*.vercel.app` one only; the public names stay on the NAS |
| Database | **its own.** A Neon branch is the cheap way here: same schema, separate data |
| Cron | **off.** Two schedulers on one database is a stop condition, and a clone must not analyse real surveys |
| Deploys | from `main`, which is what makes it a clone worth having |
| Access | Vercel's deployment protection on, so it is not a second public copy |

Branch previews stay off (`git.deploymentEnabled` in `vercel.json`): they never
had the Google credentials to build, and the clone is `main`. That keeps a
merge deploying the clone while a pull request does not.

**Do not convert it before Ake signs off**, because the day it points at a
clone database it stops being a rollback.

This app never migrates on deploy, so a Vercel deploy cannot change any schema.
(Article Studio does, and that step has to go when its own Vercel project
becomes a clone.)

---

## 9. Database

Neon stays where it is, and nothing about it changes in this migration: same
project, same pooled connection string, same 4 migrations. The runbook prefers
a runtime-only move — changing the host and the database at once doubles what a
rollback has to undo.

If Designally later wants Supabase, that is its own rehearsed release, to an
**isolated project**: Article Studio and this app both define unqualified
`users` and `projects` tables, so they must never share one `public` schema.

What must survive the move, unchanged: public survey tokens and their links,
clients, projects, surveys and questions, responses and answers, drafts,
insights and decisions, who did what, and all timestamps. Since no data moves,
the check is simply that counts before and after match (§10).

---

## 10. Acceptance

The runbook's smoke suite:

- open an existing public survey token — on the **old** name, which must
  redirect, and on the new one;
- submit one controlled response, exactly once;
- resume a saved draft;
- sign in as the team;
- edit a non-critical test survey;
- confirm response and answer counts match the ones recorded before cutover;
- run the lapsed job once and confirm a second run does nothing (**Ake
  approves**, since it spends credit);
- `/api/health` shows the release commit and 4 of 4 migrations.

Record counts **before** the DNS change, so "match" means something.

---

## 11. Open decisions

- [ ] Which Vercel values can still be revealed, and the replacement plan for
      any that cannot.
- [ ] Who enters them in Portainer, and how they get there without passing
      through chat or tickets.
- [ ] How long `s.designally.co` keeps answering. It costs nothing to keep the
      redirect indefinitely, and switching it off breaks every link already
      sent to a client.
- [ ] A memory limit for the container on the 4 GB host: Article Studio idles
      at about 67 MB with no limit set.
- [ ] Whether GHCR access already covers this repo's package, or a registry
      credential is needed.
- [ ] Neon: stay, or plan a separate move to an isolated Supabase project.
- [ ] The maintenance window and the rollback deadline. The Vercel project is
      kept rather than deleted: after sign-off it becomes the internal clone
      (§8a), and which database it then points at is the decision to make.
- [ ] The five pre-existing lint errors, fixed in their own pull request, after
      which the workflow's `continue-on-error` comes off.
