# AMTA CRM — Project Handoff

**As of:** May 21, 2026
**Read this when:** `CLAUDE.md` points here for deeper context on a topic, or before starting work on permissioning, email, RLS, or any cross-cutting change.

This file is the longer story: where the project is, what has been shipped, what was learned the hard way, and how to think about the next pieces. `CLAUDE.md` (at the repo root) is the short fast-start. `docs/BACKLOG.md` is the source of truth for what's planned. `docs/permissioning-model.md` is the agreed permissioning spec.

---

## What the project is

The AMTA CRM is a production system used by the American Mock Trial Association to manage contacts, board members, alumni, programs, events, and related operations. Jacinth Sohi (AMTA President) is the operator and the primary developer. The CRM is live at `crm.mocktrial.tech`. Real users depend on it. There is one Supabase project (`amta-crm-prod`); there is no separate dev environment.

The architecture is a React 18 + TypeScript + Vite + Tailwind frontend, Supabase (Postgres + Auth + RLS + RPCs) backend, and Vercel for the frontend host + a small number of serverless `api/` functions. Pushing to `main` deploys to production.

---

## Where things stand (May 21, 2026)

### Recently shipped

- **Invitation email flow.** Admins on `/admin/invitations` can "Send invitation" and "Resend" — both create/refresh the invitation row and email it via `api/send-invitation-email.ts` (Node runtime, admin-gated). The page orchestrates row-then-email as two visible steps so failure modes stay legible. Branded HTML email with an "Accept Invitation" button. `invitations.sent_at` is stamped with the real send time on success.
- **Profile magic-link email.** Admins email a profile magic link to a contact via `api/send-magic-link.ts`. Same branded shell. The branded HTML is inlined in both functions (see "Hard-won constraints" below — this is deliberate).
- **Permissioning model — design.** The full model is specced in `docs/permissioning-model.md`. Four roles (Super Admin / Admin / Internal User / External), `internal_role` enum on `contacts`, nested role-check functions, five-phase migration. The doc is the agreed spec; future sessions implement against it.
- **Permissioning Phase 0.** Purely additive, zero behavior change. Enum + column added, `active_contacts` view refreshed, role-check functions added, `is_current_user_admin()` redefined to nested form, single admin backfilled to `super_admin`. Forward + rollback both tested against Postgres 16 before applying.
- **Program picker unification.** Shared `ProgramCombobox` (debounced search via `search_programs_public` RPC) now used in `/alumni-signup` and the admin `ProgramAffiliationForm` modal — replaced the old plain `<select>` over all ~483 programs.

### Where to pick up

There is no single teed-up task. The natural next steps, in priority order:

1. **Permissioning Phase 1** — convert `accept-invitation` to a SECURITY DEFINER RPC. Spec in `docs/permissioning-model.md` §6. This is the landmine: it **must** land before Phase 2 touches `contacts` policies. The current `AcceptInvitationPage` / `FinishInvitationPage` write `contacts.auth_user_id` directly and only succeed because the `contacts` UPDATE policy is `true`. Tighten that policy without this work first and new-user onboarding breaks silently.
2. **Contacts filtering Phase 1** — well-scoped 🟡 MEDIUM. Simple field filters (standing, tags, has-email/phone, location) combining as AND. Genuinely ~one session IF the Contacts list loads client-side; verify that first. The combinatorial query builder is a separate Phase 2+ design discussion (see `docs/BACKLOG.md`).
3. **Profile V1 Chunk 6 polish** — clean filler if a session ends early.
4. Open: anything else in `docs/BACKLOG.md` that matches the session.

---

## Hard-won constraints — these are not opinions

Each was learned by breaking production and digging out. Do not re-test by re-attempting.

### Vercel does not bundle cross-file imports into Node-runtime `api/` functions

Two `api/` functions use the Node runtime (because `@sendgrid/mail` needs Node built-ins): `api/send-magic-link.ts` and `api/send-invitation-email.ts`. Both must be **fully self-contained**. We tried twice to extract a shared branded-email helper:

1. `api/_email-template.ts` (sibling import): `ERR_MODULE_NOT_FOUND` at runtime, production 500'd.
2. `src/lib/email-template.ts` (cross-directory import): verified in isolation first with a throwaway `bundleTest()` helper imported into one function — also `ERR_MODULE_NOT_FOUND`.

Conclusion: this Vercel project does not bundle any cross-file import into Node-runtime functions. Each Node function must be standalone. Critically, `npm run build` does NOT catch this — it builds green; the function 500s at runtime.

The branded HTML is therefore inlined in both functions (~100 lines of table markup, deliberately duplicated). The duplication is correct, not debt. If you ever want to dedupe: prove cross-file bundling works in isolation first (a throwaway import + a real deploy), not by assumption. Recorded in `BACKLOG.md` under 🟡 MEDIUM as a ⚠️ "do NOT extract" item.

There is a separate, parallel reality: the Edge `api/` functions (most of them) appear to handle imports differently. Whether cross-file imports work for Edge has not been tested. If you ever need a shared helper for Edge functions specifically, treat it as untested and verify.

### `active_contacts` is an explicit-column view, with two consequences

`active_contacts` is the soft-delete-filtering view (`WHERE deleted_at IS NULL`) used by RLS functions like `is_current_user_admin()`. It has an **explicit column list** — every column named one by one, not `SELECT *`.

Two things this means:

- Adding a column to `contacts` does NOT automatically expose it on the view. Queries that read `active_contacts.<new_column>` fail with "column does not exist." Any new column on `contacts` that RLS functions need must also be appended to `active_contacts` in the same migration.
- `CREATE OR REPLACE VIEW` is **positional**. It can append columns at the end. It cannot:
  - Insert a column mid-list (Postgres reads that as renaming the column at that position: `ERROR 42P16: cannot change name of view column ... use ALTER VIEW ... RENAME COLUMN`).
  - Remove a column (`ERROR: cannot drop columns from view`). To shrink a view: `DROP VIEW` then `CREATE VIEW`.

The Phase 0 migration's history is the proof: forward needed an APPEND of `internal_role` after `deleted_at` (not a tidy insert next to `is_admin`); rollback needed `DROP + CREATE` (not `CREATE OR REPLACE`).

Phase 2/3 will touch this view again. Read `docs/permissioning-model.md` and this section before that work starts.

### Verify environment-specific behavior by RUNNING, not by reading

Both constraints above were caught only by running code. The migration above took four attempts because the first three relied on inspection. The Vercel bundling failure took two attempts for the same reason.

The discipline that works:

- **For migrations**: `apt install postgresql` and test forward + rollback against a local Postgres 16 instance before applying to prod. Seed it with a fixture that mirrors the prod schema for the relevant pieces. Run the full cycle (forward → rollback → forward again — the re-apply proves the rollback was fully atomic).
- **For Vercel functions**: deploy a throwaway test in isolation if anything is novel (a `bundleTest()` import, an unfamiliar runtime feature) before wiring it into a real feature. The deploy log is the only source of truth.
- **`npm run build`** is necessary but not sufficient. It catches TypeScript and bundle errors *for the frontend*. It does not catch Vercel Node-runtime import resolution failures, Postgres-specific behavior, or runtime errors of any kind.

This is the lesson the project is paying for. Apply it.

---

## The permissioning model — current state

Read `docs/permissioning-model.md` for the agreed spec. Quick reference:

### The four roles

- **Super Admin** — full access; the only role that can change other users' roles
- **Admin** — most internal management; cannot change roles, cannot act on other Admins/Super Admins
- **Internal User** — read most internal data; write own work
- **External** — magic-link / invitation-token holders; no auth account; token-gated SECURITY DEFINER RPC pattern (Profile V1)

### Schema

- `contacts.internal_role` enum (`super_admin`, `admin`, `internal_user`). NULL means "not an internal user" — most contacts have this.
- `contacts.is_admin` boolean — still present, will be retired after the migration completes (see `docs/permissioning-model.md` §5.3).

### Role-check functions

All three follow the same shape: `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'`, reading from the `active_contacts` view.

- `is_current_user_super_admin()` — narrowest. True only for `super_admin`. Used where the Super/Admin distinction matters (role management).
- `is_current_user_admin()` — nested. True for **both** `admin` and `super_admin`. This is the load-bearing redefinition: every existing RLS policy that calls this function keeps working unchanged because a Super Admin is correctly still "at least an admin."
- `is_current_user_internal()` — broadest. True for any non-NULL role.

### Migration phasing — the order is load-bearing

- **Phase 0 (shipped)** — additive. Enum + column + functions + view refresh + backfill. No enforcement change.
- **Phase 1 (next)** — convert `accept-invitation` to a SECURITY DEFINER RPC. **Must** ship before Phase 2.
- **Phase 2** — tighten `contacts` policies onto the real role model. Only safe after Phase 1.
- **Phase 3** — remaining tables + Internal User scoping.
- **Phase 4** — self-service role-management UI (specced in detail in §7 of the design doc).

### Why Phase 1 is the landmine

The `accept-invitation` page writes `contacts.auth_user_id` directly. That succeeds today because the `contacts` UPDATE policy is `true`. The moment Phase 2 tightens that policy, this direct write breaks — and onboarding breaks **silently** (no error a new user would see until they can't get in). So Phase 1 builds the SECURITY DEFINER RPC for that linkage step, points the page at it, and verifies onboarding works end-to-end while the policy is still `true`. Only then does Phase 2 become safe.

Pattern to follow for Phase 1: the Profile V1 RPCs (e.g. `create_profile_token`, `verify_profile_token`) are the template. REVOKE PUBLIC + GRANT EXECUTE to the right role; in-function auth gate (the user IS authenticated at this point — they just signed in via OAuth — they're not yet linked to a contact).

---

## Email automation — current shape

Both email features (magic links + invitations) are fully shipped and verified in production.

### Functions

- `api/send-magic-link.ts` — Node runtime. Verifies caller JWT → verifies admin → mints a profile token via `create_profile_token_service` → emails branded link via SendGrid.
- `api/send-invitation-email.ts` — Node runtime. Verifies caller JWT → verifies admin → loads invitation row by id (does NOT mint — the token is generated client-side in `useSendInvitation`) → emails branded link. Stamps `invitations.sent_at` on success.

### Two token-minting RPCs (don't add a third)

- `create_profile_token()` — admin-gated (`is_current_user_admin()`). Called from the browser.
- `create_profile_token_service()` — NO auth gate, service-role only (REVOKE'd from anon/authenticated). Called by `api/send-magic-link.ts`, which does its own admin check first.
- Both delegate to private `_mint_profile_token()`. Extend the helper; don't add a third minting path.

Invitation tokens are different — they're generated client-side in `useSendInvitation` (`crypto.getRandomValues`) and stored on the invitations row. No RPC. The email endpoint just reads the existing token.

### SendGrid

- Domain `collegemocktrial.org` authenticated. API key scoped to Mail Send only (least privilege).
- From-address `amta@collegemocktrial.org`. There's a 🟢 LOW item to swap to `help@` once that mailbox is monitored.
- Click tracking is ON (account-wide). It rewrites links to a tracking redirect. Fine in HTML emails (the button label hides the rewritten URL); iceboxed for re-evaluation.

### Branded HTML

Inlined in both functions. ~100 lines of `<table>`-based markup, inline styles, system font stack, white logo on a maroon (`#70172a`) header band, "Update My Profile" / "Accept Invitation" button. The HTML is duplicated by design — see the "Hard-won constraints" section above.

---

## Working with Jacinth — style and culture

- **Honest pushback is welcomed.** Vague optimism is not. When scope is wrong, when an assumption is shaky, when something is bigger than it looks — say so plainly. The strongest sessions are the ones where Claude pushed back early on a bad direction.
- **Pause on design decisions before coding.** When a request contains a real fork (option A vs. option B with different tradeoffs), surface it. Don't pick silently.
- **One commit per coherent feature.** Phased work gets phased commits. Commit messages should explain the *why* (especially for non-obvious decisions), not just the *what*.
- **Migrations**: every forward has a `_rollback.sql` sibling staged. Both files commit together.
- **Smoke testing in the app is on Jacinth, but flag what to check.** SQL verification and a green build are necessary, not sufficient. After deploying anything: tell her specifically which UI paths to exercise. Don't just say "test it."
- **Documentation is part of shipping.** Backlog and design docs are kept current — stale entries mislead future sessions (this week we found two stale items). When a task ships, update the relevant doc in the same session if possible.
- **It's fine to stop.** A clean stopping point with prod healthy beats one more change that didn't quite land.

---

## Document map

| File | Purpose |
|---|---|
| `CLAUDE.md` | Repo-root fast-start. Read every session. |
| `HANDOFF.md` | This file. Read when `CLAUDE.md` points here or before cross-cutting work. |
| `docs/BACKLOG.md` | Source of truth for what's done, in-progress, planned. Always check before starting. |
| `docs/permissioning-model.md` | Agreed permissioning design (5 phases). |
| `docs/bug-stories/` | Postmortems on production bugs. Worth a single read-through to internalize failure modes. |
| `docs/specs/` | Earlier spec docs (Profile V1, etc.). |
| `migrations/` | Forward migrations + `_rollback.sql` siblings. |

---

## Test resources

- Jacinth's contact_id: `96ea6367-9256-4545-be99-3a7c2ce34ec2`
- Magic-link email: `/contacts/{id}` → "Email link directly"
- Invitation email: `/admin/invitations` → pick a contact → "Send invitation"; or "Resend" on an existing row
- Profile page: `https://crm.mocktrial.tech/profile?token=<t>`
- Invite acceptance: `https://crm.mocktrial.tech/accept-invitation?token=<t>`

---

## A closing note from the previous session

May 21 shipped a lot — invitation email, permissioning design, Phase 0, program picker unification, two backlog cleanups. It also lost real time to two preventable failures (Vercel bundling, the four-attempt migration), both caused by verifying assumptions through reading instead of running. Those lessons are now written into this file and the constraint section above; the goal of this handoff is that the next session does not pay the same cost. If you find yourself confidently believing something about Vercel's bundling, Postgres view rules, or any other environment-specific behavior — verify by execution before depending on it. That's the discipline this project has earned.
