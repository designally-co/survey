/**
 * Data model — CLAUDE.md "Data model".
 *
 * Two rules shape this file and are easy to break later:
 *
 *   Rule 2 — four human gates, each recording who acted. Every gate stores a
 *   `*_by` and an `*_at`. There is no default, no trigger, no timer that can
 *   fill them in.
 *
 *   Rule 5 — questions are versioned. A survey stores the question version and
 *   the block keys it was sent with, so editing a template later cannot change
 *   what a respondent was asked.
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Every table lives in the Postgres schema `survey`, not `public`
 * (decisions/tables-in-schema-survey.md). The survey is moving into Project
 * Friday, the company's one Supabase project, where other apps' tables sit
 * beside these — `users`, `projects` and `decisions` exist there too — and
 * where the app connects as a user that can reach `survey` only. Drizzle
 * qualifies every table it writes (`"survey"."surveys"`); raw SQL must name
 * tables through these objects, never bare.
 */
export const surveySchema = pgSchema('survey');

/* ── team ─────────────────────────────────────────────────────────── */

export const users = surveySchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ── clients and projects ─────────────────────────────────────────── */

export const clients = surveySchema.table('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /**
   * Retired 18 August 2026, in place — never written, never read, never
   * dropped, like `projects.stage` before it.
   *
   * The New survey sheet asked for "Client and project code" in one box and
   * split it on an em dash. The code was shown in exactly one place, searched
   * by nothing, and identified nothing the app lacks an id for. Rows that
   * already carry one keep it.
   */
  projectCode: text('project_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Two packages, and a client buys one or the other — never both.
 *
 * The website and combined packages were retired on 11 August 2026 along with
 * the whole website track. The five-stage flow they ran through went on 17
 * August: the app models a survey and the summary it produces, and nothing
 * between.
 */
export const PACKAGES = ['brand', 'design'] as const;
export type Package = (typeof PACKAGES)[number];

export const projects = surveySchema.table('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  package: text('package').$type<Package>().notNull(),
  /**
   * Retired 17 August 2026 with the five-stage flow.
   *
   * The team app no longer models a project's position — the job is the survey
   * and the summary it produces, and a meter counting towards a kick-off the
   * platform does not track was inventing progress. Nothing reads this now and
   * nothing writes it; the default keeps existing inserts valid.
   *
   * Not dropped, on the same reasoning that kept `role` and `email` through
   * their retirement: a column costs nothing to leave and a great deal to
   * recreate, and those two came back four days later.
   */
  stage: integer('stage').notNull().default(2),

  /* retired with the kick-off, 17 August 2026 — never written, never read */
  kickoffAt: timestamp('kickoff_at', { withTimezone: true }),
  /* Held the retired website block's answers. Unused since the website track
     was dropped; kept rather than migrated away, in case it returns. */
  pages: text('pages'),
  languages: text('languages').array(),

  /* gate 4 — archive. Manual, always. Nothing archives itself. */
  archived: boolean('archived').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedBy: uuid('archived_by').references(() => users.id),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ── the question library ─────────────────────────────────────────── */

/**
 * `core`, `branding`, `website`, `ecommerce` and `content` are no longer
 * attached to any package, but they stay listed: surveys already sent keep the
 * questions they were sent with (rule 5), and their answers still point at
 * those blocks. Removing a key here would orphan a real insights.
 */
export const BLOCK_KEYS = [
  'identity',
  'strategy',
  'project',
  'visual',
  /* retired — kept so already-sent surveys still resolve */
  'core',
  'branding',
  'website',
  'content',
  'ecommerce',
] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];

export const questionBlocks = surveySchema.table('question_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').$type<BlockKey>().notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameTh: text('name_th').notNull(),
  introEn: text('intro_en'),
  introTh: text('intro_th'),
  /** the seed's `shown_when` — ecommerce is conditional on the website block */
  shownWhen: text('shown_when'),
});

export const QUESTION_TYPES = [
  'paragraph',
  'short_text',
  'multiple_choice',
  'checkboxes',
  'linear_scale',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Per-type settings. Exactly the five types the Google Forms used. */
export type QuestionConfig = {
  /**
   * multiple_choice, checkboxes.
   *
   * `image` is a path under `public/`. A choice that carries one is a visual
   * reference, not an illustration of a word — the Mood and Personality
   * question asks the client to pick a feeling, and a mood board says what
   * "Bold" means far better than the adjective does, in either language.
   */
  choices?: { en: string; th: string; label?: string; image?: string }[];
  /** multiple_choice, checkboxes — allow a free-text "Other" */
  other?: boolean;
  /** checkboxes */
  min?: number;
  max?: number;
  /** linear_scale */
  points?: number;
  /**
   * First value on the scale. Absent means 1, which is what versions 1 and 3
   * use. Version 2 briefly ran the personality scales 0–10, where 0 was a
   * position ("fully Traditional") and not an absence of one — those surveys
   * still exist and still have to render (rule 5).
   */
  start?: number;
  pairs?: { left_en: string; left_th: string; right_en: string; right_th: string }[];
  /** promotes the answer onto the response or project row — email | pages | languages | skus */
  maps_to?: string;
  /** choice label → block key that the choice reveals */
  triggers?: Record<string, BlockKey>;
};

export const questions = surveySchema.table(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockId: uuid('block_id')
      .notNull()
      .references(() => questionBlocks.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    textEn: text('text_en').notNull(),
    textTh: text('text_th').notNull(),
    helpEn: text('help_en'),
    helpTh: text('help_th'),
    type: text('type').$type<QuestionType>().notNull(),
    config: jsonb('config').$type<QuestionConfig>().notNull().default({}),
    required: boolean('required').notNull().default(true),
    /** Rule 5. Editing a question writes a new row at version + 1. */
    version: integer('version').notNull().default(1),
  },
  (t) => [unique('questions_block_order_version').on(t.blockId, t.order, t.version)],
);

/* ── surveys ──────────────────────────────────────────────────────── */

/**
 * The content survey was the website track's follow-up and went with it. The
 * kind is kept as a one-member union rather than removed, because `surveys.kind`
 * is a stored column and a second kind may return.
 */
export const SURVEY_KINDS = ['discovery'] as const;
export type SurveyKind = (typeof SURVEY_KINDS)[number];

export const surveys = surveySchema.table('surveys', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<SurveyKind>().notNull(),
  token: text('token').notNull().unique(),

  /* Rule 5 — frozen at send. Editing a template cannot reach back into this. */
  questionVersion: integer('question_version').notNull().default(1),
  blockKeys: text('block_keys').array().$type<BlockKey[]>().notNull(),

  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),

  /**
   * When the team asked for answers by. Fourteen days at creation, editable.
   *
   * **This does not close anything.** Rule 1 — nothing happens on a timer, and
   * closing collection is one of the four human gates that records who acted.
   * A date that closed a survey by itself would leave `closed_by` empty, which
   * is the whole thing the gate exists to prevent.
   *
   * It does two jobs instead. The client sees it, which is what actually makes
   * people answer; and once it passes, the project surfaces in Needs you with
   * a prompt. A person still clicks. A late answer still lands, which is a
   * gift rather than a problem.
   *
   * Nullable: surveys sent before this existed have no date and behave exactly
   * as they did.
   */
  dueAt: timestamp('due_at', { withTimezone: true }),

  /* gate 1 — close collection */
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: uuid('closed_by').references(() => users.id),
});

export const responses = surveySchema.table('responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyId: uuid('survey_id')
    .notNull()
    .references(() => surveys.id, { onDelete: 'cascade' }),
  respondentName: text('respondent_name').notNull(),
  role: text('role'),
  /** the identity block's third question, verbatim — never a boolean */
  decisionMaker: text('decision_maker'),
  email: text('email'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per question answered. `value` is tagged by kind so the analysis can
 * read it without re-deriving the question type:
 *   { kind: 'text',   text: string }
 *   { kind: 'choice', choice: string, other?: string }
 *   { kind: 'multi',  choices: string[], other?: string }
 *   { kind: 'scale',  points: number, values: Record<string, number> }  // key = pair index
 */
export type AnswerValue =
  | { kind: 'text'; text: string }
  | { kind: 'choice'; choice: string; other?: string }
  | { kind: 'multi'; choices: string[]; other?: string }
  | { kind: 'scale'; points: number; values: Record<string, number> };

export const answers = surveySchema.table('answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  responseId: uuid('response_id')
    .notNull()
    .references(() => responses.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id')
    .notNull()
    .references(() => questions.id),
  value: jsonb('value').$type<AnswerValue>().notNull(),
});

/**
 * A part-finished survey. One link is shared between several stakeholders, so a
 * draft belongs to a device, not to a survey — `draft_key` lives in that
 * browser's localStorage. Drafts are never promoted to responses automatically;
 * only a submit writes a response.
 */
export const surveyDrafts = surveySchema.table(
  'survey_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    draftKey: text('draft_key').notNull(),
    step: integer('step').notNull().default(0),
    values: jsonb('values').notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('survey_drafts_survey_key').on(t.surveyId, t.draftKey)],
);

/* ── what comes out of the survey ─────────────────────────────────── */

/**
 * The analysis output.
 *
 * Renamed from "brief" in the product's vocabulary on 13 August 2026: the team
 * called this the insights, and "brief" meant what the designer was handed after
 * the kick-off decisions were recorded — a different artefact. The second
 * artefact went with the kick-off on 17 August 2026, so there is one thing here
 * again, and it is this one.
 *
 * The SQL table was renamed to match on 14 August 2026 — `drizzle-kit generate`
 * has to be told that is a rename rather than a drop of a table with real
 * analyses in it, which it can only ask in an interactive terminal.
 */
export const insights = surveySchema.table('insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  /** structured, not a blob of markdown */
  content: jsonb('content').notNull(),

  /**
   * Which responses this analysis read.
   *
   * The team can analyse a subset — to see the insights without an outlier, or
   * without a duplicate submission. Once that is possible, every count in the
   * insights are unreadable without this: "2 of 3 want X" is honest only if you can
   * tell it was three of the five responses that exist.
   *
   * Names are snapshotted rather than joined, because a response can be deleted
   * afterwards and insights citing five people should still say who they were.
   * Null on insights written before this existed, which is the truth about them.
   */
  sources: jsonb('sources').$type<{ id: string; name: string }[]>(),

  /* gate 2 — confirm the insights. Rule 6: nothing reaches a client before this. */
  /**
   * Gate 2, retired in place 18 August 2026 — never written, never read.
   *
   * Confirming the insights was the third human gate: a person read the
   * analysis and put their name to it before the team worked from it. It went
   * when the platform's job was narrowed to collecting the answers and writing
   * the insights, which is where it now stops.
   *
   * The columns stay, and stay for the same reason `projects.stage` and the
   * `decisions` table do: real signatures were written here, and dropping them
   * would delete a record of who stood behind an analysis on a project that has
   * already shipped. Nothing reads them, so they cost a migration nobody needs
   * and two nullable columns nobody sets.
   */
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  confirmedBy: uuid('confirmed_by').references(() => users.id),
});

/**
 * Retired 17 August 2026 with the kick-off. Never written, never read.
 *
 * It is left standing rather than dropped for the same reason `projects.stage`
 * is: a retirement here has come back before — `responses.role` and
 * `responses.email` were retired at question versions 3 and 4 and asked for
 * again at version 5, four days later, and cost nothing to restore because the
 * columns had never gone. An empty table costs nothing to keep and a migration
 * to remove.
 */
export const decisions = surveySchema.table('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  /** "still open" is a valid outcome */
  outcome: text('outcome').notNull(),
  note: text('note'),

  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  recordedBy: uuid('recorded_by').references(() => users.id),
});

/* ── relations ────────────────────────────────────────────────────── */

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  surveys: many(surveys),
  insights: many(insights),
  decisions: many(decisions),
}));

export const questionBlocksRelations = relations(questionBlocks, ({ many }) => ({
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  block: one(questionBlocks, {
    fields: [questions.blockId],
    references: [questionBlocks.id],
  }),
}));

export const surveysRelations = relations(surveys, ({ one, many }) => ({
  project: one(projects, { fields: [surveys.projectId], references: [projects.id] }),
  responses: many(responses),
  drafts: many(surveyDrafts),
}));

export const responsesRelations = relations(responses, ({ one, many }) => ({
  survey: one(surveys, { fields: [responses.surveyId], references: [surveys.id] }),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  response: one(responses, { fields: [answers.responseId], references: [responses.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
}));
