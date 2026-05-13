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

Last updated: May 13, 2026 (morning — post is_test ship, pre dashboard build)

---

## ✅ Recently shipped

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
  - Contacts list (`src/features/contacts/hooks.ts`) filters out test
    contacts by default. Detail page deliberately does not filter — admin
    navigated there intentionally and the Test category chip is the
    visible signal.
  - Admin UI on `/contacts`: muted "Show test data" checkbox below the
    filter row. Persists via localStorage, no Settings page needed yet.
  - Ask AI server-side filter (`api/ask.ts`): test contacts always
    excluded from `search_contacts` and `get_committee_members` tools.
    Cached per-request inside the agentic loop. Direct lookups
    (`get_contact_details`) intentionally bypass the filter. The
    server-side filter is UNCONDITIONAL — does NOT respect the
    client-side toggle, since AI outputs are often shared/forwarded
    externally and have higher leakage cost than admin UI views.
  - Programs `is_test` deliberately punted (icebox). Only 1 test program
    (Midlands State) means the +1 in stats is documented and acceptable.
  - Real-data verified in prod: test contacts hidden in list and AI,
    visible with toggle in UI, "Tell me about Mary Mocker" → Claude
    correctly says she doesn't exist (filtered server-side regardless of
    toggle), real-contact AI queries still work normally.
  - Unblocks: KPI / Data dashboard.

- **Programs geographic data populated** (May 12, 2026)
  - Added `country text NOT NULL DEFAULT 'USA'` column to `programs`
  - Updated city, state, website, country for 483 of 484 programs from
    a curated CSV dataset
  - Breakdown: 479 USA / 4 Canada / 1 South Korea
  - Test Program row skipped — to be cleaned up via Test category later
  - Unblocks the US state heatmap on the upcoming `/data` dashboard
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
  
  **Scope:** Likely affects all `public.active_*` views.
  
  **Not currently an incident:** Jacinth is the only real user. Becomes
  a real incident once a second user logs in.
  
  **Fix:** Audit every `public.active_*` view; recreate with
  `WITH (security_invoker = on)`. Single migration. Test pass on every
  feature reading from active_* views.
  
  **Symptom artifact preserved:** Maggy's conversation
  (`d953c4cb-e50f-490e-b2ee-89038eadf019`) NOT deleted. Visible reminder
  until the proper fix lands.

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
  
  **Scope:** 2-3 hours including pagination, less if just export.

- **Add seasonal dimension to committee assignments + board membership.**
  AMTA operates on July-June seasons. Add `season` column to
  `committee_assignments`. UI: split Contact page into "Current
  committees" / "Past committees." Half-day to full-day.

- **Constrain `event_staff.position` to a canonical dropdown.** Avoids
  free-text drift. See AMTA Rep design discussion.

- **KPI / Data dashboard at `/data`.** Three metric cards: Active
  programs, Active alumni, Active board members (using Current Board
  Member category as proxy for v1). Two heatmaps with toggle: Programs
  per state, Alumni per state (alumni heatmap rolls up via their
  program's state — see callout below). Pre-work: geo data DONE,
  `is_test` infrastructure DONE. **CURRENTLY BUILDING.**

- **Populate `board_terms` table + flesh out board member breakdown.**
  Currently empty. Once populated, the Active Board Members card on
  `/data` can show the director / first-year candidate / second-year
  candidate breakdown that's more informative than a flat count.

- **Admin data-cleanup / dupe-merge tool.** Heuristic dupe detection.
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
  - **Current city / state** (newly captured May 13). Today, an alum's
    geo identity rolls up via their program's state — Yale alum = CT
    even if they live in California. For community-building, regional
    events, and donor cultivation, the alum's *current* location matters
    more than their college's location. Add a `current_state` (and
    optionally `current_city`) column on `contacts`. Once populated,
    the alumni heatmap on `/data` could optionally toggle between
    "by program state" and "by current state" for a richer view.
  - Roles within program (board member? captain? competitor?)
  - Current professional context (career field, job title)
  - Decision: required vs optional per field. Default to optional
    except start year.

- **Collapsible sidebar.** Toggle to collapse to icons-only.

- **Self-service profile editing for alumni (Phase 3).**

- **Sortable lists across Contacts / Programs / Events.** Shared
  `<SortableTable>`.

- **Profile / Settings page** separate from Contact record.

- **CSV import for Programs.** Symmetric to existing export.

- **Revamp Home page.** Focus on user workflow, not stats. Stats go to
  `/data`.

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
- **B3:** Can't remove program affiliation from a Contact page. Two
  layers (Contact page UI missing; Program page also broken/missing).
- **B4:** Category multi-select dropdown perceived-slow on subsequent
  selections.

---

## 💭 Design discussions

- **AMTA Representative: category or role? (Or both, with a
  relationship constraint?)** Four options laid out; lean is "category
  + position with soft validation." Decision needed before position
  dropdown work.

- **📧 Secondary email on contacts: how do we model it?** Two converging
  use cases: alumni (school + personal), workspace + personal in
  general. Five open questions; lean is "start simple with one extra
  column." Decision needed before expanding alumni signup form.

- **📚 Institutional memory: communications archive vs. richer
  Interactions.** Reframed May 12 evening: AMTA uses Notion as
  knowledge base, so playbooks live there. Some marketing-style alumni
  emails may still warrant CRM logging for audience context. Lower
  priority parking lot.

---

## 🧊 ICEBOX

- **`is_test` flag on programs.** Punted during May 13 is_test
  infrastructure work. Only 1 test program (Midlands State); +1 in
  stats is small known overhead. Revisit if test programs proliferate.

- **Allow emailless contacts (or a different entity for them).**
  Surfaced May 12 from Claremont CSV import. Lean: option 3 (stay
  strict; improve import surface).

- **Recover alumni-claims-admin-mvp.md spec.** Low priority since
  feature is built.

- **Tabbed Event detail UI (v2 for judges).** When judge counts grow.

- **Navigator.locks bug writeup.** Felt inauthentic to publish under
  user name alone.

- **AI summary staleness.** Known issue, no fix scoped.

- **Case file DB feature.** No current pull.

---

## 📋 To write up

- **`is_test` as a product-design exercise (May 13).** Three pushbacks
  reshaped scope: category vs column for contacts, programs punted,
  server-vs-client filtering policy. Lessons: "use what fits each
  entity" beats "consistent infrastructure" when entities are
  genuinely different.

- **RLS debugging bug story (May 12 morning).** The 403 on
  `/alumni-signup`. Lessons: confirm test setup before trusting
  results; RLS scoped per role.

- **Postgres views bypassing RLS bug story (May 12 evening).** Started
  as "delete button doesn't work." View owner = `postgres` bypasses
  RLS by default. Lessons: when RLS LOOKS correct but data leaks,
  check the views.

- **CSV import StrictMode bug story (May 12).** React 18 StrictMode
  double-mount + cleanup flag race. Lessons: for single-shot async,
  refs > flags.

- **CSV import as product-design exercise (May 12).** Dupe story,
  position default, entry-point UX, row cap, tournament-host CSV
  alias system. Each decision pushed back on over-build.
