# Designally Platform — Claude Code Instructions

## Project

Internal platform replacing the manual work between a signed deal and the start of the work. Clients answer branded bilingual questionnaires; the platform collects responses, finds where stakeholders disagree, and produces one summary. That summary is the end of the job — what the team does with it afterwards is not the platform's business.

Read `PRODUCT.md` for users, purpose and design principles. Read `DESIGN.md` for the visual system. Both take precedence over anything inferred from existing code.

## Tech Stack

- Next.js 14+ (App Router), TypeScript, `src/` directory
- Tailwind CSS
- Drizzle ORM + **Postgres in Project Friday** (Supabase; Neon until 14 October 2026)
- **Google OAuth, restricted to the designally.co domain** — no other sign-in method
- Vercel deployment
- Anthropic API for analysis (server-side only, never exposed to the client)

**Survey links live at `s.designally.co/s/<token>`.**

**Decided 10 August 2026 — a subdomain, not a path on the main site.** The original plan was
`designally.co/s/<token>`, routed from the main site. The main site turned out to run on
WordPress, which makes that the wrong shape:

- It needs **two** prefixes proxied, not one. The survey saves drafts to `/api/s/<token>/draft`
  as the client types. Proxy `/s/*` and forget `/api/s/*` and the questionnaire looks fine while
  silently saving nothing.
- `mod_proxy` is disabled on most shared hosting and blocked by most managed WordPress hosts.
- It puts a PHP stack in the path of a twenty-minute questionnaire answered on a phone on a poor
  connection. Every timeout and buffering quirk lands on the client, who does not report it —
  they simply stop answering.
- A plugin update or host migration can change rewrite behaviour with nobody watching.

`s.designally.co` is a CNAME to Vercel. WordPress is never in the path, and Vercel issues the
certificate. `docs/first-session-brief.md` listed this option first.

The host is never hardcoded. `SURVEY_ORIGIN` sets it, and with it unset the app uses whatever host
is serving it, so the link the team copies is always a link that resolves. Changing domain later
is an environment variable — tokens are stored on their own and keep working.

The database host supplies a connection string and nothing else. Auth is Google OAuth in the
Next.js app — one identity source, and it dies with the Workspace account. No hosted-auth,
storage or client library from the database vendor; the app talks to it through `postgres-js`
against `DATABASE_URL`, so the host is a one-line change.

**Decided 10 August 2026 — Neon, not Supabase.** Two reasons, in order of weight:

1. **A free Supabase project pauses after 7 quiet days and has to be restored by hand.** This
   product's rhythm is sporadic — a client opens their questionnaire a week or two after it is
   sent. A paused database means a dead link, and the client does not report it as broken, they
   simply never answer. Neon suspends the same way but resumes on the next connection in a
   fraction of a second, so nobody sees it.
2. Supabase's free plan allows two projects per account, and both were already in use.

`docs/first-session-brief.md` recommended Neon at the outset for a third reason — it is the
cleanest fit with Vercel and Drizzle. Nothing about the schema, the migrations or the driver
changes; only `DATABASE_URL`.

**Moved 14 October 2026 — into Project Friday.** The company combines every database into
Project Friday, its one Supabase project (P Aek's decision). The tables are in the schema
`survey` and the app logs in as `survey_app`, which reaches nothing else. Both August reasons
changed: Friday is never quiet for seven days (other apps and a timer use it all day), and the
project slots are no longer the question. The steps are in the designally-brain repo,
`docs/app-moves.md`; the reasoning is in `decisions/neon-not-supabase.md`.

**Do not import theme, tokens, or components from Knowledge Hub or Content Generator.** Those projects share the stack but not the design system, and neither has a settled one. This project defines its own in `DESIGN.md` and is the reference going forward.

## Two surfaces, one app

- **Public** (`/s/[token]`) — client surveys. No login. Must work on a phone, in Thai, on a poor connection. Saves progress as the client goes.
  **Two to four questions per screen**, grouped by subject in `src/lib/survey/steps.ts` —
  the step *is* the screen, and it **shows all of them and opens one**. The rest fold to
  their number, their question, and once answered the client's own words; tapping one opens
  it. Enter goes to the next question and only leaves the screen when none is left. Asked for by the branding team 17 August 2026; it was one
  question per screen before. Group by what somebody answers in one breath, never by
  count, and the heading over a screen has to be true of everything under it. The
  masthead counts screens and does not count the name/position/email screen — the
  count starts at the first question and its Cut is at rest there, the disc empty
  until there is something to count. **The welcome names the same unit** from
  19 August 2026: it said "21 questions" beside a disc running to nine, so a
  client was given one number and then watched another for twenty minutes. A
  screen is the group somebody moves through — one heading, one Continue — so
  the disc measures groups and the welcome counts them. The twenty-one are still
  counted on the send screen, where `0/21 answered` is attached to the button
  that stays blocked until they are done. It carried the Designally mark for a few
  days and does not from 18 August 2026; empty, it is the Point at the head of
  the Cut, which is the job DESIGN.md gives it first. Each question
  keeps its own 1–21 number in the data — the send screen's grid, the team's
  reading and the analysis all use it — but it is not printed on the card.
- **Private** (everything else) — the team app. Behind auth. Designally staff only.
  **English only, from 18 August 2026** — every string it draws for itself: labels,
  buttons, menu rows, toasts, validation. The bilingual pairs it carried were
  doubling the length of every confirmation for readers who had already read the
  first half. *Data is untouched* — client and respondent names, positions and
  answers appear exactly as they arrive, which is Thai more often than not, so
  DESIGN.md §2's leading rule still governs anywhere content is shown.
  The survey stays bilingual from the identity card onwards — every question,
  every help line, the completion. **The welcome screen alone is English from
  19 August 2026**, asked for directly: it carried three bilingual pairs before
  a single button, and on a phone the meta block wrapped to four lines. It holds
  no question and no instruction, so what a Thai-only reader loses there is a
  title, a duration and a date. **The send screen's count** went with it —
  `0/21 answered` — where the list beneath still marks every blank question in
  both languages. Both are recorded in PRODUCT.md principle 6, which is where
  the rule lives.

Keep them in one Next.js app. Do not build two projects.

## Specs

Everything is decided already. Do not invent product behaviour — read these first:

```
docs/complete-flow.md              the whole flow, step by step, who does what
docs/first-session-brief.md        the build plan and milestone prompts
docs/insight-engine-spec.md        what the analysis produces, and what it must never produce
docs/questionnaire-architecture.md block structure — shared questions, not separate templates
docs/team-workflow-after-survey.md what the team does after answers arrive
docs/navigation-decisions.md       why the navigation is what it is
reference/designally-app.html      the working prototype — design system, copy, interactions
reference/brief-one-page.html      the brief format, built from real ARUN+ data
reference/flow-map.html            the flow as a diagram
```

`docs/website-questionnaire-v2.md` and `docs/content-survey.md` were deleted on 11 August 2026
with the website track. `reference/flow-map.html` still draws the old branch after the kick-off.

**The prototype is the source of truth for design and copy.** It holds the bilingual strings, the token values, the interaction decisions, and the tone. Port from it. Never regenerate a screen from scratch when it already exists there.

## Design

`DESIGN.md` is the complete system — colour, type, Thai typography rules, spacing, every component spec, and the anti-patterns list. Read it before building any screen. Do not infer visual decisions from other repos.

**The brand is the Designally CI, adopted 14 August 2026** from the branding team's design
system (`claude.ai/design`, "Designally Design System"). Colour, the three typefaces, the
five named brand pieces and the voice come from there. The structure underneath does not:
the parchment inversion, the accent rule, borders-not-shadows, the Thai leading rule and
the two volumes are this product's own and survived unchanged. The CI calls itself *a
container, not a look*, and its mood is "expansive, intelligent, timeless" — there was no
conflict with the minimalism already here.

Three things to know before touching colour or type:

- **Shape is not the CI's.** It sets card and control radius to 2px; this product keeps the
  pill primary and the disc back control, because the survey is answered one card at a
  time on a phone. Deliberate, and recorded at the radii tokens.
- **`#ef6148` cannot do functional work on the CI's own page.** 2.92:1 on warm white, so it
  cannot draw a boundary, a dot or text; 3.24:1 under white, so it cannot carry a button
  label. The action colour is the CI hue at the lightness where a white label clears
  4.5:1 — `#c73f29`. The pure CI orange keeps the Cut and the dark Field, where it
  measures 5.99 and is free to be itself.
- **Five CI values fail their own contrast and are corrected here**, hue and chroma held,
  lightness moved. All are marked `CI-DIVERGENCE` in `globals.css` and tabulated in
  `DESIGN.md` §1. Worth sending back to the branding team. The worst is the focus ring on
  the dark Field at 1.39:1. Zalando Sans also does not cover Thai, though the readme says
  it does.

Three things from it that are easy to get wrong:

- **The accent means "a person is needed here."** Never decorative. Accent on something nobody must act on is a defect.
- **Thai leading: 1.6 in a paragraph, 1.25 on a line that stands alone.** Thai stacks four levels vertically and Latin-tuned values clip tone marks — but the flat 1.6 condemned `body` itself and so caught nothing. Measure the ink; see `DESIGN.md` §2.
- **Borders, not shadows.** The focus ring is the only shadow in the system.

## One word, one thing

**Insights** are what the analysis produces from the answers — conflicts, clarity
gaps, flags. It is the only artefact the platform makes, and the job ends when a
person confirms it.

There was a second — **the brief**, what the designer was handed after the
kick-off decisions were recorded. Both were called "brief" until 13 August 2026,
which meant the button said one thing, the sheet title said "survey analysis",
and the spec said "insight". Splitting the words is what let the second object be
seen at all — and then seen for what it was, and dropped with the kick-off on
17 August. The vocabulary work outlived the thing it was for: the surface is
called the insights everywhere, and nothing here is called a brief.

The SQL table was renamed to `insights` on 14 August 2026, which needed
`drizzle-kit generate` run interactively — it has to be told the difference
between a rename and dropping a table with real analyses in it.

The CSS class prefix went the same way on 14 August: `.bsec`, `.bsechead` and
`.bversions` were "brief section" and "brief versions", the retired word sitting
in the stylesheet of the sheet that renamed itself. They are `.isec`,
`.isechead` and `.iversions`. `reference/brief-one-page.html` keeps its name —
it predates the split, and what it draws is this surface, not the brief.

## Rules that must not be broken

These are product decisions, not preferences. If a request conflicts with one, say so before building it.

1. **Closed means no answer is accepted, and there are two ways in.** Settled 19 August
   2026. Somebody presses *Close now*, or the date arrives. The client meets the same
   screen either way, so the app says the same word either way — before this it called one
   of them closed and merely described the other, which left a survey a week past its date
   reading as *open* while its link turned every client away and its answers sat unread.
   **Every survey has a date and it cannot be removed** — chosen on the New survey sheet,
   prefilled at 14 days, editable on the project. A survey with no date is one that takes
   answers until somebody remembers to close it, and remembering is what this stops being
   anybody's job. Surveys sent before the field existed have none; nothing backfills them.
   **One date, one meaning: `due_at` is the day the survey stops.** Closing early moves it
   to that moment, so a closed survey does not go on advertising a date the team no longer
   means. Reopening therefore cannot just clear the gate — every shut survey is past its
   date — so it **requires a new date**, and refuses one already gone.
   Enforced in three places, because a phone left open overnight crosses the date without
   reloading: the page, the draft endpoint and the submit endpoint.
   **The gates are still never on a timer.** The app never archives a project by itself,
   and `closed_at`/`closed_by` still record only what a person did. A date writes neither
   — the route declines to serve, which is a different thing from the app signing a gate as
   though somebody had. That is what keeps rule 2 true and what makes reopening safe:
   there is nothing to undo. Everything that asks *can anybody still answer* derives it
   from the two together; everything that asks *who did this* reads `closed_by` alone.
2. **Two human gates, each recording who acted:** close collection · archive the project. Store `*_by` and `*_at` on both.
   There were four. Recording the kick-off decisions went 17 August 2026 with the
   kick-off itself and was never built. **Confirming the insights went 18 August
   2026**: the platform collects the answers and writes the insights, and it stops
   there — asking a person to countersign the last thing it produces was the app
   holding a door it does not own. Reading the analysis is still the job, and
   `docs/insight-engine-spec.md`'s reason for it stands — the analysis mistakes
   two wordings of one idea for a disagreement — but that is the team's practice
   now, not a state the software enforces. `insights.confirmed_at` and
   `confirmed_by` are **retired in place**: real signatures were written there,
   and dropping them would delete who stood behind an analysis on a shipped
   project.
   Archiving a project whose survey is still open **closes collection on the way
   and signs both** (18 August 2026) — the link had already stopped working, but
   `closed_at` stayed empty and the record lost a gate. It does not run the
   analysis. Deleting closes nothing: the cascade takes the survey with it, so
   there is no row left to stamp.
   The id behind a `*_by` is **checked against `users` before it is written**, not
   taken on the session's word. A JWT is minted once and believed for thirty
   days, so it names a row that existed at sign-in; point the app at a restored
   backup or a reseeded database and every gate fails as a raw `23503`, while
   everything that writes no `*_by` carries on. `actingUser` looks the row up and
   rebuilds it from the session email if it has gone.
3. **No expected respondent count.** Collection is open-ended. Never show a fraction like "2 of 4". Show "3 answers so far · last one 2 days ago".
4. **No estimated content volume.** Do not calculate or display a predicted piece count anywhere, client-facing or internal. The earlier figure came from one project and is not reliable.
5. **Questions are versioned.** A sent survey keeps the question version it was sent with. Editing a template affects future surveys only.
6. **Nothing reaches a client before a human confirms it.**
7. **The analysis never produces percentages or sentiment scores.** Three to twenty respondents cannot support them. "2 of 3" is honest.
8. **Internal facilitation notes are never rendered on a client-facing surface.** Keep them in a separate field, not a flag on shared content.

## Data model

**Every table is in the Postgres schema `survey`, not `public`** (migration
0004, 14 October 2026), and so is the migrations' history
(`survey.__drizzle_migrations`; it was `drizzle.__drizzle_migrations` before).
The survey is moving into Project Friday, the company's one Supabase project,
where `users`, `projects` and `decisions` already exist for other apps, and
where the app will connect as a user that can reach `survey` only. Drizzle
qualifies every table it writes; raw SQL must name tables through the schema
objects (for example `${surveys}` inside a `sql` template), never bare. See
`decisions/tables-in-schema-survey.md`.

Seed data for every question block — bilingual, with per-type config — is in `seed/question-blocks.json`.
Do not retype the questions; import that file.

```
clients          name
                 project_code — retired 18 August 2026, in place. The New
                 survey sheet asked for "Client and project code" in one box
                 and split it on an em dash. The code showed in exactly one
                 place, was searched by nothing, and identified nothing the app
                 lacks an id for. Losing the split matters more than losing the
                 code: a client called "Sea — Land" was filed under "Sea".
projects         client_id, package, archived, archived_at/by
                 stage, kickoff_at — retired 17 August 2026 with the kick-off
                 pages, languages[] — unused since v2
                 all four retired in place: never written, never read
question_blocks  key (identity | strategy | project | visual
                      | core | branding | website | content | ecommerce — retired)
questions        block_id, order, text_en, text_th, type, config, version
surveys          project_id, kind (discovery), token,
                 opened_at, due_at, closed_at, closed_by
                 due_at — the day the survey stops taking answers. Required
                 from 19 August 2026 and not removable; closing early moves it
                 to the moment it closed, so it is always the day the survey
                 stopped. It shows on the survey and stops the link serving —
                 see rule 1. It writes nothing else: `closed_at` stays null
                 unless a person pressed the button.
responses        survey_id, respondent_name, role, email, submitted_at
                 role and email — retired at versions 3 and 4, both live again at
                 question version 5: the team asked for who is speaking and how to
                 reach them before they read an answer. Neither column was ever
                 dropped, so bringing the questions back needed no migration.
                 decision_maker — retired at question version 3, kept for surveys
                 sent before it
answers          response_id, question_id, value
insights         project_id, generated_at, content, sources,
                 confirmed_at, confirmed_by   (table renamed from briefs, 14 Aug)
decisions        retired 17 August 2026 with the kick-off — table kept, empty
users            team members
```

Question types are exactly five: `paragraph`, `short_text`, `multiple_choice`, `checkboxes` (with
optional min/max), `linear_scale` (with pole labels, point count, and an optional `start`). The personality scales
run **1–5**. Version 2 briefly ran them 0–10; `start` and the wide rendering stay for the surveys
sent while that was true.

**A version bump is two changes.** The code half is this file's number and
`seed/question-blocks.json`; the other half is `npm run db:seed` against *every*
database the app runs on, production included. Ship one without the other and the
deployed app reads zero questions at the new version and refuses to create a
survey at all — which is what happened on 21 August 2026 between pushing version 7
and seeding Neon. See the note at `CURRENT_QUESTION_VERSION`.

**Question version 7, 21 August 2026 — and it is the first version to change what
is asked, not how.** The celebrity question — *"If your brand were a celebrity or
well-known person, who would it be?"* / *ถ้าเปรียบแบรนด์คุณเป็นคนมีชื่อเสียงสักคนหนึ่ง
เขาจะเป็นใคร?* — is now in **both** packages, and they are **two separate rows**:
`strategy.14` for Brand and `project.3` for Design. Only the `visual` block is
shared between packages, so wording changes have to be made twice.

**Design gained a question rather than trading one: 11 numbered questions to 12**,
on a new screen of its own headed *Brand persona* between *The brand today* and
*The job ahead*. Naming a person the brand resembles is neither where the brand
came from nor what this piece of work has to do, and filed under either heading
the heading stops being true. The welcome counts six screens where it counted
five, and the send screen counts twelve.

**Brand traded one**, and the question it replaced took a heading with it. Brand
question 14, the last of the `strategy` block, is the celebrity question: *"If your brand were a celebrity or well-known person, who would
it be?"* / *ถ้าเปรียบแบรนด์คุณเป็นคนมีชื่อเสียงสักคนหนึ่ง เขาจะเป็นใคร?* It replaces the
brand-voice question — what tone to use with customers and inside the team — which
stood there through version 6.

Same block, same order, same `paragraph` type, still required, so the Brand count
does not move: **twenty-one questions**, and the disc, the send screen's grid and the
analysis all count what they counted before.

**It changed screens on 21 August**, which the swap should have done on the way in
and did not. `strategy.14` sat under *How it speaks* — a heading, and a Thai line,
about how the brand talks to customers and how the team talks about it — which
described the brand-voice question exactly and describes a celebrity not at all. It
is with the personality scales now: *what would they be like* and *who would they be*
are one question asked twice, and somebody who has just placed ten dots has the
answer in mind. *How it speaks* keeps `strategy.11` and `strategy.13`, which are both
about the team. **Answers to the two are not comparable**, which
every earlier version could claim and this one cannot: a version-6 respondent
described a tone, a version-7 one names a person. Anything reading across versions
has to treat question 14 as two questions sharing a number.

The Thai arrived with a space inside `มีชื่อเสียง` — *"famous"* split into *"name"* and
*"sound"*. Closed on the way in; Thai does not space within a word, and the two halves
mean something else apart.

**Question version 6, 17 August 2026.** Same twenty-one questions, same order, same types,
same answers — only the words in front of them. Seven of the visual questions opened with the
label their own screen heading already said (*"Mood and Personality — choose 3 words…"* under a
heading reading *"Mood and impression"*), and two were missing a full stop. The fix could not
reach version 5: `scripts/seed.ts` refuses to replace a question anybody has answered, which is
rule 5 working rather than failing. A new version is how a correction reaches the next client
without rewriting what the last one was asked.

**Decided 11 August 2026 — two packages, and the website track is retired.** The branding team
replaced the questionnaire. A client buys Brand **or** Design, never both.

| Package | Blocks | Questions |
|---|---|---|
| **Brand** — Brand Strategy + Brand Identity | identity · strategy · visual | 22 |
| **Design** | identity · project · visual | 12 numbered, from question version 7 |

Part 2 of the new questionnaire is identical in both packages, word for word, in both languages —
so `visual` is one shared block. See `docs/questionnaire-architecture.md`.

Gone with the website track: the `website`, `both` and `content` packages, the content survey and
its `/c/<token>` route, and **milestone 5**. The retired blocks stay in the database because
surveys already sent keep the questions they were sent with (rule 5); deleting a block key would
orphan a real brief.

**There are no stages.** The five-stage meter — Lead → Proposal → Survey → Analysis → Kick-off —
went on 17 August 2026, along with the kick-off, the *What's coming* sheet and the question
template panel. The app models a survey and the summary it produces, and nothing on either side
of that. `projects.stage`, `projects.kickoff_at` and the whole `decisions` table are retired in
place: never written, never read, never dropped.

## Build milestones

Each one ends with something usable. Do not start the next before the previous has been used on a real project.

1. **One survey link that works** — public bilingual form, saves to Postgres. No auth, no team app.
2. **The team can see it** — auth, Projects list, create survey, view responses. Already replaces Google Forms.
3. **The team can prepare in ten minutes** — analyse, Anthropic API, structured output.
   **The analysis runs itself once the date passes** (20 August 2026, asked for) — a
   daily Vercel cron at `/api/cron/lapsed` finds every unarchived survey past its
   date with answers and no analysis, and writes one. It needs `CRON_SECRET`, and
   refuses outright without it: the route spends money at Anthropic. This is not
   rule 2 or principle 4 being broken — it writes an `insights` row and nothing
   else, so `closed_at` and `closed_by` still record only what a person did, and
   generating the insights was never a gate. It also picks up a manual close whose
   analysis failed, because closing moves `due_at` to the moment it closed.
   **The analysis does not need a closed survey** (19 August 2026): it runs on
   whatever answers are in, so an early read of two or three is a press. Closing
   still runs it on the way, and where a run has been overtaken the project sheet
   says so rather than the app forbidding the read. The engine reports what they might miss or must be careful about; it does not read the answers for them. The team sees the full answers and that summary. Narrowed 13 August 2026 after the first real brief returned fifty items, and again on 17 August when the deck outline and the room notes went with the kick-off — see `docs/insight-engine-spec.md`.
4. ~~The human gate~~ — review and confirm the insights. **Retired 18 August 2026.** The
   platform stops at the insights themselves: milestone 3 produces them, and reading
   them is the team's job rather than a gate the app holds open. What survived is the
   insights sheet — every run kept as a version, and *Write it again* to re-run on
   whichever answers you choose.
5. ~~The website track~~ — retired 11 August 2026 with the website package.
6. ~~The template editor~~ — retired 17 August 2026 with the *Question templates* panel. The
   questionnaire is fixed at version 7, the branding team owns its wording, and the questions
   live in `seed/question-blocks.json`. Rule 5 still holds if that ever changes.

## Working conventions

- Commit after each working piece. Small commits, plain messages.
- **Test in Thai every time.** Thai wraps and stacks differently; layouts that pass in English fail in Thai. This is the most common defect in this domain.
  The team app's own *chrome* is English from 18 August 2026, but every place it
  shows a name or an answer still has to survive Thai — a sheet title, a
  confirmation naming a client, a list of respondents. Testing it in Thai means
  testing it with Thai *data*.
- Test client surveys at 390px width before considering them done.
- Run the app and screenshot it rather than asserting that something works.
- When a product decision changes, update the file in `docs/` in the same commit.
- Run through the checklist at the end of `DESIGN.md` before calling a screen finished.

## Figma

MCP server connected (`claude mcp add --transport http figma https://mcp.figma.com/mcp`).

This project's design system is defined in code first, not in Figma. Build the screen, then use code-to-Figma capture to bring it back for review or to hand to a designer. Do not start from a Figma frame that predates `DESIGN.md` — the tokens here are the source of truth.

If a component library is later built in Figma, generate it *from* this system rather than the reverse.

## Decision notes for the Designally Brain

Before you finish a build session, write a note for each decision the session made, in `decisions/`, and commit it with the work. Do this without being asked; there is no approval step. Format and rules: `decisions/README.md`.

- A decision is a choice someone could later ask "why is it like this?" about: a library or service, the data shape, hosting and deploys, a rule users meet, an approach tried and dropped. Small fixes need no note.
- Read `decisions/` first. If a note already covers it, update that note.
- Never guess. Take facts only from sources: a link pinned to a commit, a file in this repo, or what the person said in the session ("Buk, 2026-10-07"). If the reason is not clear, ask the person once; if it is still unknown, leave `## Why` empty.
- Write `author: ai`. No secrets, passwords, client contact details or personal data.

## Keep `brain.yaml` true

`brain.yaml` at the repo root is how the Designally Brain knows what this app is and does. The Brain reads it from `main` every night, and nothing else updates it: the loader never edits it. So when a change makes anything in it untrue, update it in the same change, without being asked.

- Check it whenever a change touches what a person can do, what the app is for, its address, its stack, its tables or its links to other apps. Examples: a feature added, removed or hidden; a language turned off; a new table; a move to another database.
- Edit only what the change made untrue. Keep the rest exactly as it is, and leave `generated` alone (the person who merges the change checks the file).
- Format: `https://github.com/designally-co/designally-brain/blob/main/docs/brain-yaml.md`. Same rules as the notes: no guessing (unknown stays empty), no secrets, no personal data.
- Name the update in the pull request, so the reviewer checks it.
- Facts that live outside the code (a Portainer or Vercel setting, a release that went live) cannot be seen by the Brain. When the session learns one that matters later, write it in a decision note or in the right doc listed under `docs:` in `brain.yaml`.
- The Brain does not have to wait for the night. After the change is merged into `main`, a person can load it at once: in `designally-co/designally-brain`, open Actions, then **Brain loader**, then **Run workflow** on `main` with mode **load** (the default, `dry-run`, writes nothing). Search by meaning catches up a few minutes later. The AI cannot start it (GitHub refuses with 403). So when a session ends with a merged change the Brain should know about, tell the person they can run it now.

## Build for the future ecosystem

Designally plans a brand ecosystem: one product for Designally and for clients, where each app becomes a module that reads the client's brand from one place (Brand Core) and shares sign-in, credits and a back office. It is a future plan, not for now (Buk, 2026-10-15). Do not build any part of it (workspaces, credits, back office, marketplace, front door, job queue, a separate product database) unless the person asks. The plan: the `company-ecosystem-*` notes in `https://github.com/designally-co/designally-brain/tree/main/decisions`.

But build today's changes in a way that supports it. In every change, choose the option that keeps these true when it costs little now:

- Settings, not code: no new Designally-only values (brand, topics, audience, languages) written into code; keep them in settings or data.
- No new "only one" assumptions where avoiding them costs nothing (one brand, one client). Do not add workspace columns yet.
- Talk to other apps through their APIs, never by reading their tables.
- Files in Cloudflare R2, never in the database.
- Brand data stays structured (fields, not free text); the Brand Guideline Portal is its home.
- Every AI call records its model, tokens and cost.
- AI keys only in server secrets or admin-only settings; never in code or the browser.
- Long AI work runs step by step where that is easy, so it can move to a queue later.

When a change would make one of these harder later, say so plainly and ask the person before building.
