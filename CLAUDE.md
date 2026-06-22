# CLAUDE.md

You are working on the **AMTA CRM** — a production CRM for the American Mock Trial Association, used by Jacinth Sohi (AMTA President). The app is live at `crm.mocktrial.tech`. **Real users depend on it.** Treat every change accordingly.

This file is your fast onboarding. The full session-by-session history and deeper context live in `HANDOFF.md` at the repo root.

---

## Stack at a glance

- React 18 + TypeScript + Vite + Tailwind
- Supabase: `amta-crm-prod` (single environment, no separate dev project), `ifnadlzcdtydbkqnyeif.supabase.co`
- Vercel: auto-deploys on push to `main`
- Brand: maroon `#70172a`
- Repo: `github.com/jacinthsohi/amta-crm`

There is no staging environment. Pushing to `main` deploys to production. Be deliberate.

---

## Hard-won constraints — READ BEFORE TOUCHING THESE AREAS

These are not opinions. Each was learned by breaking production and digging out. **Do not re-test them by re-attempting.**

### 1. Vercel does not bundle cross-file imports into Node-runtime `api/` functions

The two `api/` functions on the Node runtime (`api/send-magic-link.ts`, `api/send-invitation-email.ts`) must be **fully self-contained**. They cannot import from:
- a sibling `api/` file (tested: `ERR_MODULE_NOT_FOUND`)
- `src/lib/` or anywhere else in the repo (tested: `ERR_MODULE_NOT_FOUND`)

`npm run build` does NOT catch this — it builds green, then the function 500s at runtime. The branded email HTML is therefore inlined in both files (~100 lines of table markup, deliberately duplicated). If you ever want to dedupe it, the only safe path is to prove cross-file bundling works in isolation with a throwaway import + a real deploy — verify, do not assume.

This is recorded under 🟡 MEDIUM in `docs/BACKLOG.md` as a ⚠️ "do NOT extract" item.

### 2. `active_contacts` is an explicit-column view

`active_contacts` is the soft-delete-filtering view used by RLS functions. It has an **explicit column list** (not `SELECT *`). Two consequences that bit us:

- Adding a column to `contacts` does NOT make it appear in the view. The view must be refreshed too.
- `CREATE OR REPLACE VIEW` can **append** columns at the end but cannot insert mid-list (Postgres reads that as a column rename: `42P16: cannot change name of view column`) and cannot **remove** columns (`cannot drop columns from view`). To shrink a view: `DROP VIEW` then `CREATE VIEW`.

Phase 2/3 of the permissioning migration will touch this again. See `docs/permissioning-model.md`.

### 3. Verify environment-specific behavior by RUNNING, not reading

Both constraints above were found by running code, not by inspection. For migrations: test against a local Postgres before applying. For Vercel functions: deploy a throwaway test if anything looks novel. `npm run build` is necessary but not sufficient — it does not catch Vercel runtime errors or Postgres view rules.

---

## The four roles (permissioning model — partially live)

The permissioning model is **in mid-migration**. Design doc: `docs/permissioning-model.md`. Read it before changing anything access-related.

- **Super Admin** — full access; only role that can change roles
- **Admin** — most internal management; cannot change roles or act on other admins
- **Internal User** — read most internal data; write own work
- **External** — magic-link / invitation-token holders, no auth account

**Currently shipped (Phase 0, May 21):** the `internal_role` enum + column on `contacts`, three role-check functions (`is_current_user_super_admin`, `is_current_user_admin`, `is_current_user_internal`). `is_current_user_admin()` is now **"at least Admin"** — true for both `'admin'` and `'super_admin'`. **Zero behavior change** versus pre-Phase-0 — existing RLS policies are unaffected.

**Not yet shipped:** Phases 1–4. Phase 1 (accept-invitation → SECURITY DEFINER RPC) **must land before Phase 2** touches `contacts` policies — the current accept-invitation flow writes `contacts.auth_user_id` directly, which only succeeds because `contacts` policies are `true`. Tighten `contacts` first and onboarding breaks silently.

The `contacts` table still has open (`true`) RLS policies on SELECT/INSERT/UPDATE/DELETE. This is intentional during the migration — do not "fix" it before Phase 1 ships.

---

## Working with Jacinth

- **Strong feedback culture.** She wants honest pushback when scope is wrong, when an assumption is shaky, and when something is bigger than it looks. "This is harder than it sounds" is welcome — vague optimism is not.
- **Pause for design decisions before coding.** When a request has a real fork in it, surface it. Don't pick silently.
- **One commit per coherent feature.** Phased work gets phased commits.
- **Smoke test in the app.** SQL verification and a green build are necessary, not sufficient. After deploying anything, exercise the actual UI path.
- **She'll smoke-test, but flag what specifically she should check.** Don't just say "test it."

---

## Conventions in this repo

- **Migrations** live in `migrations/`. Every migration ships with a `_rollback.sql` sibling. Forward migrations are transactional (`BEGIN`/`COMMIT`).
- **Migration testing:** for non-trivial migrations, test against a local Postgres 16 before applying. The `BEGIN`/`COMMIT` wrapper makes them safely abortable, but several real bugs this week were caught only by running, not reading.
- **SECURITY DEFINER conventions** (from Profile V1 + later work):
  - `p_` prefix on function parameters
  - `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'`
  - Read from `active_contacts` (not `contacts`) for soft-delete handling
  - `REVOKE PUBLIC` + targeted `GRANT EXECUTE` for every such function
  - Cannot change return type via `CREATE OR REPLACE` — `DROP FUNCTION` first
- **Two token-minting patterns coexist:**
  - `create_profile_token()` — admin-gated, called from the browser
  - `create_profile_token_service()` — service-role-only (REVOKE'd from anon/authenticated), called by `api/send-magic-link.ts`
  - Both delegate to private `_mint_profile_token()`. Do not add a third minting path; extend the helper.
- **Email functions:**
  - `api/send-magic-link.ts` — profile magic-link, Node runtime, admin-gated
  - `api/send-invitation-email.ts` — invitation email, Node runtime, admin-gated
  - Both are self-contained (see constraint #1). Branded HTML is inlined in each.
- **Env vars** (already set in Vercel): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`, `PROFILE_LINK_BASE_URL`, `ANTHROPIC_API_KEY`.

---

## Documents you should know

| File | What it is |
|---|---|
| `docs/BACKLOG.md` | The source of truth for what's done, in-progress, and planned. Always check before starting a task. |
| `docs/permissioning-model.md` | The agreed permissioning design (5 phases). Phase 0 is shipped; Phase 1 is next. |
| `HANDOFF.md` | Deeper session-by-session context, lessons, and reasoning. Read it when this file points there. |
| `docs/bug-stories/` | Postmortems on past production bugs. Worth reading once to internalize the failure modes. |

---

## Where to start

There is no single teed-up task. `docs/BACKLOG.md` is the source of truth. The natural next steps:

- **Permissioning Phase 1** — convert `accept-invitation` to a `SECURITY DEFINER` RPC. Spec lives in `docs/permissioning-model.md` §6. Must land before any Phase 2 work.
- **Contacts filtering Phase 1** — a small, well-scoped 🟡 MEDIUM item: simple field filters on the Contacts list. Roughly one session.

Read `BACKLOG.md`, pick a task that matches the session's appetite, confirm with Jacinth before building anything substantial.
