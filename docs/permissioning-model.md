# AMTA CRM — Permissioning Model Design

**Status:** DESIGN — not yet implemented. This document is the
agreed specification; implementation happens in later sessions,
phased, against this frozen spec.
**Created:** May 21, 2026
**Supersedes:** the "Permissioning model design" brief in
`docs/BACKLOG.md` (May 16). That entry remains the historical
context; this doc is the resolved design.

---

## 1. Context & current state

The CRM today has a **single-boolean** permission model:
`contacts.is_admin`. A user is either an admin or an authenticated
non-admin. There is no finer distinction.

What this means in practice:

- `is_current_user_admin()` — a SQL function — is the only role
  check in the system. It has exactly ONE definition site; it is
  referenced by RLS policies on the admin-gated tables and (via a
  parallel TypeScript check) by some `api/` functions.
- The **`contacts` table has `true` on all four RLS policies**
  (SELECT, INSERT, UPDATE, DELETE). Any authenticated user can read
  or modify any contact row. This is NOT a vulnerability discovery
  — it has been this way since the initial schema. It reflects that
  the real model was never designed, not a decision that "everyone
  gets everything."
- Other tables (e.g. `invitations`) ARE properly admin-gated via
  `is_current_user_admin()`.
- **External (non-authenticated) access already works** via the
  token-gated SECURITY DEFINER RPC pattern established by Profile V1
  (May 16). Magic-link holders read/edit a whitelisted slice of
  their own data without ever holding an auth account. This pattern
  is battle-tested and carries forward unchanged.

**Why the new model is mostly additive (low risk):** because the
current model is just one boolean checked in one function, there is
no sprawling permission logic to untangle. The work is adding new
roles and new checks alongside the existing one — not refactoring a
complex system.

**The one genuine landmine** — see §6, Phase 1 — is that the
accept-invitation flow currently depends on the wide-open `contacts`
UPDATE policy. Tightening `contacts` policies without first fixing
that flow breaks new-user onboarding silently.

---

## 2. The four roles

The model has four roles. Three are internal (hold an auth account);
one is external (token-gated, no account).

### Super Admin
Full access to everything. The only role that can **change other
users' roles** (see §7). Today's `is_admin = true` users become
Super Admins on migration.
- All read, all write, all destructive operations.
- Can manage permissions / assign roles.
- Can act on other admins.

### Admin
Most internal management actions. Cannot change permissions and
cannot perform destructive operations on *other admins*.
- All read.
- Write/manage: contacts, invitations, events, programs, etc.
- CANNOT: assign or change roles; delete or demote other Admins or
  Super Admins.

### Internal User
Read access to most internal data; write access scoped to their own
work. Expected to be the largest internal cohort over time.
- Read: most internal tables (per-table grant — see §3, Q2).
- Write: their own interactions / assigned work.
- CANNOT: manage other users, invitations, or roles; no destructive
  ops beyond their own records.

### External
Magic-link / invitation-token holders. No auth account. Can ONLY
read/edit their own whitelisted profile data via the token-gated
SECURITY DEFINER RPC pattern. **This role already exists and works
today** (Profile V1) — it is included here for completeness; the
new model does not change it.

> A capability matrix (role × table × operation) will be appended
> as §9 once the schema section is complete — it is the
> implementation checklist for the RLS policies.

---

## 3. Resolved design questions

These were the open questions in the May 16 brief. Resolved:

**Q1 — Where does the role live?**
→ **An enum column on `contacts`** (`internal_role`), not a separate
`user_roles` table. One person = one role for AMTA's internal
cohort (~10 people); a join table is flexibility that would be
carried unused. It is also a clean evolution of today's boolean.
If multi-role ever becomes real, enum → table is a tractable later
migration.

**Q2 — How granular?**
→ **Per-table for v1. Per-row scoping is explicitly deferred.**
Internal Users see all contacts (per-table read grant). Per-row
scoping ("see only your assigned contacts") is a large jump in
policy complexity and may never be needed for an org CRM where
internal staff legitimately need the whole contact base. Noted as a
future extension point, not v1 scope.

**Q3 — How are roles assigned?**
→ **A self-service role-management UI is in scope** — but as the
LAST implementation phase, after the model foundation is shipped and
stable. Full design in §7. Until that phase ships, roles are set via
SQL.

**Q4 — Migration strategy.**
→ Phased, cautiously, never locking ourselves out. Full plan in §6.
Principle: additive changes first; convert accept-invitation before
tightening `contacts`; Super Admin always retains full access;
every phase pairs with a pre-staged rollback.

**Q5 — `auth_user_id` linkage post-accept-invitation.**
→ The accept-invitation flow becomes its own SECURITY DEFINER RPC.
This is Phase 1 and is the prerequisite for tightening `contacts`
policies — see §6.

---

## 4. Enforcement principle

A permission model lives in three layers. They must agree, and one
must be the source of truth.

**The database is the real security boundary.**
- **RLS policies + role-check SQL functions are authoritative.** If
  the database wouldn't allow it, it doesn't happen — regardless of
  what the UI or an API function does.
- **API functions (`api/*`) enforce consistently.** Today they do
  not: `send-magic-link.ts` checks caller-is-admin;
  `contact-summary.ts` and others check only caller-is-a-user. This
  divergence is currently intentional but undocumented. Under this
  model it becomes a **stated rule** (see §5) — every `api/`
  function declares which role it requires, and the check is
  uniform. This resolves the 🟢 LOW "api/* admin-check
  inconsistency" backlog item.
- **The UI is convenience only.** Hiding a button the user can't use
  is good UX, but it is NOT security. The UI must never be the only
  thing standing between a user and an action.

Practical consequence: every new capability is enforced in the
database FIRST (RLS or a SECURITY DEFINER RPC). UI gating is added
on top for polish, never as the primary control.

---

## 8. What this unblocks

Once this doc is approved (even before implementation):

- **RLS audit Tier 2/3** can resume. Today the `active_*` view
  bypass fix is half the work; the policies those views invoke are
  placeholders. With the real model decided, the audit has a target
  to enforce against instead of enforcing permissive logic.
- **active_invitations design** can resume. Whatever pattern wins
  (likely token-gated SECURITY DEFINER, mirroring Profile V1) can be
  designed against the four-role model rather than today's binary.
- **Any future "let a non-admin do X" feature** stops requiring
  either an overly-broad `is_admin` toggle or a fragile code-level
  check.

---

## SECTIONS PENDING

The following are drafted once the current `is_current_user_admin()`
definition is in hand (needed to mirror its exact structure):

- **§5 — Schema changes.** The `internal_role` enum; new role-check
  functions (`is_current_user_super_admin()`, `_admin()`,
  `_internal()`) added ALONGSIDE `is_current_user_admin()` per the
  May 16 guidance; the `is_admin` retirement path.
- **§6 — Phased migration plan.** Phase 0 additive (enum +
  functions, backfill, no enforcement change); Phase 1 convert
  accept-invitation to a SECURITY DEFINER RPC; Phase 2 tighten
  `contacts` policies; Phase 3 remaining tables + Internal User
  scoping; Phase 4 the self-service role UI. Each with rollback.
- **§7 — Self-service role-management UI.** Full design: the screen,
  the admin-gated mutation path, and the guardrails (no last-Super-
  Admin demotion; Super Admin only can change roles; self-demotion
  protection; audit trail on every role change).
- **§9 — Capability matrix.** Role × table × operation — the
  implementation checklist for the RLS policies.
