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

Last updated: May 12, 2026 (evening session, post-dinner additions)

---

## ✅ Recently shipped

- **Programs geographic data populated** (May 12, 2026)
  - Added `country text NOT NULL DEFAULT 'USA'` column to `programs`
  - Updated city, state, website, country for 483 of 484 programs from
    a curated CSV dataset
  - Breakdown: 479 USA / 4 Canada (Guelph, McGill, Toronto, York) /
    1 South Korea (Ewha Womans University)
  - Test Program row skipped — will be flagged when `is_test`
    infrastructure ships
  - Unblocks the US state heatmap on the upcoming `/data` dashboard
  - Migration: `migrations/20260512_programs_geo_data.sql`
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
    26 columns (Google Form export with idiosyncratic headers). Of the
    97, only 31 had emails and were imported — the remaining 66 were
    skipped due to missing email. Whether to handle emailless contacts
    differently is now an ICEBOX item.
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
  - Also retroactively flag the "Test Program" row (id
    `84e894f3-62e5-4802-86cc-fc366e621f6a`) which was deliberately left
    out of the May 12 geo-data migration for this reason.
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

- **🧾 Export "all" vs "current view" + upcoming pagination for
  Contacts.** Surfaced May 12, 2026 from real usage. Two related
  concerns:
  
  **Issue 1: Export scope.** Today, both the Programs and Contacts CSV
  export buttons export `rows={filtered}` — whatever the current filter
  matches. That means: if filters / search are applied, export reflects
  them; if "All" is selected and no search, export includes everything.
  Technically you CAN export all by clearing filters first, but that's
  friction and not obvious. Real-world need: "give me a CSV of all my
  programs" without re-deriving the right filter state. Worth making
  this explicit in the export modal.
  
  **Issue 2: Contacts pagination is coming.** Once contacts grow into
  the thousands (post-CSV-imports, post-judge-signup-flow), the page
  won't render all rows at once. The mental model of "export the
  current view" gets confusing — is that the current PAGE or the
  current FILTERED SET? Worth deciding before pagination ships, not
  after.
  
  **Options for the export UX (need to pick one):**
  1. **"Export all" vs "Export filtered" toggle in the modal.** Explicit,
     user picks. Default to filtered (current behavior).
  2. **Export always means "everything matching the filter, ignoring
     pagination."** Cleanest mental model — filters narrow, pagination
     only affects rendering. The export query re-fetches without
     pagination limits. *(Current lean — least surprising for most users.)*
  3. **Hybrid: "filter-matched" by default with a "Clear filters and
     export all" affordance for the common case.** More UI work,
     potentially most user-friendly.
  
  **Scope when picked up:**
  - Decide option (probably 2, but worth confirming once pagination is
    in scope)
  - For pagination: implement infinite scroll or page numbers on
    Contacts. Apply same pattern to Programs if it grows similarly.
  - For export: ensure the export query re-fetches the full filtered
    set, not just the visible page
  - Update ExportCsvButton if needed to take a `fetchAllRows()` async
    callback rather than just receiving `rows`
  - Visual indicator of how many rows will be exported (the modal
    already shows this — just need it to reflect the full count, not
    the page count)
  
  Estimated: 2-3 hours including pagination, less if just export work.

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
  is built filtering on `is_test = false` from day one. Geographic data
  on programs is DONE (May 12) — heatmap viz is unblocked.
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
- **Expand alumni signup form fields.** Candidates with specific calls:
  - **Pronouns** (newly captured — clear ask, low ambiguity)
  - **Start year** (would also fix the affiliation
    `start_year = end_year` tech debt on the existing form)
  - Roles within program (board member? captain? competitor?)
  - Current professional context (career field, job title)
  - Decision: which fields are required vs optional? Form length
    affects completion rate. Default to optional except start year.
  - Schema change: pronouns probably wants its own `text` column on
    `contacts` (other fields may already exist or have natural homes).
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
- **CSV import for Programs.** Symmetric to the existing CSV export.
  Note: geographic data was populated via SQL migration on May 12, so
  this is no longer urgent — but the symmetric capability is still
  worth building.
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

- **Standardize button heights across action rows (PrimaryButton +
  ExportCsvButton + Import CSV button).** Visible on Programs list: the
  ExportCsvButton (`px-2.5 py-1.5 text-sm`) is noticeably shorter than
  the PrimaryButton "New program." Same baseline mismatch exists on
  Contacts but is less visible because the Import CSV button (also
  sized to match Export) bridges the gap visually. The fix isn't
  "make Export bigger on Programs" — it's a shared-component sizing
  decision that should be made once and applied consistently.
  
  **Approach when picked up:**
  1. Decide canonical secondary-button dimensions to match PrimaryButton's
     height. Likely `px-3 py-2 text-sm font-medium` or thereabouts —
     measure from the actual PrimaryButton implementation in
     `src/components/Buttons.tsx`.
  2. Update `ExportCsvButton.tsx` to use that sizing.
  3. Update the inline Import CSV button in `ContactsListPage.tsx` to
     match (they were explicitly mirrored earlier; keep them mirrored).
  4. Visual check on both Contacts and Programs list pages.
  5. Optional: extract a shared `<SecondaryButton>` primitive so future
     secondary actions don't drift.
  
  ~20-30 min when done with focus. NOT a wine-time fix because it touches
  shared components and benefits from doing right.
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

- **📧 Secondary email on contacts: how do we model it?** Captured
  May 12, 2026 from two converging use cases that surfaced this evening:
  
  **The use cases:**
  - **Alumni:** college contacts often have both a school email
    (`@university.edu`, while they were a student) and a personal email
    (`@gmail.com` or similar, persists after graduation). When alumni
    graduate, the school email goes dead, but it's often the best
    "identity verification" for matching them to historical records.
    Personal email is the one that actually reaches them long-term.
    Both are valuable to capture.
  - **Personal/workspace email distinction:** referenced in earlier
    conversation but not detailed — likely covers cases where a contact
    has a work email (often their Google Workspace) and a personal
    email, and admin communication may route differently depending on
    purpose.
  
  **What questions this raises:**
  
  *1. Is "secondary email" one field or one of many "additional
  emails"?*
  - Simple: one extra `secondary_email` column. Easy. Covers 95% of
    cases.
  - Flexible: a related `contact_emails` table with rows like
    `{contact_id, email, label, is_primary}`. Handles people with 3+
    emails (rare but real — some alumni have school + personal +
    current workplace).
  - **Lean:** start simple (one column) unless we see real-world
    contacts with 3+ emails right now. Migrate to a table later if
    needed.
  
  *2. What's the label scheme?*
  - For alumni context: "School" vs "Personal" makes sense
  - For general context: "Work" vs "Personal" is more common
  - Want both? Or a free-text label per row?
  - **Lean:** if we ship the simple version (one extra column), the
    label is implicit ("primary" and "secondary" — no explicit field).
    If we ship the flexible version, support labels but seed them
    with a small dropdown of common values + "Other (specify)".
  
  *3. Which email is "primary" — and what does that mean operationally?*
  - The primary email is what shows in the Contacts list, what gets
    used as the dupe-detection key during CSV import, and what's
    surfaced in AI-generated content (e.g. meeting briefs).
  - Secondary is supplementary — visible on the detail page but not
    the primary identity.
  - Edge case: what happens during CSV import if a row's email matches
    someone's SECONDARY email but not primary? Probably treat as
    matched (additive update), but flag in the result UI ("matched
    on secondary email") so admin can verify.
  
  *4. What about the alumni signup flow specifically?*
  - Alumni form currently asks for one email. Add a "second email
    (optional)" field? Or two clearly-labeled "School email" and
    "Personal email" fields?
  - **Lean:** "School email" + "Personal email" labels are more
    intuitive for the alumni use case. Even if the underlying schema
    is generic, the form can label them domain-appropriately.
  
  *5. Migration story?*
  - Existing contacts have one email. Migration: existing email
    becomes the "primary" — no data loss.
  - Backfill: zero. New field defaults to NULL.
  
  **Scope:** Depends on which path:
  - Simple (one extra column): 1-2 hours total. Migration, schema
    type, form field on contact edit, display on contact detail page,
    update CSV import / export to include it.
  - Flexible (related table): 4-6 hours. Same surfaces as above, plus
    UI for adding/removing emails dynamically, plus dupe-detection
    logic that considers all emails.
  
  **Decision needed by:** before expanding the alumni signup form (the
  "Expand alumni signup form fields" backlog item). The school/personal
  email decision is most actionable in that flow.

---

## 🧊 ICEBOX

- **Allow emailless contacts (or a different entity for them).**
  Surfaced May 12, 2026 after the Claremont CSV import: 97 judges in
  the CSV, only 31 had emails, 66 skipped. Real question: should the
  CRM accept contacts without email so we preserve the historical
  record of who judged what?
  
  **Today's behavior:** Email is functionally a required field and the
  unique identifier for dupe detection on CSV import.
  
  **Three real paths if we want to change this:**
  1. **Make email optional on contacts.** Highest data preservation,
     but breaks the dupe-detection model (need a fallback like
     name + program). Risks duplicate records accumulating over time
     for the same real person.
  2. **Separate "Event Participants" / "Anonymous Judges" entity** —
     a simpler record (name + event + role) without the full contact
     treatment. Preserves the historical signal without weakening the
     Contacts model. Adds schema complexity.
  3. **Stay strict; improve the import surface.** Keep email required,
     but make the CSV import result group "skipped (no email)" rows
     distinctly with a downloadable CSV. Admin follows up offline to
     collect missing emails, then re-imports. Data isn't lost, it's
     deferred to a complete import.
  
  **Current lean (when this gets revisited):** option 3. The 66 missing
  emails are an incomplete-source-data problem, not a schema problem.
  Weakening the Contacts identity model now will compound badly as
  data volume grows.
  
  **Questions worth answering before deciding:**
  - Do we actually plan to reach out to these 66 judges, or are they
    one-off volunteers?
  - Would tournament hosts send a follow-up CSV with emails if asked?
  - Is there an AMTA workflow that depends on knowing "who judged
    what" historically, regardless of contactability?

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
