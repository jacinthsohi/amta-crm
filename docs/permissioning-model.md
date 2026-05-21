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

## 5. Schema changes

### 5.1 The `internal_role` enum

A Postgres enum type, and a column on `contacts`:

```
CREATE TYPE internal_role AS ENUM (
  'super_admin',
  'admin',
  'internal_user'
);

ALTER TABLE public.contacts
  ADD COLUMN internal_role internal_role;
```

Notes:
- The enum has **three** values, not four. "External" is not an
  internal role — external users have no `contacts.auth_user_id`
  auth account; they are token-gated and never carry a role. The
  column is NULL for contacts who are not internal users at all
  (the majority of the contact base — most contacts are just
  people AMTA tracks, not CRM logins).
- The column is **nullable on purpose**: NULL = "not an internal
  user." Only contacts who actually log in get a role.
- Enum value order matters for readability but the checks do not
  rely on ordinal comparison — see 5.2.

### 5.2 Role-check functions

Three new functions, added **alongside** `is_current_user_admin()`,
each structurally identical to it — `LANGUAGE sql`, `STABLE
SECURITY DEFINER`, `SET search_path = 'public'`, and reading from
the **`active_contacts` view** (NOT the `contacts` base table) so
soft-deleted users are excluded for free, exactly as the existing
function does.

```
-- Narrowest: only Super Admins.
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.active_contacts c
    WHERE c.auth_user_id = auth.uid()
      AND c.internal_role = 'super_admin'
  );
$$;

-- "At least an internal user" — any of the three roles.
CREATE OR REPLACE FUNCTION public.is_current_user_internal()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.active_contacts c
    WHERE c.auth_user_id = auth.uid()
      AND c.internal_role IS NOT NULL
  );
$$;
```

**`is_current_user_admin()` is REDEFINED to nest the roles.**
Today it checks `is_admin = TRUE`. It is rewritten to mean
"**at least Admin**" — true for both `'admin'` and `'super_admin'`:

```
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.active_contacts c
    WHERE c.auth_user_id = auth.uid()
      AND c.internal_role IN ('admin', 'super_admin')
  );
$$;
```

**Why nest:** every RLS policy and `api/` check that already calls
`is_current_user_admin()` keeps working unchanged — a Super Admin
is correctly still "an admin" for all admin-gated tables. The
Super/Admin distinction is enforced ONLY where it matters (role
management), via the narrower `is_current_user_super_admin()`.
This is what makes Phase 0 a true zero-behavior-change step: once
roles are backfilled, the redefined `is_current_user_admin()`
returns exactly what the old `is_admin = TRUE` version did.

> The function-redefinition note in the May 16 brief applies:
> Postgres allows `CREATE OR REPLACE` here because the return type
> (`boolean`) does not change. No DROP needed.

### 5.3 The `is_admin` retirement path

`contacts.is_admin` is NOT dropped immediately — that would be two
sources of truth mid-migration. Sequence:
1. Phase 0 backfills `internal_role` FROM `is_admin`
   (`is_admin = TRUE` → `'super_admin'`; see §6).
2. All checks move to `internal_role` (the redefined functions do
   this atomically — nothing else reads `is_admin` in SQL; the
   grep found only UI reads and the `database.types.ts` mirror).
3. The UI reads (`useIsAdmin`, `AccessPage`) are migrated to the
   new role functions/field in Phase 2.
4. Once nothing reads `is_admin`, a final phase drops the column.
   This is deliberately LAST and low-priority — a dormant unused
   column is harmless; a premature drop is not.

---

## 6. Phased migration plan

Five phases. Each is independently shippable, each pairs with a
**pre-staged rollback file** (policy migrations are high-risk), and
the ordering is load-bearing — especially Phase 1 before Phase 2.

### Phase 0 — Additive foundation (zero behavior change)
- Create the `internal_role` enum; add the nullable column.
- **Backfill:** `UPDATE contacts SET internal_role = 'super_admin'
  WHERE is_admin = TRUE;` — today's admins become Super Admins.
  (Everyone else stays NULL for now; Internal User / Admin
  assignment happens by hand or via the Phase 4 UI.)
- Add `is_current_user_super_admin()` and
  `is_current_user_internal()`.
- Redefine `is_current_user_admin()` to the nested version.
- **Nothing about enforcement changes.** No policy is touched. After
  this phase the system behaves identically — verifiable by
  confirming admin-gated pages still work for an admin and still
  block a non-admin.
- Risk: minimal. Rollback: drop the new functions, restore the old
  `is_current_user_admin()` body, drop the column + enum.

### Phase 1 — Convert accept-invitation to a SECURITY DEFINER RPC
**This is the landmine, and it MUST ship before Phase 2.**
- Today `AcceptInvitationPage` / `FinishInvitationPage` write
  `contacts.auth_user_id` directly. That write succeeds **only
  because the `contacts` UPDATE policy is `true`**. The moment
  Phase 2 tightens that policy, this write breaks — and onboarding
  breaks SILENTLY (no error anyone notices until a new user can't
  get in).
- So: build a SECURITY DEFINER RPC — e.g.
  `link_auth_user_to_contact(p_invitation_token, p_auth_user_id)`
  — that validates the invitation token and performs the
  `auth_user_id` write internally, under definer privileges.
  Mirror the Profile V1 pattern: REVOKE PUBLIC, GRANT EXECUTE to
  `authenticated` (the user IS authenticated by this point — they
  just signed in via OAuth — they simply aren't yet linked to a
  contact row).
- Point the accept-invitation pages at the RPC instead of the
  direct write.
- **Verify onboarding still works end-to-end while `contacts`
  policies are still `true`** — i.e. prove the RPC works before it
  becomes load-bearing. This is the same "test the risky thing in
  isolation first" discipline that the May 21 email session
  established.
- Risk: medium (touches onboarding). Rollback: point the pages
  back at the direct write; drop the RPC.

### Phase 2 — Tighten `contacts` policies
- Only safe AFTER Phase 1 ships and is verified.
- Replace the `true` policies on `contacts` with role-based ones
  per the §9 capability matrix: Admin+ can write; Internal Users
  read; etc.
- Migrate the UI reads of `is_admin` (`useIsAdmin`, `AccessPage`)
  to the role functions/field.
- Approach: tighten READ policies first, confirm, THEN mutations —
  per the May 16 guidance. Super Admin retains full access
  throughout so we cannot lock ourselves out.
- Risk: high (this is the actual enforcement change). Rollback:
  restore the `true` policies. Pre-stage this rollback before
  applying.

### Phase 3 — Remaining tables + Internal User scoping
- Apply the capability matrix to the other internal tables.
- Wire up the Internal User role's write-scoped access (their own
  interactions / assigned work) — still per-table, not per-row.
- Risk: medium. Rollback: per-table policy restores.

### Phase 4 — Self-service role-management UI
- Build the UI specced in §7. Last, because it depends on the enum,
  the role functions, and the tightened policies all existing.
- Risk: medium (high-stakes screen, but the model underneath is by
  now stable and tested).

> The `is_admin` column drop (§5.3 step 4) happens after Phase 4,
> as its own trivial cleanup migration, once nothing reads it.

---

## 7. Self-service role-management UI

The highest-stakes screen in the app: the one place a user can
grant Super Admin, demote an admin, or — the real danger —
misconfigure access and lock people out. Designed accordingly.

### 7.1 Where it lives
A section of the existing `/admin/access` page (`AccessPage.tsx`
already lists who has access — this extends it) OR a dedicated
`/admin/roles` route. Decision deferred to the Phase 4 build
session; either is fine. It lists internal users (contacts with a
non-NULL `internal_role`) and their current role.

### 7.2 Who can use it
**Super Admin only.** Enforced in the database, not just the UI —
the role-change RPC (7.4) checks `is_current_user_super_admin()`.
An Admin viewing the page sees roles but cannot change them
(read-only for them).

### 7.3 What it does
For each internal user: change their `internal_role`, or remove
internal access entirely (set it NULL). Assigning a role to a
contact who has none makes them an internal user.

### 7.4 The mutation path
A SECURITY DEFINER RPC — e.g. `set_internal_role(p_contact_id,
p_new_role)` — NOT a direct table write. The function:
- checks `is_current_user_super_admin()` — the caller must be a
  Super Admin (this is the in-function auth gate);
- enforces every guardrail in 7.5 server-side;
- performs the `internal_role` update;
- writes an audit record (7.6).
REVOKE PUBLIC, GRANT EXECUTE to `authenticated`. The UI calls this
RPC; the guardrails do not live in the UI.

### 7.5 Guardrails (all enforced in the RPC, not the UI)
1. **No last-Super-Admin removal.** The RPC refuses to demote or
   un-role a Super Admin if they are the only one. Count
   `super_admin`s; if the target is the last, reject with a clear
   error. This is the primary lockout protection.
2. **No self-demotion to a lower tier** while you are acting —
   a Super Admin cannot demote themselves unless another Super
   Admin exists. (Covered by rule 1 in the single-admin case, but
   stated explicitly: the RPC compares `p_contact_id` against the
   caller's own contact.)
3. **Super Admin only** — rule 7.2, enforced as the in-function
   auth gate.
4. **Target must be a real, non-deleted contact** — the RPC reads
   `active_contacts`.
5. The RPC is the ONLY write path to `internal_role`. After
   Phase 2, the `contacts` UPDATE policy does not permit a direct
   `internal_role` change even by a Super Admin — it must go
   through the audited RPC.

### 7.6 Audit trail
Every role change writes a record: who changed it, whose role
changed, old role, new role, timestamp. Either a dedicated
`role_change_log` table or the project's existing audit mechanism
if one is adopted by then. The audit write happens INSIDE the RPC,
in the same transaction as the change, so a role change can never
occur without its log record.

### 7.7 Out of scope for v1
- Bulk role changes.
- Time-boxed / expiring roles.
- Roles below Internal User (e.g. a read-only auditor tier).
All are plausible future extensions; none are needed now.

---

## 9. Capability matrix

The implementation checklist for RLS policies. **External** is
omitted — external users never touch these tables directly; they
go through token-gated RPCs (Profile V1 pattern) which carry their
own per-function rules.

Legend: ✅ allowed · 🔸 own records only · ❌ denied

| Table / capability        | Super Admin | Admin | Internal User |
|---------------------------|:-----------:|:-----:|:-------------:|
| contacts — read           | ✅          | ✅    | ✅            |
| contacts — create         | ✅          | ✅    | ❌            |
| contacts — update         | ✅          | ✅    | 🔸 (own)      |
| contacts — delete         | ✅          | ✅*   | ❌            |
| contacts.internal_role    | ✅ (via RPC)| ❌    | ❌            |
| invitations — all         | ✅          | ✅    | ❌            |
| events / programs — read  | ✅          | ✅    | ✅            |
| events / programs — write | ✅          | ✅    | ❌            |
| interactions — read       | ✅          | ✅    | ✅            |
| interactions — write      | ✅          | ✅    | 🔸 (own)      |
| role management (§7)      | ✅          | ❌    | ❌            |

\* Admin delete on `contacts`: allowed, but Admins cannot delete or
demote *other Admins / Super Admins* — that restriction is about
acting on internal **users**, enforced in the role RPC and (for
deletes of admin-role contacts) worth a policy check. Flagged for
the Phase 2/3 build session to nail down precisely.

> This matrix is a STARTING POINT. The Phase 2/3 build sessions
> should confirm each cell against the real tables (the grep for
> `is_admin` found the obvious ones; a full table inventory should
> precede Phase 3). Per-row scoping (🔸) is deferred per §3 Q2 —
> for v1, 🔸 cells may be implemented as per-table write grants and
> tightened to true per-row ownership later if needed.

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

> Note on section order: §8 appears last because it reads naturally
> as the closing "why this mattered" — §5–§7 and §9 are the
> implementation substance and belong together in the middle.
