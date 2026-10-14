-- Every table moves from `public` to the schema `survey`.
--
-- The survey is moving into Project Friday, the one Supabase project the
-- company keeps. Other apps' tables are there already, three of them with the
-- same names as ours (`users`, `projects`, `decisions`), and Friday also holds
-- HR and payroll data. One schema per app keeps the names apart and lets this
-- app connect as a database user that can reach `survey` and nothing else.
--
-- SET SCHEMA moves a table with its rows, indexes, constraints and foreign
-- keys, so nothing is copied and nothing is lost. IF EXISTS keeps a re-run
-- harmless.
--
-- Run it on Neon first, where the app lives today: the move is proven against
-- the real data before the data changes host. The migrations' own bookkeeping
-- moves to `survey` in code (scripts/migrate.ts, scripts/migrate-deploy.ts),
-- not here: it has to be in place before this file runs.
-- Decision note: decisions/tables-in-schema-survey.md.

CREATE SCHEMA IF NOT EXISTS "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."users" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."clients" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."projects" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."question_blocks" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."questions" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."surveys" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."responses" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."answers" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."survey_drafts" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."insights" SET SCHEMA "survey";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."decisions" SET SCHEMA "survey";
