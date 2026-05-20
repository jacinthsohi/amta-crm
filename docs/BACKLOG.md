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

Last updated: May 17, 2026 — Email magic-link send shipped (backend + UI, SendGrid-gated finish remaining)

---

## ✅ Recently shipped

- **📧 Email automation: profile magic-link send (backend + UI)**
  (May 17, 2026) — Admins can email a profile magic link to a
  contact directly from the CRM instead of copy/pasting from Gmail.
  - `api/send-magic-link.ts` — Vercel serverless function. Verifies
    the caller's JWT identifies a real user, THEN verifies that
    user is an admin (`contacts.is_admin`) before doing privileged
    work — a stricter bar than `contact-summary.ts` uses, because
    this endpoint mints access tokens.
  - New "Email link directly" button in the ContactDetailPage
    sidebar (`ProfileLinkSection.tsx`), alongside the existing
    "Generate link" modal flow. Disabled when the contact has no
    email on file. The modal + "Compose email" mailto fallback are
    untouched — two distinct flows preserved on purpose.
  - DB: migration `20260517_create_profile_token_service.sql`
    extracts the token revoke-then-issue logic into a private
    `_mint_profile_token()` helper (single source of truth), and
    adds `create_profile_token_service()` — a service-role-only
    variant with NO `is_current_user_admin()` gate, since
    service-role callers have no `auth.uid()`. Its safety is the
    REVOKE: never granted to anon/authenticated.
  - **NOT yet functional end to end — SendGrid-gated.** The whole
    chain is verified working in prod *except* the actual email
    send: `SENDGRID_API_KEY` is not set in Vercel (pending account
    access) and the sending domain isn't authenticated yet. See
    the "SendGrid-gated finish" item in 🔴 HIGH for the remaining
    ~15-minute task. Until then, clicking the button mints a token
    and returns a clean "Server misconfigured: SENDGRID_API_KEY is
    not set" — proof the rest of the chain works.

- **🔗 Profile V1: magic-link self-service profile editor**
  (May 16, 2026) — Six SECURITY DEFINER RPCs let board members
  edit their own profile (basics + program affiliations) via a
  30-day token. Admins generate links from ContactDetailPage. End
  to end functional: name/pronouns/contact/location/affiliations
  all self-serviceable. Soft delete for affiliations (the schema
  pattern already existed). Established the token-gated RPC
  pattern that should carry forward to other public-by-token
  flows. See "📋 To write up" for the full narrative.

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

- **📧 SendGrid-gated finish: turn on the magic-link email send.**
  The backend + UI for emailing profile magic links shipped May 17
  (see ✅ Recently shipped). Everything works in prod except the
  actual SendGrid send. Remaining steps, ~15 minutes once SendGrid
  account access is in hand:
  1. **Authenticate the `collegemocktrial.org` domain in SendGrid**
     (Sender Authentication → SPF / DKIM / DMARC). Add the DNS
     records SendGrid provides at the domain's DNS host. Required —
     without it, emails land in spam. This is the slow step (DNS
     propagation can take minutes to hours).
  2. **Add `SENDGRID_API_KEY` to Vercel** env vars (Production).
  3. **Redeploy** — env var changes don't apply to existing
     deployments.
  4. Click "Email link directly" on a contact, confirm a real
     email arrives, and verify it lands in Inbox (not Spam /
     Promotions).
  Note: `PROFILE_LINK_BASE_URL` is already set in Vercel
  (`https://crm.mocktrial.tech`) — done May 17.

- **Email automation for invitations.** Currently copy/paste manual.
  SEPARATE from the magic-link send shipped May 17 — that covered
  *profile* magic links only. This is the *invitation* email flow
  (`AcceptInvitationPage` / `FinishInvitationPage`): emailing a new
  user their invitation link instead of hand-sending it. Now mostly
  a known quantity — it's another SendGrid send, and
  `api/send-magic-link.ts` is the working template to copy
  (including the Node-runtime shape — see 🟢 LOW runtime note).
  Still recommended to complete RLS Tier 2 before onboarding
  additional users. Also intersects the active_invitations design
  discussion: tightening invitation access may want its own
  token-gated RPC.

- **🔒 SECURITY / DESIGN: Permissioning model design — multi-tier
  internal users + external token-gated users.** Surfaced May 16 while
  scoping the active_invitations RLS work (Profile V1 session).
  Currently load-bearing for several other backlog items.

  **Current state (placeholder, not bug):**
  - `is_current_user_admin()` is a binary — you're either an admin or
    an authenticated non-admin.
  - The `contacts` table has `true` on all RLS policies (SELECT,
    INSERT, UPDATE, DELETE). Any authenticated user can read or
    modify any contact. This is NOT a vulnerability discovery — it's
    been this way since the initial schema. It reflects that we
    haven't designed the real model yet, not that the real model is
    "everyone gets everything."
  - Other tables (e.g. `invitations`) ARE properly admin-gated via
    `is_current_user_admin()`.
  - External (non-authed) access works today via the
    token-gated SECURITY DEFINER RPC pattern, established and
    battle-tested by Profile V1 (May 16) — magic-link holders can
    read/edit a whitelisted slice of their own data without ever
    being an authenticated user.

  **Hypothesized target model (Jacinth, May 16):**
  - **Super Admin** — full access, can modify permissions for others.
    Today's `is_admin = true` users are effectively this.
  - **Admin** — most internal management actions but not
    permission-changing or destructive ops on other admins.
  - **Internal User** — read access to most things, write access
    scoped to their own work (their interactions, their assigned
    tasks, etc.). Probably the largest internal cohort eventually.
  - **External** — magic-link holders, no auth account required.
    Can ONLY read/edit their own whitelisted profile data via the
    token-gated RPC pattern. Already exists today (Profile V1).

  **Open design questions that need resolution before implementation:**
  1. Is the role stored on `contacts` (e.g. `internal_role` enum) or
     elsewhere (a `user_roles` table joined to auth.users)? The
     latter is more flexible for users with multiple hats; the
     former is simpler.
  2. How granular do policies need to be? Per-table is the obvious
     start. Per-row (e.g. "Internal Users see only their assigned
     contacts") is much more work — defer unless needed.
  3. Do we expose roles in the admin UI for self-service permission
     management, or stay SQL-only for now? Self-service is real work;
     SQL-only is fine for ~10 internal users.
  4. Migration strategy: tighten policies cautiously (start
     read-only, then mutations) and pair with a re-grant of full
     access to any Super Admin so we never lock ourselves out.
  5. How does `auth_user_id` linkage work post-accept-invitation in
     the new model? Today's `AcceptInvitationPage` does a direct
     write to `contacts.auth_user_id` which passes because of the
     `true` policy. In a tightened model, this may need to be its
     own SECURITY DEFINER RPC.

  **Why this is now load-bearing:**
  - **Blocks Tier 2/3 RLS audit completion.** Fixing the `active_*`
    view bypass is half the work; without a real permissioning
    model, the policies the views invoke are themselves
    placeholders, so the "fix" would just enforce permissive logic.
  - **Blocks active_invitations design.** Whatever pattern wins for
    invitations (probably token-gated SECURITY DEFINER, mirroring
    Profile V1) should be designed against the target model, not
    today's binary one.
  - **Blocks any future "let a non-admin user X do Y" feature.**
    Every such feature today requires either an `is_admin` toggle
    (overly broad) or a code-level check (fragile).

  **Established pattern that should carry forward:**
  - For external (non-authed) access by token: SECURITY DEFINER RPC,
    REVOKE PUBLIC + GRANT EXECUTE to anon/authenticated, with the
    function body doing the auth check (e.g. validating a token).
    Profile V1 shipped eight of these (verify_profile_token,
    get_profile_by_token, update_my_profile, create_profile_token,
    revoke_profile_token, add_my_affiliation, update_my_affiliation,
    delete_my_affiliation, search_programs_public).
  - For server-side callers using the service role (e.g. Vercel
    functions): a SECURITY DEFINER RPC with NO in-function auth gate
    is acceptable IF it is REVOKE'd from anon/authenticated so only
    the service role can call it, AND the calling function does its
    own authorization first. `create_profile_token_service()`
    (May 17) is the reference example.
  - For internal users with row-scoped access: probably the same
    pattern (SECURITY DEFINER RPC, function body checks role +
    ownership). But this needs design before committing.

  **Suggested next steps:**
  1. Workshop the four open questions above into concrete answers.
     One focused session with this entry as the brief.
  2. Sketch the migration shape (what new columns/tables, what new
     functions, what existing policies change). Pre-stage rollback
     files because policy migrations are high-risk.
  3. Ship in tightly-scoped phases: Super Admin role first (smallest
     blast radius), then Internal User, then per-row scoping where
     needed.
  4. Re-open the active_invitations + Tier 2/3 entries; they
     unblock as soon as the model is decided, even before
     implementation.

  **Notes for future sessions:**
  - The current `is_current_user_admin()` function is the natural
    extension point — add `is_current_user_super_admin()`,
    `is_current_user_internal()`, etc. alongside it rather than
    refactoring.
  - DO NOT tighten the `contacts` table policies without doing the
    rest of the model first. The accept-invitation flow currently
    relies on the `true` UPDATE policy to write `auth_user_id`.
    Breaking that breaks onboarding silently.
  - When the model lands, revisit the api/* functions' auth checks
    for consistency — see the 🟢 LOW "api/* admin-check
    inconsistency" item. `send-magic-link.ts` checks caller-is-
    admin; `contact-summary.ts` and others check only caller-is-a-
    user. That divergence is currently intentional but should be
    made deliberate and uniform under the real model.
  - Lessons from Profile V1 SECURITY DEFINER work to carry forward:
    - Use `p_` prefix on function parameters to avoid ambiguity with
      column names. PostgREST passes named args literally, so the
      client must match.
    - Postgres won't let you change a function's return type via
      CREATE OR REPLACE; you have to DROP first. Pick the JSON-vs-
      JSONB choice once and stay consistent.
    - VERIFY SCHEMA before writing migrations. Both program_affiliations
      and programs had `deleted_at` columns Claude wasn't expecting,
      which would have caused subtle bugs if not caught.
    - REVOKE PUBLIC + GRANT EXECUTE to anon/authenticated for every
      SECURITY DEFINER function. The default grants are too permissive.

- **🔒 SECURITY: RLS audit Tier 2/3 — close bypass on remaining ~19
  active_* views.** Tier 1 (AI views) shipped May 16. Tier 2/3 covers
  views over data with admin-only RLS, plus lower-risk operational
  data. Each view needs:
  - Full column list verified against base table via pg_get_viewdef
    or information_schema (NEVER from memory — lessons from May 13)
  - DROP + CREATE with `WITH (security_invoker = true)`
  - Smoke test of any feature querying it

  **⚠️ Now blocked by the permissioning model design above** — the
  view fix is necessary but not sufficient; the policies they'd then
  enforce are still placeholders (see contacts table `true` policies).
  Decide the model first, then this work becomes mechanical.

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

- **Unify the program picker UX across the app.**
  Three places currently pick programs and they're inconsistent:
  - `/profile` self-service edit (✅ uses the new ProgramCombobox)
  - `/alumni-signup` (uses an older long alphabetical dropdown)
  - Admin ContactDetailPage `ProgramAffiliationForm` modal (uses
    an older long alphabetical dropdown — see screenshot Jacinth
    flagged May 16)

  The UX problem: 483 programs in a browser-native `<select>` is
  brutal to navigate. The new ProgramCombobox (debounced search,
  keyboard nav, inactive-program markers) is meaningfully better
  and already exists in
  `src/features/profile/ProgramCombobox.tsx`.

  **Design question to resolve first:** ProgramCombobox is currently
  backed by the public `search_programs_public` RPC (anon/authed).
  Admin contexts could either:
  - **Reuse the public RPC** (simplest, no new code, returns the
    same shape) — fine if admin needs nothing more than name/city/
    state/short_name/status.
  - **Build an admin variant** (e.g. `search_programs_admin`)
    that returns additional fields admins care about — website,
    joined_year, notes preview, etc. More work but cleaner
    separation if admin UI ever diverges from the public picker.

  Recommended: start with reusing the public RPC. If admin UI
  ever needs more, add the variant then.

  Implementation: swap the two old-style `<select>` blocks for
  the ProgramCombobox component. Verify RPC GRANTs allow the
  authed admin context (currently GRANTed to anon + authenticated,
  so should Just Work). Smoke test both flows.

  Estimated 30-45 min for both sites + smoke testing.

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
  *Note (May 16): Profile V1 covers board members via magic link.
  "Alumni Phase 3" would extend the same token-gated RPC pattern
  to alumni claim flows or alumni self-service generally. Pattern
  is established; this is mostly a UI/scope decision.*

- **"Request login" button — self-service magic link.** A board
  member who lost their link enters their email on the login page
  and the system emails them a fresh magic link if a matching
  contact exists. Surfaced repeatedly during email-automation
  planning as a "nice bonus." Now genuinely small once SendGrid is
  live: `send-magic-link.ts` already does the mint-and-send; this
  is a public (non-admin) entrypoint to similar logic. Watch the
  security shape — it must NOT reveal whether an email matches a
  contact (always show the same "if that email is on file, we've
  sent a link" message regardless).

- **Sortable lists across Contacts / Programs / Events.**

- **Profile / Settings page** separate from Contact record.

- **CSV import for Programs.**

- **Revamp Home page.**

- **Officer terms inline edit.** See bug B2.

- **Bulk-assign Current Board Member.**

- **Cascade soft-delete for committees, contacts, events.**

- **Email Draft Generator.** Potential 6th AI feature.

- **Branded HTML email template (email v2).** The May 17 magic-link
  send uses plain text. A simple branded wrapper (AMTA logo, maroon
  header, footer) would make transactional emails look more
  legitimate and improve deliverability slightly. Deferred
  deliberately from the v1 email work. Applies to both the
  magic-link email and the invitation email once that ships.

- **Profile V1 polish (Chunk 6 leftovers).** Deferred from the May
  16 build session because polish is most valuable closer to launch
  (board meeting is July):
  - Friendlier network error copy — detect TypeError/ERR_CONNECTION_
    CLOSED specifically, say "Couldn't reach AMTA — check your
    connection and try again" instead of raw error message.
  - Auto-retry on transient network errors via React Query's
    `retry: 2` with exponential backoff. Catches in-flight WiFi
    blips silently (saw exactly this during May 16 testing).
  - Loading skeletons for the profile page instead of "Loading…"
  - Mobile responsiveness pass — text scaling, modal width,
    combobox dropdown height on phone-sized viewports.
  - Replace `window.confirm` on affiliation delete with a styled
    confirm dialog (lower priority since soft delete means
    mis-clicks are recoverable).

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

- **api/* admin-check inconsistency — revisit under permissioning
  model.** As of May 17, `api/send-magic-link.ts` verifies the
  caller is an admin (JWT identifies a user AND
  `contacts.is_admin = true`) before doing privileged work. The
  other api/* functions — `contact-summary.ts`, `meeting-brief.ts`,
  and likely `ask.ts` / `ask-title.ts` — verify only that the
  caller is a logged-in user, NOT that they're an admin. This
  divergence is currently INTENTIONAL: minting an access token is
  higher-stakes than generating an AI summary, so it earned the
  stricter gate. But it's an inconsistency that should be made
  deliberate and uniform when the permissioning model lands —
  decide per-endpoint what bar each one needs. Not urgent; the AI
  summary endpoints are low-stakes. Flagged so the inconsistency
  reads as a recorded decision, not an oversight.

- **`api/meeting-brief.ts` test-data filter follow-up.**
- **`api/meeting-brief.ts` and `api/contact-summary.ts` secondary
  email visibility.**
- **`/data` heatmap tooltip viewport-edge flipping.**
- **Add email consent disclosure to `/alumni-signup`.**
- **Find Chrome extension slowing Supabase calls locally.** Dev only.
- **Refresh contact-relationships screenshot in README.**
- **Clean up 308 latent TS errors incrementally.**
- **Add `npm run build` step to pre-push workflow.**

- **Thin API-wrapper layer for token-gated RPCs.** Profile V1
  scattered `supabase.rpc("update_my_profile", { p_token, ... })`
  calls across multiple files. When there are 5+ call sites it's
  worth extracting `src/features/profile/api.ts` so the `p_`
  prefix lives in one place. Rule-of-three threshold; not yet hit.

- **Edge vs Node runtime — `api/` folder is mixed now.** As of
  May 17, `api/send-magic-link.ts` is the ONE function on the
  Vercel **Node** runtime; every other api/* function is **Edge**.
  This is not tech debt to fix — it's a necessary split — but it
  IS a footgun worth recording:
  - The `@sendgrid/mail` SDK depends on Node built-ins (`fs`,
    `path`) the Edge runtime does not provide. Any function using
    it MUST declare `runtime: "nodejs"`.
  - Edge and Node handlers have DIFFERENT signatures. Edge gets a
    Web-standard `Request` and returns a `Response`. Node gets
    Express-style `(req, res)` — `req.headers` is a plain object
    (no `.get()`), `req.body` is pre-parsed, responses go out via
    `res.status(n).json(...)`. Switching a function's runtime
    means rewriting all of its request/response plumbing, not
    just the `config` line.
  - This bit twice during the May 17 build: first an Edge-runtime
    build failure (`@sendgrid` referencing `fs`/`path`), then,
    after switching to Node, a runtime crash
    (`request.headers.get is not a function`) because the body was
    still Edge-shaped.
  - `send-magic-link.ts` has a prominent header comment explaining
    all this. Future email functions (the invitation send) should
    copy `send-magic-link.ts` as the Node-runtime template.

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

  **Update (May 16):** Profile V1 effectively proved out option 1
  by shipping 8 token-gated SECURITY DEFINER RPCs in production.
  Pattern works and is the strong lean here. BUT this entry is now
  also blocked by the permissioning model design discussion in
  🔴 HIGH — the active_invitations design should land *against*
  the target permissioning model, not today's binary one.
  Specifically: `FinishInvitationPage` writes
  `contacts.auth_user_id` directly, which only works because of
  the `contacts` table's `true` UPDATE policy. Tightening that
  policy (which the permissioning model probably will) means the
  accept-invitation flow needs its own SECURITY DEFINER RPC for
  the linkage step. So the full invitations refactor needs to
  pair with the permissioning work.

  **Update (May 17):** the email-automation work added another
  relevant precedent — `create_profile_token_service()`, a
  service-role-only SECURITY DEFINER RPC with no in-function auth
  gate, called by a Vercel function that does its own admin check.
  If option 3 (dedicated endpoint) wins for invitations, that's
  the shape: the endpoint authorizes, a service-role RPC does the
  work. Options 1 and 3 are no longer far apart now that there's a
  working serverless-function precedent.
  
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

- **📧 Email automation: magic-link send (May 17).** Half-day
  session, executed the "option 2" plan from the May 16 handoff —
  do all the email work that DIDN'T need SendGrid account access,
  since access was pending. Shipped the entire backend + UI for
  emailing profile magic links; only the live SendGrid send
  remains, gated on account access.
  
  The arc:
  - Started blocked: SendGrid account confirmed to exist, but
    Jacinth couldn't log in yet. Chose to build everything up to
    the send rather than pivot to the Seasons fallback — email is
    the bigger external-user win.
  - Auth design decision: `send-magic-link.ts` verifies the caller
    is an *admin*, not just a logged-in user — a stricter bar than
    `contact-summary.ts`, because minting an access token is
    higher-stakes than generating a summary.
  - Option A vs B on token minting: chose A (a dedicated
    service-role RPC, `create_profile_token_service`) over B
    (re-implementing the revoke-then-insert in TypeScript) — to
    keep token logic as a single source of truth. Extracted
    `_mint_profile_token()` as a shared private helper so even the
    two SQL functions don't duplicate.
  - UI: two sidebar buttons (Option 2 of the flow choices) —
    "Generate link" (modal, unchanged) and "Email link directly"
    (server send, no modal). Mailto fallback preserved.
  
  Gotchas that bit us — the Edge-vs-Node runtime saga:
  - `@sendgrid/mail` needs Node built-ins (`fs`, `path`). Declaring
    the function as Edge runtime → build failure
    (`referencing unsupported modules: @sendgrid: fs, path`).
  - Switched `runtime: "edge"` → `"nodejs"`. Build passed, but the
    function crashed at runtime: `request.headers.get is not a
    function`. Cause: the function body was still written in Edge
    style (Web `Request`/`Response`), but Node-runtime handlers
    get Express-style `(req, res)`. Had to rewrite all the I/O
    plumbing.
  - Then walked the function to completion via a sequence of
    config errors, each one progress: "PROFILE_LINK_BASE_URL is
    not set" → set it, redeploy → "SENDGRID_API_KEY is not set",
    which is the expected final pre-SendGrid state. Walking a
    function to done via successive clear error messages turned
    out to be a clean verification method.
  - Lesson: switching a Vercel function's runtime is not a
    one-line config change — Edge and Node have genuinely
    different handler APIs. `send-magic-link.ts` is now the lone
    Node-runtime function and has a header comment saying so.
  - Smaller process note: the migration didn't apply the first
    time because the SQL editor ran only the statement under the
    cursor, not the whole file. Select-all before running.

- **🔗 Profile V1: magic-link self-service editor (May 16).** The big
  ship of this session. End-to-end shipped in one flight session:
  six chunks planned, five executed (Chunk 6 polish deferred). The
  arc:
  - Chunk 1: magic-link infrastructure (4 RPCs, profile_access_tokens
    table). Carried forward from earlier in the session.
  - Chunk 2: read-only profile page with three error states
    (no token / expired / load error).
  - Chunk 3: editable basic fields, separate-edit-mode UX.
  - Chunk 5: admin "Generate magic link" action with revoke-on-
    regenerate semantics. Initially shipped as a full-width section
    but immediately moved to sidebar after one round of feedback —
    "page is getting messy."
  - Chunk 4: editable affiliations + ProgramCombobox + soft delete.
    The biggest chunk; needed three new RPCs plus an extension to
    get_profile_by_token.
  
  Design decisions that mattered:
  - **Token-gated SECURITY DEFINER RPCs, not permissive RLS.** Six
    public RPCs, all REVOKE PUBLIC + GRANT EXECUTE to anon/authed,
    with function bodies that validate the token and check
    ownership before mutating. Establishes the pattern now expected
    to carry through to invitations and any other public-by-token
    flow.
  - **Primary email is locked.** Self-service editing is for
    name/pronouns/contact/location/affiliations but NOT primary
    email. Friendlier copy ("we keep this locked so AMTA always has
    a reliable way to reach you" + mailto link) instead of curt
    refusal.
  - **Affiliations: full add/edit/remove, but soft delete.** Was
    going to introduce typed-confirmation friction for delete until
    we discovered the schema *already* had `deleted_at` columns.
    The right design (recoverable delete via admin) was already
    half-built — we just had to wire up to it. Confirmed working
    end-to-end via SQL editor showing deleted_at timestamps.
  - **Combobox for 483 programs.** Searchable, debounced, keyboard-
    navigable, shows top 20 with empty query. Now lives in
    `src/features/profile/ProgramCombobox.tsx`. Reusable —
    /alumni-signup should adopt it.
  
  Gotchas that bit us:
  - **`p_` prefix on function parameters.** First add_my_affiliation
    call after Chunk 1 returned "function not found in schema cache"
    because we called it with `token` not `p_token`. Set the
    convention to match: always `p_` on Postgres function params.
  - **Postgres won't change function return types via CREATE OR
    REPLACE.** Tried to upgrade `get_profile_by_token` from `json`
    to `jsonb` in the Chunk 4 migration. Postgres rejected. Stuck
    with `json` for consistency with Chunk 1.
  - **VERIFY SCHEMA before writing migrations.** Both
    program_affiliations and programs already had `deleted_at`
    columns. Catching that mid-design changed the whole delete
    semantics (from "typed-confirm friction" to "soft delete is
    already the answer"). The schema pattern was already there.
  - **Transient network errors are real.** In-flight WiFi blip
    during smoke testing produced a "TypeError: Failed to fetch"
    that looked like a code bug. Wasn't — pure network. Retry
    worked first try. Added "auto-retry + friendlier error copy"
    to Chunk 6 polish.
  
  Bigger story to capture: this session also surfaced the
  permissioning model design discussion in 🔴 HIGH. What started
  as "let's write up the active_invitations design now that we
  have the pattern" became "wait, the `contacts` table has `true`
  RLS policies, that's not active_invitations' fault, the whole
  permissioning model needs a real design." A great example of
  "session that produces something different than what was planned
  but more valuable."

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
