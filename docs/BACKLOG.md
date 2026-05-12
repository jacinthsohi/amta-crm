# AMTA CRM Backlog

Single source of truth for what's planned, what's in progress, and what's
shipped. Replaces the rolling priority list that previously lived in
handoff docs.

**Conventions:**
- 🔴 HIGH — load-bearing for current users or unblocks the next thing
- 🟡 MEDIUM — real value, no urgency
- 🟢 LOW — nice-to-have, polish, dev-only
- 🐛 BUGS — known broken behavior
- 🧊 ICEBOX — not committing to, may never do
- 💭 DESIGN DISCUSSIONS — open product questions, no clear shape yet
- ✅ SHIPPED — done, kept here for momentum / portfolio context

Last updated: May 12, 2026 (end of evening session)

---

## ✅ Recently shipped

- **"Add judges" deep-link flow on Event detail page** (May 12, 2026)
  - "Add judges" button next to Edit in Event detail header (tournament
    events only — board meetings don't get the button)
  - Navigates to `/contacts/import?eventId={id}` with full deep-link state
  - Auto-checks "Add to event", pre-selects the event, defaults position
    to "Judge", pre-selects the Judge category chip
  - Contextual page reframing: H1 becomes "Add judges to [Event Name]",
    subtitle explains the auto-applied settings, back / done buttons
    return to the event
  - Header auto-mapping with alias list — catches "Preferred Email
    Address", "Cell phone", and common variants without manual mapping
  - CSS overflow fix on column-mapping card for long Google Form
    headers (`minmax(0, 1fr)` + `min-w-0` on selects)
- **Contacts CSV import flow** (May 12, 2026)
  - 4-step wizard at `/contacts/import`: upload, map columns, processing, result
  - "Import CSV" button on `/contacts` list page (entry point)
  - Column auto-mapping from slugged header names + alias matching
  - Multi-category tagging during import (chip-based multi-select)
  - Optional event association with custom position field (defaults to "Judge")
  - Live preview of first 5 rows with column mapping applied
  - Per-row error collection — partial failures don't abort the batch
  - Within-CSV duplicate detection + cross-CSV duplicate handling (additive
    update on email match)
  - Idempotent association inserts
  - Detailed result screen with imported / updated / errored breakdown +
    per-row error table
  - **Validated with real-world data:** 97-row tournament-host CSV with
    26 columns (Google Form export with idiosyncratic headers)
  - Spec: `docs/specs/contacts-csv-import-mvp.md`
- **Judges separated from Staff on Event detail page** (May 12, 2026)
  - Render order: Hosts → Staff → Documents → Projects → Interactions → Judges
  - Judges last because real tournaments have hundreds of judges; mid-page
    placement would push everything else below a giant scroll
- **Alumni claims admin flow — Phase 2 complete** (May 11–12, 2026)
  - Generic Modal primitive (`src/components/Modal.tsx`)
  - Review modal with duplicate detection banner
  - Approve flow: pre-filled editable contact form, creates contact +
    program affiliation, marks claim approved
  - Reject flow: Spam / Other (specify) reasons, stored in `review_notes`
  - Auth detection on `/alumni-signup` — signed-in users see a redirect
    view instead of the form (avoids RLS 403 for admins; policy stays
    correctly scoped to `anon`)
- **Contacts list default sort by first name, then last name** (May 12, 2026)
- **Public alumni signup form** at `/alumni-signup` (May 11, 2026)
- **Refresh-bounce bug fixed** — navigator.locks deadlock in
  `src/lib/supabase.ts` (May 11, 2026)
- **Dev/prod Supabase env mismatch fixed** (May 11, 2026)

---

## 🔴 HIGH

- **🔒 SECURITY: `active_*` views bypass RLS — cross-user data leak.**
  Discovered May 12, 2026 while investigating bug B1 ("can't delete Maggy
  Randels conversation").
  
  **Root cause:** Postgres views run with the *creator's* permissions by
  default, not the querying user's. `active_ai_conversations` (and almost
  certainly every other `active_*` view in the schema) is owned by
  `postgres` (superuser), which bypasses RLS on the underlying table.
  Result: when an authenticated user queries `active_ai_conversations`,
  they see ALL active rows, not just rows where `auth_user_id = auth.uid()`.
  
  **Evidence trail from the investigation:**
  - RLS policies on `ai_conversations` are configured correctly
    (`authenticated_select_ai_conversations` filters on `auth_user_id =
    auth.uid()`)
  - But the sidebar shows 2 conversations to admin user (mine + Maggy
    Randels'), where Maggy is a separate auth user
    (`32c79ee5-134f-49ba-ac67-38033f0bc94e`, email
    `margaret.e.randels@gmail.com`)
  - `SELECT COUNT(*) FROM ai_conversations WHERE deleted_at IS NULL` =
    2, matching the sidebar count exactly → admin is seeing everyone's
    conversations
  - View owner is `postgres` (confirmed via `SELECT viewowner FROM
    pg_views WHERE viewname = 'active_ai_conversations'`)
  
  **Scope of impact (likely broader than just one view):** Every
  `active_*` view in the schema was probably created the same way.
  Almost certainly affected: `active_contacts`, `active_events`,
  `active_committees`, `active_contact_categories`,
  `active_event_documents`, `active_event_hosts`, `active_event_staff`,
  `active_invitations`, `active_officer_terms`, `active_program_a...`,
  others visible in the table editor sidebar. Each one potentially leaks
  whatever cross-user data its underlying table is supposed to protect.
  
  **Why this isn't an active incident:** Jacinth is currently the only
  real signed-in user. Maggy hasn't logged in. So the leak is
  theoretical — no user is actually seeing data they shouldn't. But it
  becomes an active incident the moment a second user logs in.
  
  **Fix approach:** Audit every `public.active_*` view. For each one:
  recreate with `WITH (security_invoker = on)` so the view runs with the
  querying user's permissions and RLS on the underlying table applies.
  Likely a single migration that drops + recreates all the views.
  Test pass on every feature that reads from an `active_*` view to
  confirm RLS-filtered results still surface what the UI expects.
  Document the gotcha in a migration comment so future views don't
  repeat the mistake.
  
  **Symptom artifact preserved as a reminder:** Did NOT hard-delete
  Maggy's conversation from the database. It's still there, still
  showing in the sidebar, still un-deletable via the UI. Visible
  reminder of the bug until the proper fix lands. Row ID:
  `d953c4cb-e50f-490e-b2ee-89038eadf019`.
  
  **Replaces bug B1 in 🐛 BUGS section** — what looked like "can't
  delete this one conversation" turned out to be a much bigger issue
  manifesting at the surface.

- **Email automation for invitations.** Currently admins copy/paste invite
  links manually. Unblocks the entire "actually onboarding people" flow.
  Note: should NOT onboard new users until the views RLS bypass is fixed.

---

## 🟡 MEDIUM

- **🧪 Test-data infrastructure: `is_test` flag on programs and contacts.**
  Currently no clean way to test features (especially the upcoming KPI
  dashboard) without polluting real stats. Three test contacts and the
  intent to create a "Midlands State University" test program prompted
  this. Doing it properly now, before the data dashboard ships, avoids
  retroactive cleanup.
  
  **Schema changes:**
  - Add `is_test boolean NOT NULL DEFAULT false` to `programs` table
  - Add `is_test boolean NOT NULL DEFAULT false` to `contacts` table
  - Backfill: identify the three current test contacts + flag them
    `is_test = true`. List of identifiable test contacts to update
    during migration, captured ahead of time so backfill is deterministic.
  - Create "Midlands State University" as a real program row but with
    `is_test = true` (and any future test programs follow this convention)
  
  **Query implications — every read needs a decision:**
  - **Stats / counts (`/data` dashboard, Home page widgets):** filter
    `is_test = false`. Test rows should NEVER count toward production
    metrics.
  - **List pages (`/contacts`, `/programs`, `/events`):** filter
    `is_test = false` by default. Add a "Show test data" toggle in
    settings or as a URL param for when the admin explicitly wants to
    see test rows (e.g. during testing).
  - **Detail pages (`/contacts/:id`, `/programs/:id`):** show the row
    regardless of `is_test` (admin navigated here intentionally). But
    surface a visible badge — small "TEST" pill near the name — so
    there's no ambiguity.
  - **AI features (Ask AI, contact summaries, meeting briefs):** filter
    `is_test = false` from the data Claude sees. Critical — test data
    should not leak into AI-generated content that an admin might
    forward externally.
  - **CSV export:** include `is_test` as a column so the export is
    self-describing. Admin can filter in spreadsheet if needed.
  - **CSV import:** new contacts default to `is_test = false`. No UI
    affordance to mark imported rows as test (rare enough use case).
  - **Cascading:** affiliations between a test program and a non-test
    contact should be allowed (a test contact's affiliation to a real
    program is also fine). The `is_test` flag is per-row, not
    relational.
  
  **UI surfacing:**
  - Small "TEST" badge (zinc-100 background, zinc-700 text, like a Tag
    but more muted) on test program / contact detail pages
  - Settings toggle: "Include test data in lists" (default off)
  - Possibly a separate `/admin/test-data` route to view all flagged
    rows in one place for cleanup convenience
  
  **Scope:** Real chunk of work. Estimate:
  - Migration + backfill: 15 min
  - List filter updates across pages: 30-45 min (every list query
    touches this)
  - Stats filter updates: depends on what stats exist when fix lands
  - AI feature filters: 30 min (need to audit every endpoint)
  - UI badge + settings toggle: 30 min
  - Test pass: 30 min
  - Total: 2-3 hours of focused work
  
  **Do this BEFORE the data dashboard ships.** Building the dashboard
  first and retrofitting the filter later is harder than the reverse.

- **Add seasonal dimension to committee assignments + board membership.**
  AMTA operates on July–June "seasons" tied to the annual board meeting.
  Committees can exist in one season and not the next (e.g. Operational
  Excellence exists for 2025-2026; may not for 2026-2027). Board
  membership rotates similarly. **Path:** add a `season` column to
  `committee_assignments` (string like "2025-2026"), keep the existing
  `start_date`/`end_date` columns as underlying truth, surface season as
  the user-facing concept. Same pattern for board membership. UI: split
  Contact page into "Current committees" / "Past committees" sections.
  Scope: schema migration + data backfill + UI changes in 2-3 places.
  Half-day to full-day. Also implicates bug B2 (officer terms).
- **Constrain `event_staff.position` to a canonical dropdown.** Free-text
  Position field causes data drift (e.g. "Rep" vs "AMTA Rep" vs "AMTA
  Representative"). Convert to dropdown with values: Judge, AMTA
  Representative, Tournament Director, Tab Director, Judge Liaison, Host,
  Volunteer, and "Other (specify)" for edge cases. Pre-work: SQL audit of
  currently-used position values, decide canonical list, then ship. See
  also the design discussion about AMTA Representative as a category vs.
  role.
- **KPI / Data dashboard at `/data`** (renamed from `/dashboard` to avoid
  collision with existing route). 5 metric cards: Active programs, Active
  alumni, Active board members (with director/first-year/second-year
  breakdown), Pending invitations, Recent contact additions (last 90 days).
  Pre-work: (1) need to populate `board_terms` table — currently zero
  rows; (2) `is_test` infrastructure should ship FIRST so the dashboard
  is built filtering on `is_test = false` from day one. Also potentially
  a US state heatmap of active programs once geographic data is populated.
- **Populate geographic data on `programs` table.** Currently 484 programs,
  zero have city / state / website filled. Blocks the heatmap viz. Two
  paths: source a spreadsheet and use the new CSV import flow (if we
  extend it to programs), or build a focused admin tool. Also add a
  `country` field while we're at it (1-2 programs are non-US — Canada,
  South Korea).
- **Admin data-cleanup / dupe-merge tool.** Find duplicate contacts via
  heuristics (email match, name + email-domain match, similar names +
  shared program). Side-by-side comparison UI. Pick fields to keep from
  each. Merge into one record, transferring all associations (categories,
  program affiliations, event_staff, interactions). Independent of any
  import flow — imports flag dupes, this tool resolves them. Full
  session of focused work.
- **External judge signup flow.** Public form at `/judge-signup` mirroring
  `/alumni-signup`. Lands in `judge_claims` table. Admin review queue at
  `/admin/judge-claims`. Approve → creates contact tagged "Judge". Most
  code patterns reusable from alumni-claims feature. ~50% of the build
  effort since infrastructure exists.
- **Mapping UX polish — show first-row preview next to each dropdown.**
  Real-world tournament-host CSVs have 200-character Google Form question
  headers. Current dropdown shows the header text alone, which can be hard
  to identify without context. Show the first row's value next to each
  option (e.g. "Preferred Email Address → mike@example.com") to make
  manual mapping faster on weird CSVs.
- **README update for CSV import.** Add a "Workflow features" section
  between AI Features and "A look around the rest of the app." Document
  the import flow + Add judges deep-link as a peer to AI features, not
  buried in the screenshots tour. Frames the project as showcasing both
  AI fluency AND product-thinking. Pre-work: take clean screenshots in
  good lighting (the import result screen is the money shot). ~30 min.
- **Tighten `alumni_claims` RLS to admin-only.** Current policies let any
  authenticated user read and update claims. Fine while every authenticated
  user is an admin, but a real liability once that stops being true.
- **Combobox UX for the program dropdown on `/alumni-signup`.** 483 native
  `<select>` options is bad UX. Type-ahead combobox.
- **Expand alumni signup form fields.** Needs scoping. Candidates:
  start year (would also fix the affiliation `start_year = end_year`
  tech debt), pronouns, roles within program, current professional
  context.
- **Collapsible sidebar.** Add a toggle to collapse the left sidebar to
  icons-only (or fully hidden). Useful for screen-real-estate-heavy
  pages like the CSV import flow.
- **Self-service profile editing for alumni (Phase 3).** Separate auth
  flow from the admin CRM. Approved alumni get a way to update their own
  info without admin intervention.
- **Sortable lists across Contacts / Programs / Events.** Shared
  `<SortableTable>` component. Bigger refactor than the one-line default
  sort that just shipped.
- **Profile / Settings page (separate from Contact record).** User
  account settings, not the same thing as someone's contact data.
- **CSV import for Programs.** Symmetric to the existing CSV export, and
  the unblock for populating program geographic data.
- **Revamp Home page.** Reduce/remove stats; focus on individual user
  workflow (their tasks, their recent interactions, etc). Data-style
  metrics live on `/data` instead.
- **Officer terms inline edit.** See bug B2.
- **Bulk-assign Current Board Member.** Admin convenience for term
  transitions.
- **Cascade soft-delete for committees, contacts, events.** Currently
  inconsistent — some entities cascade, others don't.
- **Email Draft Generator.** Potential 6th AI feature.

---

## 🟢 LOW

- **Add email consent disclosure to `/alumni-signup`.** "By submitting, you
  agree to receive communications from AMTA about alumni programming."
  Pair with email infrastructure rollout. Current copy is narrower than
  full email opt-in.
- **Find the Chrome extension slowing Supabase calls locally.** Affects
  dev only.
- **Refresh contact-relationships screenshot in the repo README.**
- **Clean up 308 latent TS errors incrementally.**
- **Add `npm run build` step to pre-push workflow.** Vite dev is more
  permissive than Vercel's production build (skips strict TS, doesn't
  catch missing deps in package.json). The papaparse-missing-from-deps
  issue today would have been caught with a local build before push.

---

## 🐛 BUGS

- **B1: ~~Can't delete "Tell me about Maggy Randels" Ask AI
  conversation.~~** RESOLVED AS DIAGNOSIS — turned out to be the
  `active_*` views RLS bypass issue, now in 🔴 HIGH. Maggy's row left in
  place as a visible reminder of the underlying bug.
- **B2: Officer terms can't be edited inline** like other attached
  attributes can. UX inconsistency.
- **B3: Can't remove program affiliation from a Contact page.** Today the
  Contact page punts to the Program page, where there's also no removal
  affordance. Two layers to fix:
  - Add removal UI on the Contact page (probably the right canonical
    location)
  - Confirm whether removal is also missing on the Program page (vs.
    actually broken)
- **B4: Category multi-select dropdown perceived-slow on subsequent
  selections.** When adding multiple categories to a contact, the
  dropdown appears to lag after each chip is added — slow enough that the
  user thinks they need to type a new value rather than pick another
  option. Likely cause: full re-fetch / re-render of the dropdown on each
  selection, instead of debouncing or caching. ~10-min investigation
  should reveal it. Real UX bug — slows down what should be a fast
  multi-tag operation. Visible on the Contact edit form (and probably
  the CSV import map step too).

---

## 💭 Design discussions

These are open product questions that need thinking-through more than
they need coding. Resolution often unlocks several backlog items.

- **AMTA Representative: category or role? (Or both, with a relationship
  constraint?)** Captured May 12, 2026 after noticing the categories
  dropdown is missing "AMTA Representative." Quick-fix instinct was "just
  add it to the categories list." But the real question is whether AMTA
  Rep is the same kind of thing as Alumni / Coach / Donor.
  
  **The ambiguity:**
  - Today's surfaces: Contact categories ("Alumni", "Coach", "Donor",
    "Judge", etc.) are durable traits of who someone *is*. Event staff
    positions ("Judge", "AMTA Representative", "Host", etc.) are roles
    someone plays at a specific event.
  - AMTA Rep doesn't fit cleanly into either. It's not purely durable
    (you serve as Rep at specific tournaments, vetted by AMTA), but it's
    also more stable than "Judge at one event" — once vetted, you're an
    AMTA Rep on an ongoing basis. The central org "hires" / qualifies
    these people; they're not supplied by the host program like staff
    are.
  - Practical impact: CSV exports of "all AMTA Representatives" are a
    real need (mailing them about training, for example). If Rep is only
    a per-event role, you can't export a list of all current Reps; you'd
    have to scrape `event_staff` and dedupe. Awkward.
  
  **Options to think through:**
  1. **Add Rep as a category** (fastest, what the original request was).
     Cleanest data model: Reps are people with the category. Downside:
     loses the connection to specific events they served at.
  2. **Add Rep as a category AND keep it as an event_staff position,
     with a soft validation rule:** "to add someone as AMTA
     Representative on an event, they must have the AMTA Representative
     category." This is the user's instinct in the original conversation.
     Captures both the durable trait AND the per-event role. Validation
     is a check at the form layer, not the schema layer (Postgres can't
     express cross-table category requirements cleanly without
     triggers).
  3. **Treat AMTA Reps as a separate top-level entity on Events** — not
     in the "Staff" section at all, but its own section called "AMTA
     Representatives" (parallel to Staff and Judges). This reflects the
     reality that Reps come from central, Staff comes from host program.
     Option 3 + the option 2 validation rule = a complete model: Reps
     are a category, you assign category-holders to event Rep
     positions, and they show up in a dedicated section on the event.
  4. **Just add the category, don't sweat the modeling.** Pragmatic.
     The "supply chain" distinction (central org vs host program) might
     matter less than the export-list use case, which option 1 already
     solves. Revisit if real workflow pain emerges.
  
  **My current lean:** option 2 (category + position with soft
  validation), with option 3 (separate section on Event) as a later
  refinement when judge counts grow and Event detail pages need real
  re-architecting anyway. Option 4 is genuinely defensible if we don't
  want to over-engineer.
  
  **Dependencies:** if option 2 or 3, this needs to happen alongside
  the "Constrain `event_staff.position` to canonical dropdown" work.
  The position dropdown will include "AMTA Representative," and that's
  where the validation rule would attach.
  
  **Decision needed by:** before shipping the position dropdown work,
  which is a 🟡 MEDIUM item. So no rush, but don't let it linger.

---

## 🧊 ICEBOX

- **Recover alumni-claims-admin-mvp.md spec.** Referenced in May 11 handoff
  but not in this repo. Check the original chat session it was written in.
  Low priority — the feature is built; the spec is only useful for portfolio
  context.
- **Tabbed Event detail UI (v2 for judges).** Once judge counts grow into
  the hundreds-per-event range, consider a tabbed interface on Event
  detail: "Overview" tab (Hosts, Staff, Documents, Projects, Interactions)
  and a "Judges" tab. Eliminates vertical scroll. Currently judges are
  rendered last on the same page, which works at small-to-mid scale.
- **Navigator.locks bug writeup.** Claude drove the diagnostic work; felt
  inauthentic to publish under my name alone.
- **AI summary staleness.** Known issue, no fix scoped.
- **Case file DB feature.** Standalone idea, no current pull.

---

## 📋 To write up

These aren't backlog items — they're docs/portfolio work that should
happen while the details are fresh.

- **RLS debugging bug story (May 12, 2026 morning).** The 403 on
  `/alumni-signup`. Arc: diagnosed the bug correctly on the first
  hypothesis (anon-only INSERT policy, admins blocked), walked it back
  when an "incognito test" seemed to reproduce the bug for anon users
  too, then discovered the incognito browser was still carrying an
  authenticated session (`role: "authenticated"` in the JWT). Original
  diagnosis was right. Lessons: confirm test setup before trusting test
  results; RLS policies are scoped per role; `apikey` and
  `Authorization` headers play different roles in Supabase requests.
- **Postgres views bypassing RLS bug story (May 12, 2026 evening).** The
  "can't delete one conversation" investigation that turned into a real
  security finding. Arc: started as a wine-time minor bug ("delete
  button doesn't work on one specific conversation"), instrumented
  DevTools, found the soft-delete UPDATE was returning 204 with 0 rows
  affected. Suspected RLS UPDATE policy mismatch. Checked the row's
  `auth_user_id` → realized it belonged to *Maggy Randels' own user
  account*, which raised the bigger question: why is her conversation
  in my sidebar in the first place? Read the RLS policies on
  `ai_conversations` (correctly scoped). Read the view definition for
  `active_ai_conversations` → owned by `postgres`. That's the bug:
  views run with the creator's permissions by default, so a postgres-
  owned view bypasses the underlying table's RLS. Likely affects every
  `active_*` view in the schema. Lessons: when RLS policies LOOK
  correct but data is leaking, check the views; "view owner = superuser
  + no `security_invoker` clause" is a security footgun that's easy to
  miss; sometimes the "tiny bug" is the visible tip of a much larger
  architectural issue; choosing to NOT patch the symptom can be the
  right call — a visible reminder of an unfixed bug is better than
  silent technical debt.
- **CSV import StrictMode bug story (May 12, 2026).** Import processing
  hung at "0 of 1" even though all the Supabase calls succeeded. Root
  cause: React 18 StrictMode mounts effects twice in dev. The cleanup
  function flipped a `cancelled` flag between the two mounts, and the
  async work — still running from the first mount — checked the flag
  AFTER finishing and skipped `onComplete`. Result was correct, callback
  was suppressed. Fix: drop the cancelled flag, rely solely on the
  `startedRef` guard. Lessons: StrictMode is friction that catches real
  bugs; for single-shot async work in an effect, refs are cleaner than
  flags.
- **CSV import as a product-design exercise (May 12, 2026).** Started
  as "build CSV import," became a sequence of real product decisions:
  what's the dupe story (exact email match only, additive update on
  match), what's the position default ("Judge" — because the immediate
  use case is judges-to-tournaments), what's the entry-point UX (two
  buttons not split dropdown), what's the row cap (500), how to handle
  tournament-host CSVs with idiosyncratic headers (alias list + manual
  mapping as primary path, not fallback). Each one pushed back on the
  temptation to over-build.
