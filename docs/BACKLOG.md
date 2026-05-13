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

Last updated: May 13, 2026 (end of day — six ships)

---

## ✅ Recently shipped

- **📧 Secondary email field across the CRM** (May 13, 2026)
  - One column on `contacts` (and matching column on `alumni_claims`),
    not a related `contact_emails` table. Two emails covers vast
    majority of cases.
  - Generic primary/secondary labeling — no type field, user picks which
    is primary. Scales to work/personal, school/personal, etc.
  - `secondary_email` NOT unique-constrained. Secondary is supplementary;
    primary remains canonical. Avoids weird "I can't add Mary's
    personal because Bob has it as his primary" states.
  - Dupe detection across both columns in CSV import. Same person
    reached via different channels = still the same person.
  - Ask AI: new `email_query` input on `search_contacts` searches BOTH
    columns via PostgREST `.or()`. Whether user gives Claude the work
    email or personal email, it finds the contact.
  - UI:
    - `ContactForm` has primary email + secondary email fields with
      email-format validation on both.
    - `ContactDetailPage` shows secondary email below primary in Hero,
      visually subordinate (smaller icon, dimmer text), tooltips
      clarify which is which.
    - `/alumni-signup` has a "Secondary email (optional)" field with
      hint text. Reviewing admin sees both when approving.
  - Migrations: `20260513_secondary_email.sql` (contacts + view
    recreate), `20260513_alumni_claims_secondary_email.sql` (no view
    needed for alumni_claims).
  - Side note: This was the 2nd-3rd instance of the active_* view
    column-drift problem in one day. RLS audit became actually
    necessary, not just theoretical.

- **🔘 Action-row buttons use SecondaryButton component** (May 13, 2026)
  - Inline Import button and ExportCsvButton trigger replaced with the
    existing `<SecondaryButton>` component. Heights and weights now
    consistent across action rows.

- **🪟 Collapsible sidebar** (May 13, 2026)
  - 232px expanded / 56px collapsed (icons only) with smooth 150ms
    transition. State persists in localStorage. Tooltips on every icon.
    Search becomes icon button when collapsed. Admin pending-claims
    pill becomes a maroon dot.

- **🎨 /data heatmap custom tooltip + hover polish** (May 13, 2026)
  - Custom React tooltip follows cursor with brand styling. Hover
    darkens state stroke to brand maroon. Pointer cursor signals
    interactivity. Singular/plural noun handling.

- **📊 KPI / Data dashboard at `/data`** (May 13, 2026)
  - Three metric cards: Active programs, Active alumni, Current board
    members. US state heatmap with Programs/Alumni toggle. Alumni
    rolls up via program's state. Test contacts excluded everywhere.
  - Side fix: `active_programs` view recreated to expose `country`
    (column was added to base table on May 12 but view didn't auto-
    update — same pattern that bit us multiple times today).

- **🧪 Test-data infrastructure via Test category** (May 13, 2026)
  - Reuses existing categories infrastructure. Shared helper at
    `src/lib/test-data.ts`. Contacts list filters by default with
    admin toggle. Ask AI server-side filter (unconditional, no toggle
    respect). Direct lookups intentionally bypass.

- **Programs geographic data populated** (May 12, 2026)
- **"Add judges" deep-link flow on Event detail page** (May 12, 2026)
- **Contacts CSV import flow** (May 12, 2026)
- **Judges separated from Staff on Event detail page** (May 12, 2026)
- **Alumni claims admin flow Phase 2 complete** (May 11–12, 2026)
- **Contacts list default sort by first name** (May 12, 2026)
- **Public alumni signup form at `/alumni-signup`** (May 11, 2026)
- **Refresh-bounce navigator.locks bug fixed** (May 11, 2026)
- **Dev/prod Supabase env mismatch fixed** (May 11, 2026)

---

## 🔴 HIGH

- **🔒 SECURITY: `active_*` views bypass RLS — cross-user data leak.**
  Discovered May 12, 2026 investigating bug B1. Three instances of the
  related column-drift problem hit on May 13 alone.
  
  **Root cause:** Postgres views run with the *creator's* permissions by
  default. `active_*` views are owned by `postgres` (superuser), which
  bypasses RLS on the underlying table. Authenticated users querying
  the view see ALL rows, not just `auth_user_id = auth.uid()` rows.
  
  **Scope:** Likely affects all `public.active_*` views.
  
  **Compounding problem:** Postgres views don't auto-update their
  column lists when the underlying table changes. Three instances of
  this hit on May 13 alone:
  1. `active_programs` missing `country` (added to base May 12)
  2. `active_contacts` missing `secondary_email` (added today)
  3. `active_contacts` accidentally missing `profile_photo_url` and
     `is_admin` during recovery from a botched view recreate
  
  Each instance is its own manual fix. Some are caught fast (`/data`
  returning 400 on launch), some lurk (sidebar admin section silently
  hidden because `is_admin` not in view). The RLS audit needs to be a
  column-completeness audit too.
  
  **Not currently an incident:** Jacinth is the only real user. Becomes
  a real incident once a second user logs in.
  
  **Fix:** Audit every `public.active_*` view; recreate with
  `WITH (security_invoker = on)` AND a full column list from the
  underlying table. Single migration. Test pass on every feature
  reading from active_* views.
  
  **NEXT UP (May 14 priority).**

- **Email automation for invitations.** Currently copy/paste manual.
  Unblocks onboarding flow. Don't onboard new users until views RLS
  bypass is fixed.

---

## 🟡 MEDIUM

- **🧾 Export "all" vs "current view" + upcoming pagination for
  Contacts.** Three options laid out; current lean = "export always
  means everything matching filter, ignoring pagination."

- **Add seasonal dimension to committee assignments + board membership.**
  AMTA operates on July-June seasons. Add `season` column. UI: split
  Contact page into "Current committees" / "Past committees." See
  Design Discussions for the open scope question.

- **Constrain `event_staff.position` to a canonical dropdown.** Avoids
  free-text drift. See AMTA Rep design discussion.

- **Populate `board_terms` table + flesh out board member breakdown.**
  Currently empty. Once populated, the Active Board Members card on
  `/data` can show director / first-year / second-year breakdown.

- **Admin data-cleanup / dupe-merge tool.** Heuristic dupe detection.
  Side-by-side comparison. Now needs to handle dedup across primary
  AND secondary email (added today as a follow-on consideration).

- **External judge signup flow.** Public form at `/judge-signup`,
  mirrors `/alumni-signup` patterns. Now also gets secondary email
  capture for free.

- **Mapping UX polish — show first-row preview next to each dropdown.**

- **README update for CSV import.** "Workflow features" section with
  proper screenshots. ~30 min.

- **Tighten `alumni_claims` RLS to admin-only.**

- **Combobox UX for the program dropdown on `/alumni-signup`.** 483
  options in a native `<select>` is bad UX.

- **Expand alumni signup form fields.** Specific candidates:
  - **Pronouns** (already captured)
  - **Start year** (also fixes the `start_year = end_year` tech debt)
  - **Current city / state** (newly captured May 13). Today, an alum's
    geo identity rolls up via their program's state — Yale alum = CT
    even if they live in California. Add `current_state` (and
    optionally `current_city`) column on `contacts`. Once populated,
    the alumni heatmap on `/data` could toggle between "by program
    state" and "by current state" for a richer view.
  - Roles within program (board member? captain? competitor?)
  - Current professional context (career field, job title)
  - ~~Secondary email~~ SHIPPED May 13 as standalone feature.

- **CSV import for Contacts: handle secondary_email column.** The
  alumni signup form captures secondary email but the CSV import
  pipeline doesn't currently expose secondary_email as a mappable
  column. When importing alumni rosters that include both school and
  personal emails, the import would currently drop secondary. Add it
  to the field mapper UI and import logic. ~30 min.

- **CSV export for Contacts: include secondary_email column.** Same
  feature parity — secondary should be exportable since it's
  importable and exists on the record. ~10 min.

- **Click-through from `/data` heatmap to filtered list pages.** Map
  signals interactivity (cursor pointer + hover stroke); only the
  navigation wiring is missing. Pre-work: add state filtering to
  `/programs` and `/contacts` list pages.

- **Self-service profile editing for alumni (Phase 3).**

- **Sortable lists across Contacts / Programs / Events.** Shared
  `<SortableTable>`.

- **Profile / Settings page** separate from Contact record.

- **CSV import for Programs.** Symmetric to existing export.

- **Revamp Home page.** Focus on user workflow, not stats. Stats now
  live at `/data`.

- **Officer terms inline edit.** See bug B2.

- **Bulk-assign Current Board Member.**

- **Cascade soft-delete for committees, contacts, events.**

- **Email Draft Generator.** Potential 6th AI feature.

---

## 🟢 LOW

- **`api/meeting-brief.ts` test-data filter follow-up.** Rarely used
  portfolio piece; mirror the pattern from `api/ask.ts` if usage grows.

- **`api/meeting-brief.ts` and `api/contact-summary.ts` secondary
  email visibility.** As of May 13, only `api/ask.ts` returns the
  secondary email column. If meeting-brief or contact-summary surface
  contact info in their AI output, they should also expose secondary
  for completeness. Small change, mirror what ask.ts does.

- **`/data` heatmap tooltip viewport-edge flipping.** Tooltip can spill
  off-screen near right/bottom edges. ~15 min.

- **Add email consent disclosure to `/alumni-signup`.**

- **Find Chrome extension slowing Supabase calls locally.** Dev only.

- **Refresh contact-relationships screenshot in README.**

- **Clean up 308 latent TS errors incrementally.**

- **Add `npm run build` step to pre-push workflow.**

---

## 🐛 BUGS

- **B1:** ~~Can't delete Maggy Randels conversation~~ RESOLVED AS
  DIAGNOSIS — `active_*` views RLS bypass (now 🔴 HIGH).
- **B2:** Officer terms can't be edited inline.
- **B3:** Can't remove program affiliation from a Contact page.
- **B4:** Category multi-select dropdown perceived-slow.
- **B5:** Pre-existing auth users don't auto-resolve their pending
  invitations. Jacinth is mid-diagnostic (sending Warihay the invite
  link to see if the flow resolves it).

---

## 💭 Design discussions

- **AMTA Representative: category or role?** Four options; lean is
  "category + position with soft validation." Decision needed before
  position dropdown work.

- **📅 Seasons concept: how do we model July-June years?** Captured
  May 13. Today's data has no notion of "this committee no longer
  exists" or "this person served in 2023-24 vs 2024-25." Real
  question whether seasons are:
  
  1. **Just a label on existing rows** (cheap — add `season` column
     to committee_assignments, officer_terms, etc.)
  2. **A schema branch** (committees themselves exist per-season; a
     committee in 2024-25 is a different record from the same-named
     one in 2025-26)
  
  **Decision-driving question:** if Tournament Admin Committee had
  different members in 2024-25 vs 2025-26, do we model that as:
  - Same committee, just different `season` values on assignments
    (option 1)
  - Two separate Committee records, one per season (option 2)
  
  Option 1 is much less work but constrains future flexibility.
  Option 2 is more honest about reality but cascades into lots of UI
  ("which season am I looking at?").
  
  **Pre-work:** decide which option matches AMTA's actual operational
  reality. Talk through 2-3 real scenarios (committee dissolved
  mid-season, member transferred between committees, person served
  on Tournament Admin in 2022-23 AND 2024-25 but not 2023-24).
  
  **Scope when built:** Option 1 = half-day schema + UI to filter by
  season. Option 2 = day or more, plus UI redesigns.
  
  **Decision needed by:** before populating board_terms (which has
  the same question — terms ARE seasonal).

- **📧 Secondary email on contacts: how do we model it?** ~~RESOLVED
  May 13 — built as primary + secondary on contacts (no labels, no
  separate table). See SHIPPED section.~~

- **📚 Institutional memory: communications archive vs. richer
  Interactions.** Reframed May 12: AMTA uses Notion as knowledge
  base. Lower priority parking lot.

- **🗺️ Roadmap / Priorities tracker — separate entity, or extend
  Projects?** Surfaced May 13. Three options outlined. Pre-work: look
  at what `/projects` actually is today. Related but distinct from
  Goals/OKRs (the spreadsheet tracks discrete initiatives, not
  measurable outcomes).

---

## 🧊 ICEBOX

- **`is_test` flag on programs.** Punted May 13. Only 1 test program.

- **Allow emailless contacts.** Surfaced May 12. Lean: stay strict;
  improve import surface.

- **Recover alumni-claims-admin-mvp.md spec.** Low priority.

- **Tabbed Event detail UI (v2 for judges).** When judge counts grow.

- **Navigator.locks bug writeup.** Felt inauthentic.

- **AI summary staleness.** Known issue, no fix scoped.

- **Case file DB feature.** No current pull.

---

## 📋 To write up

- **Secondary email feature ship (May 13).** Five open design
  questions resolved in one user paragraph: "Primary Email" and
  "Secondary Email," user picks which is primary, works for board
  members AND alumni AND anyone with multiple emails. Generic
  primary/secondary scales to all combinations without a type field.
  Lesson: sometimes the right answer is just a clean naming
  convention. Schema migration captured in repo. The whole feature
  shipped in one cohesive commit (schema + form + detail + AI search
  + alumni signup) because we paused at "let's tackle this" to first
  do the design thinking properly. **Real moment captured: when I
  was about to write up the design discussion for parking, Jacinth's
  paragraph laid out the actual answer — that's the value of
  pushing back to think clearly.**

- **The active_programs/active_contacts view drift saga (May 13).**
  Three instances in one day. Real lesson: schema additions are
  half-finished until the view exposes them. Will be properly
  addressed by tomorrow's RLS audit.

- **Button height standardization (May 13).** Small but instructive —
  the right primitive already existed in the codebase. Scan the
  design system before extracting new abstractions.

- **Collapsible sidebar ship (May 13).** Standard pattern; the
  honest design choices are what's interesting (hover-to-expand
  skipped, native title tooltips accepted, pending-claims pill
  becoming a dot when collapsed).

- **`/data` dashboard ship (May 13).** Three product threads:
  one-map-or-two (toggle for vertical real-estate), alumni geo as
  v1 limitation honestly framed, the engineering lesson of using
  what fits each entity. Polish pass shipped same day.

- **`is_test` as a product-design exercise (May 13).** Three pushbacks
  reshaped scope: category vs column for contacts, programs punted,
  server-vs-client filtering policy.

- **The DashboardPage collision (May 13).** Brief but instructive:
  introducing a new feature folder, check it isn't occupied first.

- **The botched view recreate + recovery (May 13).** Ran a DROP/CREATE
  view before verifying the column list. Realized mid-execution that
  I'd dropped the view and might be missing columns. Caught fast
  because the sidebar Admin section silently disappeared (depended
  on `is_admin` column which wasn't in the new view). Lesson: when
  doing schema work, ALWAYS verify the source-of-truth column list
  BEFORE running the migration, not after. And: silent breakage
  ("the page still loads, things look mostly ok") is the most
  dangerous failure mode — easy to miss without a careful sanity
  check. Real-life version of a near-miss postmortem.

- **RLS debugging bug story (May 12 morning).** The 403 on
  `/alumni-signup`.

- **Postgres views bypassing RLS bug story (May 12 evening).**
  Will compose well with the May 13 column-drift saga into a
  single bigger writeup about Postgres views as a recurring
  footgun.

- **CSV import StrictMode bug story (May 12).**

- **CSV import as product-design exercise (May 12).**
