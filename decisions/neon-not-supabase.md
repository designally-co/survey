---
title: The database was Neon Postgres; since 2026-10-14 it is in Project Friday (Supabase)
app: survey
decided: "2026-10-14"
author: ai
sources:
  - https://github.com/designally-co/survey/blob/8138b0ea4240133a123fac53b6deff802c013d61/CLAUDE.md?plain=1#L40-L56
  - "Buk, 2026-10-09 (P Aek decided that every Supabase project is combined into Project Friday, the company's one project)"
  - "Buk, 2026-10-14 (P Aek agreed to move the survey's database from Neon into Project Friday)"
  - "Buk, 2026-10-14 (asked to do the clean-up the same day and to delete both Neon projects)"
  - decisions/tables-in-schema-survey.md
  - https://github.com/designally-co/designally-brain/blob/b2d79d1ad83b3fe3287e4605b96f63a91258e70b/docs/app-moves.md
---

## Context

The app needs only a Postgres connection string. Sign-in is Google OAuth inside the Next.js app, and the app uses no auth, storage or client library from the database vendor. On 2026-08-10 the database went to Neon, not Supabase, for two reasons: a free Supabase project pauses after 7 quiet days and must be restored by hand, and clients often open their questionnaire a week or two after it is sent, so a paused database means a dead link that nobody reports; and Supabase's free plan allowed two projects per account, both already in use. The first build brief also called Neon the cleanest fit with Vercel and Drizzle.

## Decision

Since 2026-10-14 the database is in Project Friday, the company's one Supabase project: the tables in the schema `survey`, and the app logs in as `survey_app`, a user that owns `survey` and can read nothing else. The app still talks to it through postgres-js against `DATABASE_URL`. The data was copied from Neon in one transaction by the brain repo's "App move" workflow, after a rehearsal, and every table was compared; the NAS stack's `DATABASE_URL` then pointed at Friday, `/api/health` said schema 5 of 5, and Friday held the same rows as Neon. Neon was deleted the same day, at Buk's request, after a new run of Friday's encrypted backup held the schema `survey` (262 tables restored, 0 missing) and nothing had been written to Neon since the copy.

## Why

P Aek decided that every database is combined into Project Friday, and agreed to the survey's move on 2026-10-14. The August reasons no longer hold for Friday: it is never quiet for seven days (the other apps, incoming messages and a timer that runs every minute use it all day, checked 2026-10-14), and the project limit no longer matters because the survey adds no project.
