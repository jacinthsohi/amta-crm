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

Last updated: May 13, 2026 (post /data dashboard ship)

---

## ✅ Recently shipped

- **📊 KPI / Data dashboard at `/data`** (May 13, 2026)
  - Three metric cards: Active programs (with international count
    subtitle), Active alumni, Current board members (using "Current
    Board Member" category as v1 proxy).
  - US state heatmap with Programs/Alumni toggle. Native title tooltip
    on hover ("California: 23 programs"). Color scale from light pink
    to brand maroon, sqrt-scaled for visual sensitivity at low counts.
  - Alumni heatmap rolls each alum up via their program's state — Yale
    alum counts as CT even if they live in CA. Future toggle for "by
    current state" tracked in alumni form expansion item.
  - All test contacts excluded from alumni count, board count, alumni
    heatmap.
  - Library: `react-simple-maps` with the public `us-atlas` topojson
    source.
  - Lives in `src/features/data/` (separate from `src/features/
    dashboard/` which is the personal Home page).
  - **Side fix:** `active_programs` view recreated to include the
    `country` column. The May 12 geo migration added country to the
    `programs` table, but Postgres views don't auto-update when
    underlying tables change. This is exactly the kind of issue the
    RLS-bypass-views fix (HIGH) will need to handle for every
    `active_*` view.

- **🧪 Test-data infrastructure via Test category** (May 13, 2026)
  - Reuses existing categories infrastructure rather than adding a column
    (admin tags contacts with "Test" category, no schema migration needed
    for contacts).
  - 5 contacts seeded into the Test category: Mallory, Mikey, Molly, Monty
    Midlander; Mary Mocker.
  - New shared helper at `src/lib/test-data.ts`: constant
    `TEST_CATEGORY_NAME = "Test"`, `isTestContact()` predicate,
    `getTestContactIds()` async fetcher, `excludeTestContacts()` query
    wrapper, plus `shouldShowTestData()` / `setShowTestData()` for the
    localStorage toggle.
  - Contacts list filters out test contacts by default; admin toggle on
    `/contacts` to show them; persists via localStorage.
  - Ask AI server-side filter (`api/ask.ts`): test contacts always
    excluded from `search_contacts` and `get_committee_members` tools.
    Direct lookups (`get_contact_details`) intentionally bypass the
    filter. Unconditional server-side (does NOT respect the
    client-side toggle).
  - Programs `is_test` deliberately punted (icebox). Only 1 test
    program (Midlands State).
  - Real-data verified in prod.

- **Programs geographic data populated** (May 12, 2026)
  - Added `country text NOT NULL DEFAULT 'USA'` to `programs`
  - 483 of 484 programs got city/state/website/country (curated CSV)
  - 479 USA / 4 Canada / 1 South Korea
  - Migration: `migrations/20260512_programs_geo_data.sql`
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
  Discovered May 12, 2026 investigating bug B1.
  
  **Root cause:** Postgres views run with the *creator's* permissions by
  default. `active_*` views are owned by `postgres` (superuser), which
  bypasses RLS on the underlying table. Authenticated users querying
  the view see ALL rows, not just `auth_user_id = auth.uid()` rows.
  
  **Scope:** Likely affects all `public.active_*` views.
  
  **Side note:** when we touch this, also need to make sure each view
  exposes the current set of columns from the underlying table — the
  May 13 `/data` build hit the `active_programs`-missing-`country`
  variant of this problem and had to recreate the view inline. The
  RLS audit should include a column-completeness pass for every view
  while we're rebuilding them.
  
  **Not currently an incident:** Jacinth is the only real user. Becomes
  a real incident once a second user logs in.
  
  **Fix:** Audit every `public.active_*` view; recreate with
  `WITH (security_invoker = on)`. Single migration. Test pass on every
  feature reading from active_* views.

- **Email automation for invitations.** Currently copy/paste manual.
  Unblocks onboarding flow. Don't onboard new users until views RLS
  bypass is fixed.

---

## 🟡 MEDIUM

- **🧾 Export "all" vs "current view" + upcoming pagination for
  Contacts.** Today exports = `rows={filtered}`. Pagination is coming;
  the mental model needs to be decided before that ships.
  
  **Three options:**
  1. Toggle in the export modal (Export all / Export filtered)
  2. Export always means "everything matching filter, ignoring
     pagination" *(current lean — cleanest mental model)*
  3. Hybrid: filter-matched default + "Clear filters and export all"

- **Add seasonal dimension to committee assignments + board membership.**
  AMTA operates on July-June seasons. Add `season` column. UI: split
  Contact page into "Current committees" / "Past committees."

- **Constrain `event_staff.position` to a canonical dropdown.** Avoids
  free-text drift. See AMTA Rep design discussion.

- **Populate `board_terms` table + flesh out board member breakdown.**
  Currently empty. Once populated, the Active Board Members card on
  `/data` can show the director / first-year candidate / second-year
  candidate breakdown that's more informative than a flat count.

- **Admin data-cleanup / dupe-merge tool.** Heuristic dupe detection.
  Side-by-side comparison. Merge transferring all associations.

- **External judge signup flow.** Public form at `/judge-signup`,
  mirrors `/alumni-signup` patterns. ~50% effort since infra exists.

- **Mapping UX polish — show first-row preview next to each dropdown.**

- **README update for CSV import.** "Workflow features" section with
  proper screenshots. ~30 min.

- **Tighten `alumni_claims` RLS to admin-only.**

- **Combobox UX for the program dropdown on `/alumni-signup`.** 483
  options in a native `<select>` is bad UX.

- **Expand alumni signup form fields.** Specific candidates:
  - **Pronouns** (newly captured)
  - **Start year** (also fixes the `start_year = end_year` tech debt)
  - **Current city / state** (newly captured May 13). Today, an alum's
    geo identity rolls up via their program's state — Yale alum = CT
    even if they live in California. For community-building, regional
    events, and donor cultivation, the alum's *current* location
    matters more than their college's location. Add a `current_state`
    (and optionally `current_city`) column on `contacts`. Once
    populated, the alumni heatmap on `/data` could optionally toggle
    between "by program state" and "by current state" for a richer
    view.
  - Roles within program (board member? captain? competitor?)
  - Current professional context (career field, job title)
  - Decision: required vs optional per field. Default to optional
    except start year.

- **Click-through from `/data` heatmap to filtered list pages.** When
  user clicks California on the Programs heatmap, navigate to
  `/programs?state=California` (filtered list). Same for alumni
  heatmap → `/contacts?state=California`. Pre-work: add state
  filtering to `/programs` and `/contacts` list pages. Scope: one
  session of focused work.

- **Collapsible sidebar.** Toggle to collapse to icons-only.

- **Self-service profile editing for alumni (Phase 3).**

- **Sortable lists across Contacts / Programs / Events.** Shared
  `<SortableTable>`.

- **Profile / Settings page** separate from Contact record.

- **CSV import for Programs.** Symmetric to existing export.

- **Revamp Home page.** Focus on user workflow, not stats. Stats now
  live at `/data`. Home can lose the heavier metrics and focus on
  what's-on-my-plate-today.

- **Officer terms inline edit.** See bug B2.

- **Bulk-assign Current Board Member.**

- **Cascade soft-delete for committees, contacts, events.**

- **Email Draft Generator.** Potential 6th AI feature.

---

## 🟢 LOW

- **`api/meeting-brief.ts` test-data filter follow-up.** When `is_test`
  shipped (May 13), we deliberately scoped out `meeting-brief.ts`
  because the feature is rarely used (portfolio piece). If usage grows,
  mirror the `loadTestContactIds()` + per-tool filter pattern from
  `api/ask.ts`. 20-30 min.

- **Polish `/data` heatmap tooltip.** Native `<title>` works but is
  slow to appear and unstyled. Replace with a custom React tooltip
  for snappier UX. ~30 min.

- **Standardize button heights across action rows.** PrimaryButton vs
  ExportCsvButton vs Import. 20-30 min focused.

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

---

## 💭 Design discussions

- **AMTA Representative: category or role?** Four options laid out;
  lean is "category + position with soft validation." Decision needed
  before position dropdown work.

- **📧 Secondary email on contacts: how do we model it?** Two
  converging use cases. Five open questions; lean is "start simple
  with one extra column." Decision needed before expanding alumni
  signup form.

- **📚 Institutional memory: communications archive vs. richer
  Interactions.** Reframed May 12 evening: AMTA uses Notion as
  knowledge base. Lower priority parking lot.

---

## 🧊 ICEBOX

- **`is_test` flag on programs.** Punted May 13. Only 1 test program;
  +1 in stats is small known overhead.

- **Allow emailless contacts.** Surfaced May 12 from Claremont CSV
  import. Lean: stay strict; improve import surface.

- **Recover alumni-claims-admin-mvp.md spec.** Low priority since
  feature is built.

- **Tabbed Event detail UI (v2 for judges).** When judge counts grow.

- **Navigator.locks bug writeup.** Felt inauthentic to publish under
  user name alone.

- **AI summary staleness.** Known issue, no fix scoped.

- **Case file DB feature.** No current pull.

---

## 📋 To write up

- **`/data` dashboard ship (May 13, 2026).** Two product threads
  worth capturing: (1) The "one map or two" question — initial
  instinct was stacked / side-by-side, picked toggle for vertical
  real-estate reasons; (2) the honest framing of "alumni geo rolls up
  via program state" being explicitly acknowledged as a v1 limitation
  rather than papered over (and surfaced as a future toggle when
  contacts.current_state is populated); (3) the engineering lesson of
  using a feature flag on which view fits each entity vs. mass
  abstraction. Also a great visual portfolio piece.

- **The active_programs-missing-country bug (May 13).** Mid-build, the
  dashboard 400'd because the view was created before the country
  column was added. Postgres views don't auto-update their column
  lists. Recreated the view inline. Concrete instance of the bigger
  RLS-bypass-views issue. Lessons: views and their underlying tables
  drift; "active_*" pattern needs auditing for both security and
  column completeness; the column-recreate question makes the RLS
  fix bigger but also more valuable.

- **`is_test` as a product-design exercise (May 13).** Three pushbacks
  reshaped scope: category vs column for contacts, programs punted,
  server-vs-client filtering policy. Lessons: "use what fits each
  entity" beats "consistent infrastructure" when entities are
  genuinely different.

- **RLS debugging bug story (May 12 morning).** The 403 on
  `/alumni-signup`.

- **Postgres views bypassing RLS bug story (May 12 evening).** Started
  as "delete button doesn't work."

- **CSV import StrictMode bug story (May 12).** React 18 StrictMode
  double-mount + cleanup flag race.

- **CSV import as product-design exercise (May 12).**

- **The DashboardPage collision (May 13).** Brief but instructive
  moment: I assumed `src/features/dashboard/` was empty and wrote
  `DashboardPage.tsx` into it, blowing away the existing Home page.
  Recovered via git checkout, renamed to `src/features/data/DataPage.tsx`.
  Lessons: when introducing a new feature folder, check it isn't
  occupied; semantic names ("Dashboard" vs "Data") get reused across
  pages and need disambiguation; git is your friend.
