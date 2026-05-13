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

Last updated: May 13, 2026 (post button-height standardization)

---

## ✅ Recently shipped

- **🔘 Action-row buttons use SecondaryButton component** (May 13, 2026)
  - Inline Import button on ContactsListPage and the trigger inside
    ExportCsvButton both used custom className strings — slightly
    different padding and font weight than the existing
    SecondaryButton component, producing visible misalignment.
  - Fix: replaced both with `<SecondaryButton>`. All action-row
    buttons (Import / Export / New contact) now match heights and
    visual weight.
  - Cleaner architecturally — future style changes cascade
    automatically. ExportCsvButton's modal-internal buttons (Cancel,
    Download, close-X) deliberately untouched — different geometry
    needs.

- **🪟 Collapsible sidebar** (May 13, 2026)
  - Toggle button in the brand area collapses sidebar to 56px (icons
    only); expand back to 232px. Width animates smoothly over 150ms.
  - State persists in localStorage (`amta:sidebar-collapsed`).
  - Hover-to-expand deliberately skipped for v1 — extra state to
    manage, can add later if needed.
  - Tooltips on every nav icon when collapsed (native `title`).
  - Search becomes an icon button when collapsed.
  - Admin pending-claims indicator: full pill expanded, small maroon
    dot on icon when collapsed.
  - Profile: full block expanded, avatar + sign-out icon stacked
    when collapsed.

- **🎨 /data heatmap custom tooltip + hover polish** (May 13, 2026)
  - Replaced native `<title>` tooltip with a custom React tooltip:
    follows cursor, brand-styled (dark zinc card, white text, shadow),
    proper singular/plural noun ("1 alum" vs "23 alumni").
  - Hover state on each state: stroke darkens to brand maroon at 1.5px,
    cursor becomes pointer.
  - States with 0 data still show their tooltip.

- **📊 KPI / Data dashboard at `/data`** (May 13, 2026)
  - Three metric cards: Active programs (with international count
    subtitle), Active alumni, Current board members (using "Current
    Board Member" category as v1 proxy).
  - US state heatmap with Programs/Alumni toggle.
  - Alumni heatmap rolls each alum up via their program's state.
  - All test contacts excluded from alumni count, board count, alumni
    heatmap.
  - Library: `react-simple-maps` with the public `us-atlas` topojson
    source.
  - Lives in `src/features/data/` (separate from `src/features/
    dashboard/` which is the personal Home page).
  - **Side fix:** `active_programs` view recreated to include the
    `country` column.

- **🧪 Test-data infrastructure via Test category** (May 13, 2026)
  - Reuses existing categories infrastructure rather than adding a column.
  - 5 contacts seeded into the Test category: Mallory, Mikey, Molly, Monty
    Midlander; Mary Mocker.
  - Shared helper at `src/lib/test-data.ts` with predicate, fetcher,
    query wrapper, and localStorage toggle accessors.
  - Contacts list filters out test contacts by default; admin toggle
    on `/contacts`; persists via localStorage.
  - Ask AI server-side filter (`api/ask.ts`): test contacts always
    excluded from search/list tools. Direct lookups intentionally
    bypass. Unconditional server-side.
  - Programs `is_test` deliberately punted (icebox). Only 1 test
    program (Midlands State).
  - Real-data verified in prod.

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
  Discovered May 12, 2026 investigating bug B1.
  
  **Root cause:** Postgres views run with the *creator's* permissions by
  default. `active_*` views are owned by `postgres` (superuser), which
  bypasses RLS on the underlying table. Authenticated users querying
  the view see ALL rows, not just `auth_user_id = auth.uid()` rows.
  
  **Scope:** Likely affects all `public.active_*` views.
  
  **Side note:** when we touch this, also need to make sure each view
  exposes the current set of columns from the underlying table — the
  May 13 `/data` build hit the `active_programs`-missing-`country`
  variant of this problem and had to recreate the view inline.
  
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
  filtering to `/programs` and `/contacts` list pages. The map
  already signals interactivity with cursor pointer + hover stroke,
  so wiring up the actual navigation is the missing piece. Scope:
  one session of focused work.

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

- **`/data` heatmap tooltip viewport-edge flipping.** Tooltip currently
  always renders at cursor + (12px, 12px) offset. If you hover a state
  near the right/bottom edge of the viewport, the tooltip can spill
  off-screen. ~15 min.

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
  invitations. Surfaced May 13: `w.warihay@gmail.com` was manually
  created in Google Auth during early setup, can sign in fine, but
  his invitation row still shows Pending in `/admin/invitations`.
  Jacinth is mid-diagnostic: sending him the invite link to see if
  going through that flow resolves it.
  
  **Two possible outcomes:**
  1. Invite link flow clears the bug → it's a "pre-existing auth
     users need a manual re-invite" pattern, low priority since
     post-RLS-fix + email automation we'll stop manually creating
     auth users.
  2. Invite link doesn't clear → there's a real desync between
     `auth.users` and the invitation table. Worth investigating.
  
  Either way, not blocking — Warihay has access. The admin view is
  just misleading. Update this entry once Jacinth runs the test.

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

- **🗺️ Roadmap / Priorities tracker — separate entity, or extend
  Projects?** Surfaced May 13 from Jacinth's `[AMTA] EC H2 2025
  Projects / Priorities Roadmap` spreadsheet. The sheet tracks
  initiative-level work with columns: Priority (P0/P1/P2/P3), Status
  (Done/In Progress/Not Started), Area (Core Ops / People Ops /
  Scaling / Finance / Management / Growth / Cleanup), Summary,
  Progress, Driver, Accountable. Currently in Google Sheets, used
  for socializing priorities to AMTA EC.
  
  **The honest question:** is this what `/projects` is already for,
  or does it want its own entity?
  
  **Three possibilities:**
  1. **Extend `/projects`** with Priority enum, Area enum, separate
     Driver/Accountable fields. Smaller scope; assumes Projects'
     current shape is structurally compatible.
  2. **New entity (Roadmap / Initiatives / Priorities).** Bigger
     scope but keeps Projects unchanged for whatever it's serving now.
  3. **`/projects` is empty/underused and this is the killer use
     case that gives it purpose.**
  
  **Pre-work needed:** look at what `/projects` actually is today.
  
  **Related but distinct:** "Goals" / OKRs (measurable outcomes).
  The spreadsheet is NOT OKRs — it's discrete initiatives with
  priority/status. Don't conflate.
  
  **Scope when built:** depends on option choice. Option 1 = half-
  day. Option 2 = day or more.

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

- **Button height standardization (May 13).** Sounds trivial, but a
  small lesson: the right fix was already in the codebase. I
  initially thought we'd need to extract a `SecondaryButton`
  primitive — turns out it existed. The actual fix was *deleting*
  inline className strings and using the component. Lesson: scan
  the design system before extracting new abstractions; the answer
  might already be there. Also a small but real reminder that
  inline className strings drift away from primitives faster than
  you'd expect.

- **Collapsible sidebar ship (May 13).** Standard pattern, a few
  honest design choices worth noting: hover-to-expand deliberately
  skipped for v1; native `title` tooltips accepted despite the 1s
  delay because nav icons get learned quickly; pending-claims pill
  becoming a maroon dot when collapsed (signal preservation in a
  smaller affordance).

- **`/data` dashboard ship (May 13, 2026).** Two product threads worth
  capturing: (1) The "one map or two" question — picked toggle for
  vertical real-estate reasons; (2) the honest framing of "alumni
  geo rolls up via program state" being explicitly acknowledged as a
  v1 limitation (surfaced as a future toggle when
  contacts.current_state is populated); (3) the engineering lesson
  of using a feature flag on which view fits each entity vs. mass
  abstraction. Polish pass (custom tooltip + hover stroke + pointer
  cursor) shipped same day as a separate commit.

- **The active_programs-missing-country bug (May 13).** Mid-build, the
  dashboard 400'd because the view was created before the country
  column was added. Postgres views don't auto-update their column
  lists. Recreated the view inline. Concrete instance of the bigger
  RLS-bypass-views issue.

- **`is_test` as a product-design exercise (May 13).** Three pushbacks
  reshaped scope: category vs column for contacts, programs punted,
  server-vs-client filtering policy.

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
