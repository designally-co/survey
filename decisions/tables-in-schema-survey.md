---
title: The survey's tables live in the Postgres schema survey, not public
app: survey
decided: "2026-10-14"
author: ai
sources:
  - "Buk, 2026-10-09 (P Aek decided that every Supabase project is combined into Project Friday, the company's one project)"
  - "Buk, 2026-10-14 (agreed to move the survey's database into Project Friday, starting with phase 1: the tables into their own schema)"
  - drizzle/0004_tables_in_schema_survey.sql
  - src/lib/db/schema.ts
  - scripts/migrate-deploy.ts
  - scripts/migrate.ts
---

## Context

The survey's 11 tables are in `public` on Neon, and Drizzle's migration history is in the schema `drizzle`. Project Friday, the company's one Supabase project, already holds the brain, Article Studio and the Knowledge Hub, each in its own schema with a database user that reaches that schema only, plus HR and payroll data. Three of the survey's table names (`users`, `projects`, `decisions`) already exist there.

## Decision

Every table is defined in the schema `survey` (`pgSchema('survey')` in `src/lib/db/schema.ts`), and migration 0004 moves the existing tables there with `ALTER TABLE ... SET SCHEMA`, rows, indexes and foreign keys included. The migrations' history moves to `survey.__drizzle_migrations`: on the first run after 0004, both migrate scripts copy the old `drizzle.__drizzle_migrations` rows across, timestamps included, so only 0004 runs; the old table is left as it was. They copy it only from the survey's own old layout (its tables still in `public`) and find the old table through the catalog, so another app's `drizzle` history in a shared database is never adopted, and a schema the survey's user may not open is never touched. The same three phases as Article Studio and the Hub: this code; then 0004 on Neon; then copying `survey` into Project Friday.

## Why

One schema per app keeps the names apart inside the one shared project and lets the survey connect as a database user that can reach `survey` and nothing else. Moving the tables on Neon first proves the change against the real data before the data changes host.
