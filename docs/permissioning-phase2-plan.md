# Permissioning Phase 2 — Implementation Plan (DRAFT)

**Status:** DRAFT for review — not started. Depends on Phase 1 being
shipped and verified in prod first.
**Drafted:** 2026-06-22, grounded in a live-DB audit (read-only) of the
current `contacts` write/read paths.
**Spec:** `docs/permissioning-model.md` §5, §6 (Phase 2), §9 (capability
matrix). This doc is the *how*; that doc is the *what*.

---

## 1. Goal

Replace the wide-open (`true`) RLS policies on `contacts` with
role-based ones, so the database — not just the UI — enforces who can
read and write contact data. This is the first real *enforcement* change
in the permissioning model (Phases 0–1 were additive / path-moving).

**What it unblocks:** the RLS audit Tier 2/3 (those `active_*` views can
finally enforce a real model instead of placeholder logic), and every
future "let a non-admin do X" feature.

---

## 2. Preconditions (do NOT start until all true)

- [ ] **Phase 1 shipped & verified in prod** — `accept_invitation` RPC
      live, onboarding smoke-tested on both paths. This is the hard gate:
      Phase 1 moved the invitation→`contacts.auth_user_id` write off the
      open UPDATE policy. Tightening `contacts` before Phase 1 breaks
      onboarding silently.
- [ ] Roles assigned to the internal cohort (see §4) — else read-tighten
      locks them out.

---

## 3. Grounded findings (live audit, 2026-06-22)

Everything below was verified against prod, not assumed.

**Who writes `contacts` today, and whether Phase 2 affects them:**

| Writer | Path | Runs as | After Phase 2 |
|---|---|---|---|
| Admin ContactForm create/edit | `useUpsertContact` → direct `contacts` insert/update | the authenticated user → **subject to RLS** | needs Admin+ role (today: only Jacinth writes) |
| CSV import | `ContactsImportPage` → direct insert | authenticated user → RLS | needs Admin+ |
| Alumni-claim approval | `alumni-claims-hooks` → direct insert | admin user → RLS | needs Admin+ (already admin-gated in UI) |
| Profile V1 self-edit | `update_my_profile` etc. | **SECURITY DEFINER → bypasses RLS** | unaffected ✅ |
| `accept_invitation` (Phase 1) | RPC | **SECURITY DEFINER → bypasses RLS** | unaffected ✅ |
| Contact soft-delete | `rpc("soft_delete", {table:"contacts"})` | **SECURITY DEFINER → bypasses RLS** | unaffected by the DELETE policy ⚠️ see §7 |

**The landmine that ISN'T there:** public alumni signup
(`AlumniSignupPage`) writes to **`alumni_claims`**, not `contacts`. No
anon/public path writes `contacts` directly. So tightening `contacts`
does not break any public flow. (Contrast Phase 1, where onboarding
*did* depend on the open policy.)

**The auth-linked cohort is 4 people** — and 3 have NULL `internal_role`:

| Contact | Email | role |
|---|---|---|
| Jacinth Sohi | jacinthsohi@gmail.com | `super_admin` |
| Diane Michalak | amta.tab@collegemocktrial.org | **NULL** |
| Maggy Randels | Margaret.e.randels@gmail.com | **NULL** |
| Will Warihay | w.warihay@gmail.com | **NULL** |

NULL role = "not an internal user" in the model. Invitation acceptance
links `auth_user_id` but does **not** assign a role — so everyone who
ever accepted an invite sits at NULL until assigned. Read-tightening
without assigning these three first locks them out of all contact data.

---

## 4. Step A — Assign roles to the cohort (data migration, do FIRST)

**DECIDED (2026-06-22):** all three NULL-role users → `admin`.

```sql
UPDATE public.contacts SET internal_role = 'admin'
  WHERE email IN (
    'amta.tab@collegemocktrial.org',   -- Diane Michalak
    'Margaret.e.randels@gmail.com',    -- Maggy Randels
    'w.warihay@gmail.com'              -- Will Warihay
  )
  AND deleted_at IS NULL
  AND internal_role IS NULL;           -- idempotent
```

Reversible (set back to NULL). Ships as its own migration so it commits
independently of the policy change and can be verified before the risky
step. **Verify after:** every intended internal user has a non-NULL role
(`SELECT ... WHERE auth_user_id IS NOT NULL AND internal_role IS NULL`
returns only people you deliberately excluded).

> **Implication of three new Admins:** per the §9 matrix Admins can write
> all contacts and manage invitations/events/programs, but CANNOT change
> roles. That last restriction is now load-bearing — see §7, which the
> three-Admin decision promoted from optional to required.

---

## 5. Step B — Tighten the `contacts` policies

Per the §9 matrix, scoped to what's safe for v1 (Internal-User
own-write is deferred to Phase 3 — see §8):

| Op | New policy expression | vs today |
|---|---|---|
| SELECT | `is_current_user_internal()` | was `true` |
| INSERT | `is_current_user_admin()` (WITH CHECK) | was `true` |
| UPDATE | `is_current_user_admin()` (USING + CHECK) | was `true` |
| DELETE | `is_current_user_admin()` (USING) | was `true` |

```sql
-- Drop the four authenticated_* contacts policies, recreate role-based.
DROP POLICY authenticated_select_contacts ON public.contacts;
DROP POLICY authenticated_insert_contacts ON public.contacts;
DROP POLICY authenticated_update_contacts ON public.contacts;
DROP POLICY authenticated_delete_contacts ON public.contacts;

CREATE POLICY contacts_select_internal ON public.contacts
  FOR SELECT TO authenticated USING (public.is_current_user_internal());
CREATE POLICY contacts_insert_admin ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
CREATE POLICY contacts_update_admin ON public.contacts
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY contacts_delete_admin ON public.contacts
  FOR DELETE TO authenticated USING (public.is_current_user_admin());
```

**Sequencing (per spec — read first, then mutations):** recommend two
applies, not one, given the read-tighten is the riskiest piece:
- **B1:** assign roles (Step A) + tighten SELECT only → verify the
  cohort still sees contacts in the live app.
- **B2:** tighten INSERT/UPDATE/DELETE → verify admin CRUD still works.

Super Admin (Jacinth) retains full access throughout both, so there is no
lock-yourself-out path.

**Pre-stage the rollback before applying** (restore the four `true`
policies). Policy migrations are the high-risk class in this repo.

---

## 6. UI migration — move `is_admin` reads to the role model

Database is the boundary; these are convenience reads. Migrate them so
the UI agrees with the new model:

- `useIsAdmin` (`src/features/admin/hooks.ts`) — currently
  `Boolean(contact?.is_admin)`. Change to read
  `internal_role IN ('admin','super_admin')` from `active_contacts`.
  Behavior-preserving today (backfill kept `is_admin` ↔ `super_admin`
  consistent). Feeds `AdminGate` + `Sidebar` automatically.
- `AccessPage` (`src/features/admin/AccessPage.tsx`) — displays
  `is_admin`; switch to show `internal_role` (and ideally list all three
  tiers, not just admin/not-admin).

**New UX gap — `InternalGate`, DECIDED (2026-06-22): build it in Phase 2.**
Non-`/admin` routes (contacts list, etc.) have no role gate today —
they're auth-only. After read-tightening, a roleless authenticated user
sees *empty* pages rather than a clean "no access" screen. Add an
`InternalGate` (mirror of `AdminGate`, gating on
`is_current_user_internal()` / the `internal_role` field) around the app
shell so they get a clear message instead of broken empty pages. The DB
is still the real boundary; this is the matching UX. Ship it with B1 (the
read-tighten) so the empty-page window never exists in prod.

---

## 7. Lock the role columns — INCLUDED in Phase 2 (trigger guard)

**DECIDED (2026-06-22): include it now.** The three-Admin decision (§4)
makes this load-bearing, not optional: once an Admin can UPDATE
`contacts`, a hand-crafted API call (`update({internal_role:'super_admin'})
.eq('id', myOwnContact)`) would self-escalate — exactly what the matrix
(`internal_role` = super-admin-only) forbids. The only UI write path
(`useUpsertContact`) never touches these columns (verified: its payload is
just name/email/phone/location/notes/standing/categories), so locking them
breaks nothing.

**How — a `BEFORE UPDATE` trigger, NOT column GRANTs.** Column-level
`REVOKE/GRANT UPDATE` would force enumerating every *other* allowed column
and re-granting on each new column forever — the same explicit-column-list
drift footgun that bit `active_contacts`. A trigger sidesteps that
entirely and also encodes the "only a Super Admin may change roles" rule
in one place:

```sql
CREATE FUNCTION public.guard_contacts_role_columns()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.internal_role IS DISTINCT FROM OLD.internal_role
      OR NEW.is_admin IS DISTINCT FROM OLD.is_admin) THEN
    -- auth.uid() IS NULL  => postgres/service context (SQL-editor role
    --   assignment, Step A) — allowed.
    -- super admin          => the future Phase 4 role RPC (super-admin-
    --   gated) and manual super-admin action — allowed.
    -- anyone else (incl. the 3 Admins) => blocked.
    IF auth.uid() IS NOT NULL AND NOT public.is_current_user_super_admin() THEN
      RAISE EXCEPTION
        'Changing role columns requires Super Admin (use the role-management RPC).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_contacts_roles
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.guard_contacts_role_columns();
```

Confirmed harmless to the existing SECURITY DEFINER writers — none of
them touch `internal_role`/`is_admin`, so the guard no-ops for
`accept_invitation`, `soft_delete`, and `update_my_profile`. It only ever
fires on an actual role-column change, and only blocks non-super-admins.

> Residual (low): the INSERT policy lets an Admin insert a *new* contact
> with `internal_role='super_admin'`, but such a row has no
> `auth_user_id`, so it grants no one access. Real escalation needs an
> UPDATE to one's own linked row, which the trigger blocks. Tighten the
> INSERT path if/when the Phase 4 RPC makes role-writes fully exclusive.

---

## 8. Explicitly deferred to Phase 3 (do NOT do here)

- **Internal-User own-row write** (`🔸 own` in the matrix). Phase 2 makes
  Internal Users read-only on `contacts`; their own-record write lands in
  Phase 3 ("Internal User scoping") where per-row policies are designed.
  They can already self-edit via Profile V1 token RPCs in the meantime.
- **`soft_delete` RPC hardening.** It's SECURITY DEFINER with *no role
  check* — any authenticated user can soft-delete any row through it.
  Tightening the table DELETE policy does nothing about this (the RPC
  bypasses RLS). Add an `is_current_user_admin()` gate inside
  `soft_delete` — but that's cross-table (it deletes from many tables),
  so it belongs with the Phase 3 table sweep, not here. **Flagged: this
  is a real current gap, not introduced by Phase 2.**
- **Admin-can't-delete-other-admins nuance** (§9 footnote). Needs a
  row-level condition on delete/role-change; design it with the Phase 4
  role RPC.

---

## 9. Verification plan

- After Step A: role inventory query returns the intended assignments.
- After B1 (SELECT): sign in as each cohort member (or check via their
  session) — contacts list loads for assigned internal users, and a
  deliberately-roleless test account sees empty. Jacinth sees everything.
- After B2 (writes): admin create/edit/delete a contact end-to-end;
  confirm Profile V1 self-edit and a fresh invitation accept still work
  (both ride SECURITY DEFINER RPCs, so they should be unaffected — verify,
  don't assume).
- Rollback rehearsed: the restore-`true`-policies file is pre-staged.

---

## 10. Decisions — RESOLVED (2026-06-22)

1. **Roles for the three** → all three `admin` (§4).
2. **One apply or two** → two: B1 (roles + SELECT + InternalGate) then
   B2 (writes), verifying between (§5).
3. **Role-column lock** → include in Phase 2, via the trigger guard (§7) —
   promoted to required by the three-Admin decision.
4. **`InternalGate` UI** → build it in Phase 2, shipped with B1 (§6).

## 11. Resulting Phase 2 work-list

- **Migration A** — assign the three Admins (§4) + the role-column trigger
  guard (§7) + pre-staged rollback. The guard ships HERE, not with the
  policy tightening, because the escalation hole is pre-existing (`contacts`
  UPDATE is already `true` today) — so it must close the moment roles start
  mattering, before the window between A and B2 where three Admins exist
  but UPDATE is still open.
- **Migration B1** — `contacts` SELECT policy → `is_current_user_internal()`;
  pre-staged rollback.
  - **Frontend (ship with B1):** `InternalGate` (§6); migrate `useIsAdmin`
    + `AccessPage` off `is_admin` onto `internal_role` (§6).
  - Verify the three Admins + Jacinth all see contacts; a roleless test
    account gets the InternalGate screen; an Admin cannot self-escalate.
- **Migration B2** — `contacts` INSERT/UPDATE/DELETE policies →
  `is_current_user_admin()`; pre-staged rollback.
  - Verify admin ContactForm CRUD, CSV import, claim approval, Profile V1
    self-edit, and a fresh invitation accept all still work.

Each migration is transactional with a `_rollback.sql` sibling and, for
B1/B2, tested against local Postgres 16 before applying — per repo
convention for high-risk policy migrations.
```
