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

Last updated: May 16, 2026 — Tier 1 RLS audit shipped, active leak closed

---

## ✅ Recently shipped

- **🔒 SECURITY: Closed RLS bypass on AI views (Tier 1 of audit)**
  (May 16, 2026)
  - Postgres views default to running with the creator's permissions
    (postgres = superuser), bypassing RLS on the underlying tables.
    All ~23 active_* views had this issue. Tier 1 fixes the highest-
    risk: AI conversation views, which were actively leaking cross-
    user data.
  - Recreated `active_ai_conversations` and `active_ai_messages` with
    `WITH (security_invoker = true)`. Views now respect the existing
    (correctly user-scoped) RLS policies on `ai_conversations` and
    `ai_messages`.
  - **Bug confirmed as REAL active leak, not theoretical.** Post-
    migration verification: a conversation referencing Maggy Randels
    that was visible in jacinth's sidebar disappeared. Its
    auth_user_id was not jacinth's — meaning before the fix, jacinth
    was seeing another user's conversation. Resolves bug B1 as the
    visible symptom of the underlying view-RLS-bypass.
  - Migration captured: `20260516_ai_views_security_invoker.sql`
    (with matching rollback file in repo).
  - Tier 2/3 (the other ~19 views) deferred to future sessions —
    most are admin-only or low-risk for current state.

- **🎓 Alumni signup: block .edu primary + capture current city/state**
  (May 15, 2026)
- **📧 Secondary email field across the CRM** (May 13, 2026)
- **🔘 Action-row buttons use SecondaryButton component** (May 13, 2026)
- **🪟 Collapsible sidebar** (May 13, 2026)
- **🎨 /data heatmap custom tooltip + hover polish** (May 13, 2026)
- **📊 KPI / Data dashboard at `/data`** (May 13, 2026)
- **🧪 Test-data infrastructure via Test category** (May 13, 2026)
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

- **🔒 SECURITY: RLS audit Tier 2/3 — close bypass on remaining ~19
  active_* views.** Tier 1 (AI views) shipped May 16. Tier 2/3 covers
  views over data with admin-only RLS, plus lower-risk operational
  data. Each view needs:
  - Full column list verified against base table via pg_get_viewdef
    or information_schema (NEVER from memory — lessons from May 13)
  - DROP + CREATE with `WITH (security_invoker = true)`
  - Smoke test of any feature querying it
  
  **Inventory** (all currently owned by postgres, all bypass RLS):
  - active_board_terms
  - active_committee_assignments
  - active_committees
  - active_contact_categories
  - active_contact_category_assignments
  - active_contacts (touched 2x this week — column drift footgun)
  - active_event_documents
  - active_event_hosts
  - active_event_staff
  - active_events
  - active_interaction_links
  - active_interaction_participants
  - active_interactions
  - active_officer_terms
  - active_program_affiliations
  - active_programs (touched 1x this week — column drift footgun)
  - active_project_assignments
  - active_projects
  - active_tasks
  
  **Out of scope (separate design problem — see Design Discussions):**
  - active_invitations + active_invitations_view
  
  Suggested batching:
  - Batch A (low-risk, simple): active_contact_categories,
    active_contact_category_assignments, active_committees,
    active_programs, active_events, active_event_documents,
    active_event_hosts, active_event_staff (mostly lookup/admin)
  - Batch B (contact data): active_contacts, active_board_terms,
    active_officer_terms, active_committee_assignments,
    active_program_affiliations
  - Batch C (workflow data): active_tasks, active_interactions,
    active_interaction_links, active_interaction_participants,
    active_projects, active_project_assignments
  
  Estimated 1-2 hours per batch including smoke testing. Three
  focused sessions total. Order: A → B → C (lowest risk first).

- **Email automation for invitations.** Currently copy/paste manual.
  Unblocked by Tier 1 ship. Still recommended to complete Tier 2
  before onboarding additional users.

---

## 🟡 MEDIUM

- **🧾 Export "all" vs "current view" + Contacts pagination.**

- **Add seasonal dimension to committee assignments + board membership.**
  See Seasons design discussion.

- **Constrain `event_staff.position` to a canonical dropdown.**

- **Populate `board_terms` table + flesh out board member breakdown.**

- **Admin data-cleanup / dupe-merge tool.** Now needs to dedup across
  primary AND secondary email.

- **Bring location to admin ContactForm.** Part 2 of the alumni-form
  location work. Add `current_city` + `current_state` editing to the
  admin ContactForm so admins can update existing contacts. Without
  this, location data only enters via new alumni signups and goes
  stale forever. ~20 min.

- **External judge signup flow.**

- **Mapping UX polish — show first-row preview next to each dropdown.**

- **README update for CSV import.** ~30 min.

- **Tighten `alumni_claims` RLS to admin-only.**

- **Combobox UX for the program dropdown on `/alumni-signup`.**

- **Expand alumni signup form fields (remaining candidates).** After
  location + .edu shipped May 15, remaining alumni form expansion:
  - Pronouns
  - Start year (also fixes the `start_year = end_year` tech debt)
  - Roles within program (board member? captain? competitor?)
  - Current professional context (career field, job title)

- **CSV import for Contacts: handle secondary_email column.** ~30 min.

- **CSV export for Contacts: include secondary_email column.** ~10 min.

- **CSV import/export: handle current_city and current_state.** ~20 min.

- **Click-through from `/data` heatmap to filtered list pages.**

- **Self-service profile editing for alumni (Phase 3).**

- **Sortable lists across Contacts / Programs / Events.**

- **Profile / Settings page** separate from Contact record.

- **CSV import for Programs.**

- **Revamp Home page.**

- **Officer terms inline edit.** See bug B2.

- **Bulk-assign Current Board Member.**

- **Cascade soft-delete for committees, contacts, events.**

- **Email Draft Generator.** Potential 6th AI feature.

---

## 🟢 LOW

- **Consolidate database types files.** `database.generated.ts`
  (May 11) is stale — predates the secondary_email and current_city/
  current_state additions. `alumni-claims-hooks.ts` is the one
  importer. Swap that import to `database.types.ts`, delete the old
  file. ~5 min cleanup, discovered during May 16 RLS audit.

- **Rollback migration naming convention.** Current pattern of
  `20260516_ai_views_security_invoker.sql` +
  `20260516_ai_views_security_invoker_rollback.sql` puts forward and
  rollback files side-by-side alphabetically. Minor footgun — easy
  to grab the wrong one when copy-pasting into Supabase. Consider
  `migrations/rollback/` subdirectory or `_rollback_` prefix.
  Discovered May 16 when forward migration didn't run because
  rollback was pasted first.

- **`api/meeting-brief.ts` test-data filter follow-up.**
- **`api/meeting-brief.ts` and `api/contact-summary.ts` secondary
  email visibility.**
- **`/data` heatmap tooltip viewport-edge flipping.**
- **Add email consent disclosure to `/alumni-signup`.**
- **Find Chrome extension slowing Supabase calls locally.** Dev only.
- **Refresh contact-relationships screenshot in README.**
- **Clean up 308 latent TS errors incrementally.**
- **Add `npm run build` step to pre-push workflow.**

---

## 🐛 BUGS

- **B1:** ~~Can't delete Maggy Randels conversation~~ **RESOLVED
  May 16, 2026.** The conversation wasn't jacinth's — RLS bypass on
  views was leaking it from another auth user. Tier 1 RLS fix
  removed it from view. Underlying cause = the same bug we've been
  patching around all week.
- **B2:** Officer terms can't be edited inline.
- **B3:** Can't remove program affiliation from a Contact page.
- **B4:** Category multi-select dropdown perceived-slow.
- **B5:** Pre-existing auth users don't auto-resolve their pending
  invitations.
- **B6:** Ask AI occasionally 504s on the first message of complex
  queries. Discovered May 16 during RLS smoke testing. Likely
  Vercel edge function timeout when agentic loop runs many tool
  calls. Simple queries ("Testing") return fine. Investigation
  needed: log how long /api/ask actually takes, consider raising
  timeout or shortening the agentic loop.

---

## 💭 Design discussions

- **🎫 Invitations: how do non-authed users read their own invitation
  by token?** Surfaced during May 16 RLS audit. Current state:
  - `active_invitations` and `active_invitations_view` both bypass
    RLS (along with all other active_* views).
  - RLS policies on `invitations` table are ADMIN-ONLY (select,
    update, insert all require `is_current_user_admin()`).
  - But the magic-link flow (`AcceptInvitationPage`,
    `FinishInvitationPage`) needs non-authed/non-admin users to
    fetch an invitation row by token.
  - Today: works because views bypass RLS.
  - After hypothetical security_invoker fix: would break — non-admin
    users would fail the policy check.
  
  Three real options:
  1. **RPC with SECURITY DEFINER:** Drop the public views, add a
     SECURITY DEFINER function `get_invitation_by_token(token)` that
     returns the row. Public flow calls the function; admins still
     use the view. Most secure but most refactor.
  2. **Permissive SELECT policy:** Allow public SELECT on invitations.
     Risk: someone with a leaked token list could read those rows.
     Mitigated because tokens are presumably long random strings.
  3. **Dedicated public endpoint:** Add `/api/get-invitation?token=`
     edge function that does the lookup server-side with service
     role and returns sanitized data. Cleanest separation of public
     vs admin surface.
  
  **Pre-work:** decide what's the right model. Likely option 1 or 3.
  Decision should consider whether we'll have other "public read by
  token" patterns (alumni claims approval? event invites?) — if yes,
  a generic RPC pattern is worth investing in.
  
  **Blocks:** the Tier 1 RLS audit from being fully complete. The
  invitations views are the only Tier 1 views not yet fixed.

- **AMTA Representative: category or role?** Four options; lean is
  "category + position with soft validation."

- **📅 Seasons concept: how do we model July-June years?** Option 1
  (label) vs Option 2 (schema branch). Blocks board_terms population.

- **🗺️ Roadmap / Priorities tracker — separate entity, or extend
  Projects?**

- **📚 Institutional memory: communications archive vs. richer
  Interactions.** Lower priority — much goes to Notion.

---

## 🧊 ICEBOX

- **`is_test` flag on programs.** Punted May 13.
- **Allow emailless contacts.** Lean: stay strict.
- **Recover alumni-claims-admin-mvp.md spec.**
- **Tabbed Event detail UI (v2 for judges).**
- **Navigator.locks bug writeup.**
- **AI summary staleness.**
- **Case file DB feature.**

---

## 📋 To write up

- **🌟 The RLS-bypass-views audit (May 12-16).** The crown jewel
  writeup of this week. Real arc: started as a single bug (B1, can't
  delete Maggy conversation), reframed as RLS policy issue, reframed
  again as the view layer bypassing RLS, deferred for a week of
  patches as views drifted out of sync with their base tables,
  finally executed as a proper audit on May 16.
  
  Key moments:
  - May 12 morning: 403 on /alumni-signup → RLS policy debugging
  - May 12 evening: realized active_* views bypass RLS entirely
  - May 13: column-drift saga (3 instances in one day — active_
    programs/country, active_contacts/secondary_email, the botched
    recreate with missing is_admin)
  - May 15: alumni location work brought one more instance, escalated
    audit priority
  - May 16: audit executed properly. Inventory revealed 23 views.
    Tier 1 (AI views) shipped with confirmed active leak (Maggy
    conversation disappeared post-migration — proving the bug was
    real, not theoretical). Identified active_invitations as deeper
    design problem worth deferring.
  
  Lessons throughout:
  - Verify schema column lists BEFORE running migrations
  - View column drift compounds — fix the underlying issue, not the
    symptoms
  - Pre-stage rollback files for high-risk migrations
  - Smoke tests for security migrations need to verify "the right
    data is visible" not just "the page loads"
  - "Theoretical bug" can become "actual leak" the moment you
    look more carefully — the Maggy conversation proved it
  - "Knock it out" vs "do it right" — Tier 1 caught itself in a
    half-mistake (forward vs rollback) and the pre-staged rollback
    made it a non-event

- **Alumni signup quality improvements ship (May 15).** Bundled
  .edu blocking + current city/state. Resolved a design discussion
  in mid-session about whether to bundle remaining alumni form
  expansion (decision: location + .edu only this session).

- **Secondary email feature ship (May 13).** Five design questions
  resolved in one user paragraph.

- **Button height standardization (May 13).** The right primitive
  already existed.

- **Collapsible sidebar ship (May 13).**

- **`/data` dashboard ship (May 13).**

- **`is_test` as a product-design exercise (May 13).** Three
  pushbacks reshaped scope.

- **The DashboardPage collision (May 13).**

- **The botched view recreate + recovery (May 13).** ALWAYS verify
  source-of-truth column list BEFORE running schema migrations.

- **RLS debugging bug story (May 12 morning).** Subsumed into the
  audit writeup above.

- **Postgres views bypassing RLS bug story (May 12 evening).**
  Subsumed into the audit writeup above.

- **CSV import StrictMode bug story (May 12).**

- **CSV import as product-design exercise (May 12).**
