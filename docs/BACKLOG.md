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

- **Email automation for invitations.** Currently admins copy/paste invite
  links manually. Unblocks the entire "actually onboarding people" flow.

---

## 🟡 MEDIUM

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
  currently-used position values, decide canonical list, then ship.
- **KPI / Data dashboard at `/data`** (renamed from `/dashboard` to avoid
  collision with existing route). 5 metric cards: Active programs, Active
  alumni, Active board members (with director/first-year/second-year
  breakdown), Pending invitations, Recent contact additions (last 90 days).
  Pre-work: need to populate `board_terms` table — currently zero rows.
  Also potentially a US state heatmap of active programs once geographic
  data is populated.
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
- **Delete / retire dev Supabase project** (`wdxgbtwshcmvmiedqjyh`).
  Abandoned; using prod for everything.
- **Refresh contact-relationships screenshot in the repo README.**
- **Clean up 308 latent TS errors incrementally.**
- **Add `npm run build` step to pre-push workflow.** Vite dev is more
  permissive than Vercel's production build (skips strict TS, doesn't
  catch missing deps in package.json). The papaparse-missing-from-deps
  issue today would have been caught with a local build before push.

---

## 🐛 BUGS

- **B1: Can't delete "Tell me about Maggy Randels" Ask AI conversation.**
  Other conversations delete fine; just this one fails.
- **B2: Officer terms can't be edited inline** like other attached
  attributes can. UX inconsistency.
- **B3: Can't remove program affiliation from a Contact page.** Today the
  Contact page punts to the Program page, where there's also no removal
  affordance. Two layers to fix:
  - Add removal UI on the Contact page (probably the right canonical
    location)
  - Confirm whether removal is also missing on the Program page (vs.
    actually broken)

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

- **RLS debugging bug story (May 12, 2026).** The 403 on `/alumni-signup`.
  Arc: diagnosed the bug correctly on the first hypothesis (anon-only
  INSERT policy, admins blocked), walked it back when an "incognito test"
  seemed to reproduce the bug for anon users too, then discovered the
  incognito browser was still carrying an authenticated session
  (`role: "authenticated"` in the JWT). Original diagnosis was right.
  Lessons: confirm test setup before trusting test results; RLS policies
  are scoped per role; `apikey` and `Authorization` headers play
  different roles in Supabase requests.
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
