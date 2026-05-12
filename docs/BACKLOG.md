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
- ✅ SHIPPED — done, kept here for momentum / portfolio context

Last updated: May 12, 2026

---

## ✅ Recently shipped

- **Alumni claims admin flow — Phase 2 complete** (May 11–12, 2026)
  - Generic Modal primitive (`src/components/Modal.tsx`)
  - Review modal with duplicate detection banner
  - Approve flow: pre-filled editable contact form, creates contact +
    program affiliation, marks claim approved
  - Reject flow: Spam / Other (specify) reasons, stored in `review_notes`
  - Auth detection on `/alumni-signup` — signed-in users see a redirect
    view instead of the form (avoids RLS 403 for admins; policy stays
    correctly scoped to `anon`)
- **Contacts list default sort by first name, then last name** (May 12, 2026)
- **Public alumni signup form** at `/alumni-signup` (May 11, 2026)
- **Refresh-bounce bug fixed** — navigator.locks deadlock in
  `src/lib/supabase.ts` (May 11, 2026)
- **Dev/prod Supabase env mismatch fixed** (May 11, 2026)

---

## 🔴 HIGH

- **Email automation for invitations.** Currently admins copy/paste invite
  links manually. Unblocks the entire "actually onboarding people" flow.

---

## 🟡 MEDIUM

- **Tighten `alumni_claims` RLS to admin-only.** Current policies let any
  authenticated user read and update claims. Fine while every authenticated
  user is an admin, but a real liability once that stops being true.
  Separate migration; deferred from the Phase 2 build.
- **Combobox UX for the program dropdown on `/alumni-signup`.** 483 native
  `<select>` options is bad UX. Type-ahead combobox would be a real
  improvement.
- **Expand alumni signup form fields.** Needs scoping. Candidates:
  start year (would also fix the affiliation `start_year = end_year`
  tech debt), pronouns, roles within program, current professional
  context. Do a small product design exercise before building.
- **Self-service profile editing for alumni (Phase 3).** Separate auth
  flow from the admin CRM. Approved alumni get a way to update their own
  info without admin intervention.
- **Judge management as event sub-feature.** Estimated 2–3 days.
- **Sortable lists across Contacts / Programs / Events.** Shared
  `<SortableTable>` component. Bigger refactor than the one-line default
  sort that just shipped.
- **Profile / Settings page (separate from Contact record).** User
  account settings, not the same thing as someone's contact data.
- **CSV import for Programs + Contacts.** Symmetric to the existing
  CSV export.
- **Officer terms inline edit.** See bug B2.
- **Bulk-assign Current Board Member.** Admin convenience for term
  transitions.
- **Cascade soft-delete for committees, contacts, events.** Currently
  inconsistent — some entities cascade, others don't.
- **Email Draft Generator.** Potential 6th AI feature.

---

## 🟢 LOW

- **Add email consent disclosure to `/alumni-signup`.** "By submitting, you
  agree to receive communications from AMTA about alumni programming."
  Pair with email infrastructure rollout. Current copy ("agree we may
  contact you about your AMTA alumni status") is narrower than full email
  opt-in.
- **Find the Chrome extension slowing Supabase calls locally.** Affects
  dev only.
- **Delete / retire dev Supabase project** (`wdxgbtwshcmvmiedqjyh`).
  Abandoned; using prod for everything.
- **Refresh contact-relationships screenshot in the repo README.**
- **Clean up 308 latent TS errors incrementally.**
- **Delete `src/lib/auth.tsx.backup`.** Leftover from a previous auth
  surgery session.

---

## 🐛 BUGS

- **B1: Can't delete "Tell me about Maggy Randels" Ask AI conversation.**
  Other conversations delete fine; just this one fails.
- **B2: Officer terms can't be edited inline** like other attached
  attributes can. UX inconsistency.
- **B3: Can't remove program affiliation from a Contact page.** Today the
  Contact page punts to the Program page, where there's also no removal
  affordance. Two layers to fix:
  - Add removal UI on the Contact page (probably the right canonical
    location)
  - Confirm whether removal is also missing on the Program page (vs.
    actually broken)

---

## 🧊 ICEBOX

- **Navigator.locks bug writeup.** Claude drove the diagnostic work; felt
  inauthentic to publish under my name alone.
- **AI summary staleness.** Known issue, no fix scoped.
- **Case file DB feature.** Standalone idea, no current pull.

---

## 📋 To write up

These aren't backlog items — they're docs/portfolio work that should
happen while the details are fresh.

- **RLS debugging bug story (May 12, 2026).** The 403 on `/alumni-signup`.
  Arc: diagnosed the bug correctly on the first hypothesis (anon-only
  INSERT policy, admins blocked), walked it back when an "incognito test"
  seemed to reproduce the bug for anon users too, then discovered the
  incognito browser was still carrying an authenticated session
  (`role: "authenticated"` in the JWT). Original diagnosis was right.
  Lessons: confirm test setup before trusting test results; RLS policies
  are scoped per role; `apikey` and `Authorization` headers play
  different roles in Supabase requests.
