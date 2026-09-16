# Designally Platform

Internal tool replacing the manual work between a signed deal and a kick-off meeting.
Clients answer branded bilingual questionnaires; the platform collects however many
responses arrive, finds where stakeholders disagree, and produces one confirmed page
that drives the kick-off.

Two packages: **Brand** (Brand Strategy + Brand Identity, 23 questions) and **Design**
(13 questions). A client buys one or the other.

## Read these first, in this order

1. **`PRODUCT.md`** — who it is for, what it does, the design principles
2. **`DESIGN.md`** — the complete design system, derived from Apple's
3. **`CLAUDE.md`** — stack, rules that must not be broken, data model, milestones
4. **`docs/first-session-brief.md`** — the build plan with copy-paste prompts

## What is already decided

| | |
|---|---|
| Stack | Next.js 14 App Router · TypeScript · Tailwind · Drizzle |
| Database | Neon Postgres |
| Login | Google OAuth, designally.co only |
| Survey links | `s.designally.co/s/<token>` |
| Hosting | Vercel |
| Analysis | Anthropic API, server-side |

## What is not decided

- Anthropic API account and key. Not needed until milestone 3.

## Repository contents

```
CLAUDE.md                    instructions Claude Code reads every session
PRODUCT.md                   product context
DESIGN.md                    the design system
docs/
  first-session-brief.md     build plan and milestone prompts
  complete-flow.md           every step, and who owns it
  insight-engine-spec.md     what the analysis produces — and never produces
  questionnaire-architecture.md  shared question blocks, not separate templates
  team-workflow-after-survey.md  what the team does after answers arrive
  navigation-decisions.md    why the navigation is what it is
reference/
  designally-app.html        the working prototype — port from this, don't redesign
  brief-one-page.html        the brief format, built from real ARUN+ data
  flow-map.html              the flow as a diagram
seed/
  question-blocks.json       the version-2 questionnaire, bilingual, ready to import
```

## The eight rules

These are product decisions, not preferences.

1. Nothing happens on a timer — no auto-close, no auto-archive
2. Four human gates, each recording who acted: close · confirm · record decisions · archive
3. No expected respondent count, ever. "3 answers so far", never "2 of 4"
4. No estimated content volume, client-facing or internal
5. Questions are versioned — a sent survey keeps the version it was sent with
6. Nothing reaches a client before a human confirms
7. No percentages or sentiment scores — "2 of 3" is honest
8. Internal facilitation notes never render on a client-facing surface

## Running it

```bash
npm install && npm run db:migrate && npm run db:seed && npm run dev
```

Open http://localhost:3000. Without a Google OAuth client configured, the sign-in page offers a
development sign-in instead — any `@designally.co` address, no password. It is not built into a
production bundle and still refuses every other domain.

| Command | |
|---|---|
| `npm run dev` | the app on http://localhost:3000 |
| `npm run db:migrate` | apply `drizzle/*.sql` |
| `npm run db:seed` | import `seed/question-blocks.json` (plus an example survey, on the local database only) |
| `npm run db:inspect` | print what a survey has collected |
| `npm run db:reset` | throw the local database away and rebuild it |
| `npm run db:clear` | inventory the client data and retired question versions — deletes nothing |
| `npm run db:clear -- --delete` | actually delete them. Against a real database it also needs `CONFIRM=yes` |
| `npm run db:generate` | regenerate SQL after a schema change |
| `npm run dev:fixture` | write a synthetic five-respondent survey with deliberately planted findings |
| `npm run dev:analyse` | run the real analysis against it and print the brief — no team app, nothing stored |
| `npm run dev:backdate -- <token> <days>` | move a survey back in time, to see the quiet-survey prompt without waiting five days |

**The database.** With `DATABASE_URL` set, everything runs on Neon Postgres through postgres-js — that is what Vercel runs. Without it, the app falls back to [PGlite](https://pglite.dev), real Postgres compiled to WASM, kept in `.pglite/`. Same schema, same migrations, no credentials needed to work on the survey. In production the fallback is refused outright: a serverless instance's `.pglite/` is discarded with the instance, and a client's answers would go nowhere.

Neon gives you two connection strings for the same database:

| For | Which | Host |
|---|---|---|
| The app, on Vercel | **Pooled** | contains `-pooler` |
| `db:migrate` and `db:seed` from a laptop | **Direct** | no `-pooler` |

The pooler runs in transaction mode, which is why `postgres-js` is configured with `prepare: false` and why migrations use the direct string instead.

Two things to know about the local fallback. It takes **one process at a time**, so stop the dev server before `db:inspect` or `db:seed`. And it is **disposable**: `Ctrl+C` shuts it down cleanly, but a hard kill leaves an unrecoverable checkpoint — run `npm run db:reset` and carry on.

## Domains

Two hostnames, one Vercel project.

| Host | Serves | Who sees it |
|---|---|---|
| `s.designally.co` | client questionnaires at `/s/<token>` | clients, no login |
| the Vercel project domain | the team app | Designally staff, behind Google OAuth |

`s.designally.co` is a **CNAME to Vercel**. The main site is WordPress and is never in the path —
see `CLAUDE.md` for why proxying `/s/*` through it was rejected.

Set `SURVEY_ORIGIN=https://s.designally.co` in Vercel so the link the team copies is the branded
one. With it unset the app uses whatever host is serving it, so the link always resolves. Changing
domain later is an environment variable; tokens are stored on their own and keep working.

## Signing in

Google OAuth, restricted to the designally.co Workspace. Create an OAuth client in Google Cloud
Console, set the authorised redirect URI to `https://<your-domain>/api/auth/callback/google`, and
put the id and secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. See `.env.example`.

The domain is checked three times, because each check alone can be worked around: `hd` on the
authorisation request narrows the account picker, the `hd` claim on the returned profile is checked
server-side, and the address itself must end in the domain and be verified. **A production build
refuses to start without those two variables** — a deploy nobody can sign into is worth catching at
build time.

## Deploying

The app is packaged as a container image: `Dockerfile` builds the Next.js
standalone output for linux/amd64, `.github/workflows/release.yml` builds and
tests it on every pull request and publishes it to GHCR as `sha-<full commit>`
from a `release-*` tag, and `deploy/compose.production.yml` is the Portainer
stack. `GET /api/health` reports the running revision, the database, the
migration count and which settings are present — never their values.

Behind a reverse proxy, `AUTH_URL` and `SURVEY_ORIGIN` both have to be set to
the public origin: the standalone server reports itself as `0.0.0.0:3000`, and
without them sign-in and the links handed to clients would carry that address.

See [docs/deploy-nas.md](docs/deploy-nas.md) for the move from Vercel to the
Designally NAS: variables, the one-off migration step, who owns the
lapsed-survey schedule, cutover, rollback and the smoke suite.

## Where the build has got to

**Milestones 1 and 2 are done.**

*Milestone 1 — the survey.* A public bilingual questionnaire at `/s/<token>`, saving to Postgres.

- Every question block seeded from `seed/question-blocks.json`, versioned
- Steps derived from the blocks, so a new package gets a flow without one being written
- All five question types, including the ten personality scales
- Progress saved to localStorage **and** a server draft, so a cleared browser or a second device still picks up where it left off
- One response row and its answer rows on submit; a blank answer is stored as absent, which is what the analysis reads as a clarity gap

*Milestone 2 — the team can see it.* One page, behind Google OAuth.

- **Needs you** — a survey that has gone quiet for five days is promoted here and asks whether there is enough to work with. It only ever asks
- **All projects** — a real table; the segment meter reads its length from the package rather than assuming five
- **New survey** — client, package, a generated link. No expected respondent count, and there never will be
- **Project detail** — right now, the stage timeline, who answered, the link, and archive
- Two of the four gates are live: closing collection and archiving, each recording who acted and when. Archiving is reversible; nothing is ever deleted

*Milestone 3 — the brief writes itself.* Closing collection runs the analysis.

- Claude Opus 5, server-side, with **structured outputs** — the brief is stored as data, never as a blob of markdown
- The schema has **no numeric field anywhere**: agreement and disagreement are arrays of respondent names, and every count the interface shows is that array's length. A percentage is structurally unrepresentable, and a second check refuses any that reach prose (rule 7)
- Facilitation notes live in their own field rather than behind a flag, so a client-facing renderer cannot leak them by forgetting a boolean (rule 8)
- The close is committed **before** the analysis and separately from it — a failed brief leaves a closed survey that can be analysed again, never a silently un-closed one
- Re-running stores a new brief rather than overwriting: a confirmed brief records what a person approved

Confirming the brief and the deck handoff are gates 2 and 3 — milestone 4.

**How the analysis is tested.** `npm run dev:fixture` writes five synthetic respondents carrying
the findings `docs/first-session-brief.md` names as the acceptance test — an audience split, a
mutual-avoid tone contradiction, clarity gaps, an outlier, and a stated–revealed gap. `npm run
dev:analyse` runs the real prompt against them and prints the brief.

The split is planted with **no signal outside the answers themselves**. Version 1 gave the analysis
a role and a decision-maker flag for every respondent and the original ARUN+ test was passed by
grouping on them; version 3 gives it a name. The fixture is how we know the prompt survived that.
It currently finds all five.

Passing here is weaker evidence than passing on real data — the conflicts are cleaner than life —
but failing here means it would certainly fail there. The real ARUN+ and PCE-TH data is still the
acceptance test and is still not in the repo.

## First move

**Read `SETUP.md`.** It walks through installing Node, creating the Next.js app, adding these files
and starting Claude Code, in the order that actually works.

The short version — note that the app is created **first**, in an empty folder, and these files are
copied in **afterwards**. `create-next-app` refuses to run in a folder that already has files.

```bash
cd ~/Documents
npx create-next-app@latest designally-platform --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd designally-platform
cp -R ~/Downloads/designally-platform/. .
git init && git add . && git commit -m "Starter"
claude
```

Then paste the readiness check from `docs/first-session-brief.md` before asking for any code.

