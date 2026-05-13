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
  - Breakdown: 479 USA / 4 Canada / 1 South Korea
  - Test Program row skipped — will be flagged when `is_test` ships
  - Unblocks the US state heatmap on the upcoming `/data` dashboard
  - Migration: `migrations/20260512_programs_geo_data.sql`
- **"Add judges" deep-link flow on Event detail page** (May 12, 2026)
  - "Add judges" button next to Edit in Event detail header
  - Navigates to `/contacts/import?eventId={id}` with deep-link state
  - Auto-checks "Add to event", pre-selects event, defaults position to
    "Judge", pre-selects the Judge category chip
  - Contextual page reframing; header alias auto-mapping; CSS overflow
    fix for long Google Form headers
- **Contacts CSV import flow** (May 12, 2026)
  - 4-step wizard at `/contacts/import`: upload, map, processing, result
  - Validated with 97-row Claremont CSV (31 had emails, 66 skipped)
  - Spec: `docs/specs/contacts-csv-import-mvp.md`
- **Judges separated from Staff on Event detail page** (May 12, 2026)
- **Alumni claims admin flow Phase 2 complete** (May 11–12, 2026)
- **Contacts list default sort by first name** (May 12, 2026)
- **Public alumni signup form at `/alumni-signup`** (May 11, 2026)
- **Refresh-bounce navigator.locks bug fixed** (May 11, 2026)
- **Dev/prod Supabase env mismatch fixed** (May 11, 2026)

---

## 🔴 HIGH

- **🔒 SECURITY: `active_*` views bypass RLS — cross-user data leak.**
  Discovered May 12, 2026 investigating bug B1 ("can't delete Maggy
  Randels conversation").
  
  **Root cause:** Postgres views run with the *creator's* permissions by
  default. `active_ai_conversations` (and almost certainly every other
  `active_*` view) is owned by `postgres` (superuser), which bypasses
  RLS on the underlying table. Authenticated users querying the view see
  ALL rows, not just `auth_user_id = auth.uid()` rows.
  
  **Evidence:** RLS policies on `ai_conversations` correctly filter on
  `auth_user_id = auth.uid()`. But admin user sees Maggy Randels'
  conversation (separate auth user `32c79ee5-134f-49ba-ac67-38033f0bc94e`).
  COUNT on the table = 2; sidebar shows 2 = admin is seeing everyone's
  conversations. View owner = `postgres` (confirmed via pg_views).
  
  **Scope:** Likely affects all `public.active_*` views — `active_contacts`,
  `active_events`, `active_committees`, `active_contact_categories`,
  `active_event_documents`, `active_event_hosts`, `active_event_staff`,
  `active_invitations`, `active_officer_terms`, `active_program_a*`,
  others.
  
  **Not currently an incident:** Jacinth is the only real user. Becomes
  a real incident once a second user logs in.
  
  **Fix:** Audit every `public.active_*` view; recreate with
  `WITH (security_invoker = on)`. Single migration. Test pass on every
  feature reading from active_* views. Document gotcha in migration
  comment so future views don't repeat the pattern.
  
  **Symptom artifact preserved:** Maggy's conversation
  (`d953c4cb-e50f-490e-b2ee-89038eadf019`) NOT deleted from DB. Still
  shows in sidebar, still un-deletable from UI. Visible reminder until
  the proper fix lands.
  
  **Replaces bug B1.**

- **Email automation for invitations.** Currently copy/paste manual.
  Unblocks onboarding flow. Don't onboard new users until views RLS
  bypass is fixed.

---

## 🟡 MEDIUM

- **🧪 Test-data infrastructure: `is_test` flag on programs and contacts.**
  No clean way to test features without polluting real stats. Ship
  BEFORE the KPI dashboard.
  
  **Schema:** `is_test boolean NOT NULL DEFAULT false` on programs +
  contacts. Backfill: three known test contacts + Test Program row
  (id `84e894f3-62e5-4802-86cc-fc366e621f6a`, deliberately skipped
  in the May 12 geo migration). Create Midlands State University as
  `is_test = true`.
  
  **Surfaces that must filter `is_test = false`:**
  - Stats / counts (dashboard, Home widgets) — never include test
  - List pages — default exclude; settings toggle to show
  - Detail pages — show with "TEST" badge
  - AI features (Ask AI, summaries, briefs) — never include test
  - CSV export — include `is_test` as a column
  - CSV import — new rows default to false
  
  **UI:** TEST badge (zinc-100 bg, zinc-700 text), settings toggle,
  optional `/admin/test-data` route.
  
  **Scope:** 2-3 hours focused. Migration + backfill + list filters +
  stats filters + AI filters + UI + test pass.

- **🧾 Export "all" vs "current view" + upcoming pagination for
  Contacts.** Today exports = `rows={filtered}`. Pagination is coming;
  the mental model needs to be decided before that ships.
  
  **Three options:**
  1. Toggle in the export modal (Export all / Export filtered)
  2. Export always means "everything matching filter, ignoring
     pagination" *(current lean — cleanest mental model)*
  3. Hybrid: filter-matched default + "Clear filters and export all"
  
  **Scope:** 2-3 hours including pagination, less if just export.
  Touches ExportCsvButton (may need a `fetchAllRows()` callback) and
  whatever pagination component lands.

- **Add seasonal dimension to committee assignments + board membership.**
  AMTA operates on July-June seasons. Add `season` column to
  `committee_assignments`. Same pattern for board membership. Split
  Contact page into "Current committees" / "Past committees."
  Half-day to full-day. Also implicates bug B2.

- **Constrain `event_staff.position` to a canonical dropdown.** Avoids
  free-text drift. Values: Judge, AMTA Representative, Tournament
  Director, Tab Director, Judge Liaison, Host, Volunteer, Other. See
  AMTA Rep design discussion.

- **KPI / Data dashboard at `/data`.** 5 metric cards: Active programs,
  Active alumni, Active board members, Pending invitations, Recent
  contact additions. Pre-work: (1) populate `board_terms` table
  (currently empty); (2) ship `is_test` first. Geo data DONE — heatmap
  unblocked.

- **Admin data-cleanup / dupe-merge tool.** Heuristic dupe detection
  (email match, name + email-domain, similar names + shared program).
  Side-by-side comparison. Merge transferring all associations. Full
  session of focused work.

- **External judge signup flow.** Public form at `/judge-signup`, mirrors
  `/alumni-signup` patterns. ~50% effort since infra exists.

- **Mapping UX polish — show first-row preview next to each dropdown.**
  Helps with idiosyncratic CSV headers.

- **README update for CSV import.** "Workflow features" section with
  proper screenshots. ~30 min.

- **Tighten `alumni_claims` RLS to admin-only.**

- **Combobox UX for the program dropdown on `/alumni-signup`.** 483
  options in a native `<select>` is bad UX.

- **Expand alumni signup form fields.** Specific candidates:
  - **Pronouns** (newly captured)
  - **Start year** (also fixes the `start_year = end_year` tech debt)
  - Roles within program
  - Current professional context
  - Decision: required vs optional per field. Default to optional
    except start year.

- **Collapsible sidebar.** Toggle to collapse to icons-only.

- **Self-service profile editing for alumni (Phase 3).**

- **Sortable lists across Contacts / Programs / Events.** Shared
  `<SortableTable>`.

- **Profile / Settings page** separate from Contact record.

- **CSV import for Programs.** Symmetric to existing export. No longer
  urgent since geo data was loaded via SQL migration, but worth building.

- **Revamp Home page.** Focus on user workflow, not stats. Stats go to
  `/data`.

- **Officer terms inline edit.** See bug B2.

- **Bulk-assign Current Board Member.**

- **Cascade soft-delete for committees, contacts, events.**

- **Email Draft Generator.** Potential 6th AI feature.

---

## 🟢 LOW

- **Standardize button heights across action rows.** Visible on
  Programs: ExportCsvButton (`px-2.5 py-1.5 text-sm`) is shorter than
  PrimaryButton. Same baseline mismatch on Contacts but masked by
  Import button bridging visually. Fix: measure PrimaryButton in
  `src/components/Buttons.tsx`, update ExportCsvButton + Import to
  match, optional `<SecondaryButton>` primitive. 20-30 min focused.

- **Add email consent disclosure to `/alumni-signup`.**

- **Find Chrome extension slowing Supabase calls locally.** Dev only.

- **Refresh contact-relationships screenshot in README.**

- **Clean up 308 latent TS errors incrementally.**

- **Add `npm run build` step to pre-push workflow.** Catches the
  Vercel-strict-vs-Vite-permissive class of bugs locally.

---

## 🐛 BUGS

- **B1:** ~~Can't delete Maggy Randels conversation~~ RESOLVED AS
  DIAGNOSIS — `active_*` views RLS bypass (now 🔴 HIGH).
- **B2:** Officer terms can't be edited inline.
- **B3:** Can't remove program affiliation from a Contact page. Two
  layers (Contact page UI missing; Program page also broken/missing).
- **B4:** Category multi-select dropdown perceived-slow on subsequent
  selections. ~10-min investigation should reveal it.

---

## 💭 Design discussions

- **AMTA Representative: category or role? (Or both, with a
  relationship constraint?)** Quick-fix instinct was "add to categories
  list." Real question: is AMTA Rep a durable trait (like Alumni) or a
  per-event role (like Judge at one event)? Practical answer: both, but
  the modeling matters.
  
  **Four options:**
  1. Just add Rep as a category. Loses event-level connection.
  2. Category + position with soft validation rule: "to add someone as
     AMTA Rep on an event, they must have the category." *(Lean.)*
  3. Treat AMTA Reps as a separate top-level entity on Events
     (parallel to Staff and Judges), reflecting central-vs-host supply.
  4. Just add the category, don't sweat the modeling. Defensible.
  
  **Lean:** option 2, with option 3 as later refinement when judge
  counts grow.
  
  **Dependencies:** if option 2 or 3, do this alongside the position
  dropdown work. Decision needed by then.

- **📧 Secondary email on contacts: how do we model it?** Two converging
  use cases: alumni (school + personal), workspace + personal in
  general.
  
  **Five open questions:**
  1. One extra column or related `contact_emails` table? *(Lean: start
     simple, migrate later if needed.)*
  2. Label scheme — school/personal, work/personal, free-text?
     *(Lean: implicit if one column; small dropdown if relational.)*
  3. Which email is primary and what's it operationally? *(Primary =
     list view + dupe detection key + AI surfacing.)*
  4. Alumni signup form: "second email (optional)" or labeled "School
     email" + "Personal email"? *(Lean: labeled fields.)*
  5. Migration: existing email becomes primary. No backfill needed.
  
  **Scope:** Simple = 1-2 hours. Flexible (related table) = 4-6 hours.
  
  **Decision needed by:** before expanding alumni signup form.

- **📚 Institutional memory: communications archive vs. richer
  Interactions.** Captured May 12, 2026. What started as "let's add
  attachments to Interactions" is actually a bigger question about
  what the CRM is FOR.
  
  **The framing:** AMTA's comms happen in Gmail and Mailchimp; those
  will continue. The real pain: *board accounts turn over, Mailchimp
  campaigns get hard to find years later, "what did we send to alumni
  last May?" requires institutional knowledge that walks out the door*.
  The CRM could be the institutional memory layer that survives
  successions.
  
  **Use case crystallized:** "Next year when I'm writing the 2027
  board election results email, I want to find the 2026 version,
  duplicate it, tweak the date." Same for annual judge thank-you's,
  alumni newsletters, etc. This is a *playbook* / *template library*
  with audience context, not an email client.
  
  **Key insight: curation, not capture.** Most logged comms will be
  reusable templates worth preserving. Selectively log the
  annual/quarterly/event-tied ones; ignore the ephemeral or
  confidential ones.
  
  **Three threads in the original ask, separated:**
  
  *Thread 1: Richer Interaction records.* Today probably
  `{contact_id, date, type, notes}`. Ask: PDF/HTML upload (Gmail or
  Mailchimp export), pasted email body, to/from/cc/bcc.
  
  *Thread 2: Contact groups for multi-contact logging.* Today
  Interaction is per-contact. AMTA has real distribution lists
  (board-all@, alumni list). Manual attachment to 30 contacts is
  friction.
  
  *Thread 3: Different mental model.* Per-contact ("I emailed Mike")
  vs. broadcast-level ("we sent X to all current board members"). Same
  entity or different?
  
  **Existing-infrastructure check (important):** Before adding a new
  "contact group" concept, check whether existing groupings serve:
  - "All current board members" → `category = 'Current Board Member'`
  - "Budget Committee" → committee assignment
  - "All alumni" → `category = 'Alumni'`
  - "Judges for Claremont 2026" → event_staff for that event
  
  If existing groupings handle ~90% of cases, what's needed is an
  Interaction (or Communication) that targets a *query* (category,
  committee, event), NOT a new "contact group" entity. Need 3+ real
  examples of ad-hoc groups that don't fit before adding the entity.
  
  **Four options:**
  
  1. **Enhanced Interaction (lightweight).** Keep Interaction; add
     file attachment, formatted body, optional audience reference
     (category / committee / event). One Interaction can be a
     broadcast. Appears on each audience member's contact page.
     - Pros: smallest change; reuses existing concepts; fits curation
     - Cons: Interactions get overloaded (1:1 + broadcast in same
       table)
  
  2. **New "Communications" / "Campaigns" entity.** First-class archive
     of broadcasted comms. Title, date, sender, body, attachments,
     audience (category / committee / event filter). Browsable at
     `/communications`. Contacts get a "Received campaigns" tab.
     - Pros: clean separation; playbook library; fits "succession
       knowledge" framing
     - Cons: real schema work; two overlapping concepts admins must
       learn
  
  3. **Both, with different intents.** Interactions stay 1:1.
     Campaigns are broadcast archive. No overlap.
     - Pros: each concept clear
     - Cons: most work; admins learn distinction
  
  4. **Just attach files to Interactions, skip groups.** Minimum viable.
     Jacinth logs against herself or a representative contact. Doesn't
     solve audience context. May be enough for v1.
     - Pros: ships fast
     - Cons: loses audience context value
  
  **Lean:** option 2 (separate Communications entity) IF/WHEN this is
  built. The "institutional memory that survives successions" framing
  suggests this artifact deserves a first-class home, not a corner of
  Interactions. Title + attachments + searchable body + audience
  reference is a fundamentally different artifact than "I called Mike
  on Tuesday."
  
  **Open questions before building:**
  - Concrete examples of comms worth archiving (annual board election,
    judge thank-yous, alumni newsletter, donor solicitations, what
    else?) — confirms the playbook framing
  - Is search-by-content needed, or is browse-by-date/audience enough?
    Full-text search is a real bump in implementation cost.
  - How much metadata per record? Title + body + attachments + audience
    + date + sender? More than that = form fatigue.
  - Does Mailchimp have an API export that could automate the capture,
    or is this all manual upload? Manual is fine for v1 but worth
    knowing.
  
  **Decision needed by:** not blocking anything else right now. But
  notable: this kind of feature is high-leverage for the
  "useful-tool-vs-portfolio-toy" narrative. Worth doing properly when
  the time comes.

---

## 🧊 ICEBOX

- **Allow emailless contacts (or a different entity for them).**
  Surfaced May 12, 2026 from Claremont CSV import: 97 judges, only 31
  with emails, 66 skipped.
  
  **Three real paths:**
  1. Make email optional. Breaks dupe detection. Accumulates duplicates
     over time.
  2. Separate "Event Participants" / "Anonymous Judges" entity. Adds
     schema complexity.
  3. Stay strict; improve import surface (group "skipped, no email"
     rows, downloadable CSV, admin follows up offline). *(Lean.)*
  
  **Lean:** option 3 — incomplete-source-data problem, not schema
  problem. Weakening Contacts identity model compounds badly at scale.
  
  **Questions before deciding:** plan to reach out to those 66? Would
  hosts send follow-up CSVs with emails? Is there an AMTA workflow
  requiring "who judged what" without contactability?

- **Recover alumni-claims-admin-mvp.md spec.** Low priority since
  feature is built.

- **Tabbed Event detail UI (v2 for judges).** When judge counts grow
  into hundreds-per-event. Currently judges-last on same page works at
  small-to-mid scale.

- **Navigator.locks bug writeup.** Felt inauthentic to publish under
  user name alone.

- **AI summary staleness.** Known issue, no fix scoped.

- **Case file DB feature.** No current pull.

---

## 📋 To write up

Docs/portfolio work to capture while fresh.

- **RLS debugging bug story (May 12 morning).** The 403 on
  `/alumni-signup`. Correct first hypothesis, walked back wrongly when
  "incognito test" seemed to reproduce, discovered incognito was
  carrying an authenticated session. Lessons: confirm test setup
  before trusting results; RLS scoped per role; apikey vs Authorization
  headers in Supabase.

- **Postgres views bypassing RLS bug story (May 12 evening).** Started
  as "delete button doesn't work." DELETE returns 204 (UPDATE 0 rows
  affected via RLS). Row's auth_user_id belongs to Maggy Randels' user
  account → real question becomes "why is her conversation in my
  sidebar." RLS policies correct. View owner = `postgres` (superuser),
  bypasses RLS by default. Likely affects every `active_*` view.
  Lessons: when RLS LOOKS correct but data leaks, check the views;
  superuser-owned view + no `security_invoker` is a real footgun;
  "tiny bug" was tip of architectural issue; choosing NOT to patch the
  symptom can be right.

- **CSV import StrictMode bug story (May 12).** Processing hung at
  "0 of 1" despite successful Supabase calls. React 18 StrictMode
  double-mount + cleanup flag race. Fix: drop the flag, use startedRef.
  Lessons: StrictMode catches real bugs; for single-shot async,
  refs > flags.

- **CSV import as product-design exercise (May 12).** Dupe story
  (email match → additive), position default (Judge), entry-point UX
  (two buttons not split dropdown), row cap (500), tournament-host
  CSV alias system. Each decision pushed back on over-build.
