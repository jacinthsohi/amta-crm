# AMTA CRM Session Handoff — Profile V1 shipped, email automation up next (May 16, 2026 — late session)

## Where we are right now

**Profile V1 is shipped end-to-end** (minus deferred polish). Board
members can now self-service their own profile via a magic link:
basics + program affiliations. Admins generate the link from the
ContactDetailPage with one click. Deployed to prod, smoke-tested,
working.

The big new design surface that opened up this session: the
**permissioning model** is a placeholder, not a designed system.
The `contacts` table has `true` RLS policies (any authenticated user
can do anything to any contact). That's not a vulnerability — it's
been that way since the initial schema — but it now blocks two other
🔴 HIGH items (Tier 2/3 RLS audit, active_invitations design). Logged
as a 🔴 HIGH design discussion in the backlog with Jacinth's
hypothesized model (Super Admin / Admin / Internal User / External).

**Next session: email automation** (sending invitations + magic links
from the CRM instead of copy/paste from Gmail).

**Fallback if email is blocked** (e.g. SendGrid access pending):
work the Seasons concept design discussion. It's the kind of thing
that might wrap quickly once you walk through Option 1 (label) vs
Option 2 (schema branch) consequences, and resolving it unblocks
board_terms population, current-vs-past committee distinction, and
richer data viz granularity (first-year vs second-year candidates,
term-by-term breakdowns). See backlog 💭 Design Discussions for
existing framing.

---

## What shipped this session

Six commits, two migrations, ~14 frontend files touched.

### Profile V1 chunks completed
- **Chunk 1: magic-link infrastructure** — `profile_access_tokens`
  table + 4 RPCs (`verify_profile_token`, `get_profile_by_token`,
  `update_my_profile`, `create_profile_token`). Migration:
  `migrations/20260516_profile_access_tokens.sql`.
- **Chunk 2: read-only profile page** at `/profile?token=...`. Three
  error states (no token / expired / load error). New folder
  `src/features/profile/`.
- **Chunk 3: editable basic fields**. Separate edit mode, single
  save button, flip back to view with success banner. Primary email
  intentionally locked (with friendly mailto link to
  amta@collegemocktrial.org explaining why).
- **Chunk 5: admin "Generate magic link" action**. Sidebar section
  on ContactDetailPage; modal shows the URL + copy button + "Compose
  email" mailto button. Server-side: regenerating revokes the
  previous active token (mental model: one valid link at a time).
- **Chunk 4: editable affiliations + 483-program combobox**. Three
  new RPCs (`add_my_affiliation`, `update_my_affiliation`,
  `delete_my_affiliation`) plus `search_programs_public` for the
  combobox plus an extension to `get_profile_by_token` to return
  the affiliations array. SOFT DELETE (sets `deleted_at`) because
  that column was already in the schema and recoverable delete is
  the right pattern. Migration:
  `migrations/20260516_profile_affiliations.sql`.

### Tier 1 RLS audit + admin location UI
Already shipped earlier in the day (per the previous handoff). Logged
in backlog ✅ Recently shipped.

### Chunk 6 polish — deferred
- Friendlier network error copy (saw a real "TypeError: Failed to
  fetch" during testing from in-flight WiFi blip)
- Auto-retry on transient errors (React Query `retry: 2`)
- Loading skeletons instead of "Loading…"
- Mobile responsiveness pass
- Styled confirm dialog instead of `window.confirm` for delete

All captured as a 🟡 MEDIUM backlog entry. Most valuable just before
board meeting (July), so no rush.

---

## Next session: Email automation

**Goal:** stop manually sending invites and magic links from Gmail.
Wire up SendGrid for two transactional flows:

1. **Invitation emails** (existing `AcceptInvitationPage` flow,
   currently copy/paste manual)
2. **Profile magic-link emails** (new from this session; currently
   admins click "Compose email" which opens mailto in their default
   mail client)

Possible bonus: **"Request login" button on the login page** — user
enters their email, system sends them a magic link if a contact
exists. Genuine value for board members who lost their email; defer
if scope creeps.

### Decisions already locked in
- **SendGrid** as the email service (AMTA has an existing account)
- **`help@collegemocktrial.org`** as the from address
- **Vercel serverless functions** as the runtime (e.g.
  `api/send-magic-link.ts`). Calls Supabase with service role +
  SendGrid SDK. Aligns with existing Vercel + Supabase deployment.
- **Plain text v1**, branded HTML wrapper deferred to v2
- **Scope is narrow**: invitations + magic links + maybe "request
  login." NOT broader email comms (those stay in Gmail/Mailchimp).

### Pre-work before writing any code (CRITICAL)
**Set up SPF / DKIM / DMARC for `help@collegemocktrial.org` in
SendGrid.** Nothing else works until this is done — emails will land
in spam without proper domain authentication. This is the boring
infrastructure step that often eats hours. Do this FIRST so by the
time the code is wired up, deliverability already works.

Steps (rough — Jacinth will need to do these in the DNS host for
collegemocktrial.org, probably outside the CRM repo):
1. Log into SendGrid → Sender Authentication → authenticate the
   `collegemocktrial.org` domain
2. SendGrid will provide DNS records (CNAME or TXT) to add at your
   DNS host
3. Wait for DNS to propagate (sometimes minutes, sometimes hours)
4. Verify in SendGrid that the domain is authenticated
5. Send a test email from SendGrid's UI to a personal Gmail address
   and verify it lands in Inbox (not Spam, not Promotions)

### Open design questions for next session
- **Where does the SendGrid API key live?** Vercel environment
  variable (`SENDGRID_API_KEY`). Same place as any other secret.
- **How do we trigger sends?** Probably a function call from the
  admin UI (e.g. ContactDetailPage's "Generate magic link" gets a
  new "Generate + email" variant). The existing "Compose email"
  mailto button can stay as a fallback for now.
- **What's the email template for the invitation flow?** The
  AcceptInvitationPage exists; we just need the email that points
  users to it. Plain text with link.
- **What's the email template for the magic link flow?** Profile
  V1's modal already has a mailto draft body — we can lift that
  copy directly.
- **Logging / retries / failure visibility?** If a SendGrid call
  fails, how does the admin know? Probably: surface the error in
  the UI, log to a `sent_emails` table for audit. Defer the table
  if it's too much scope for v1.
- **Test mode?** Sending real emails from dev is risky. SendGrid
  has a sandbox mode; check whether your account supports it, or
  use a test-only API key with strict throttling.

### What's NOT in scope for the email session
- Branded HTML templates (v2, deferred)
- Marketing-style sends (Mailchimp handles these)
- General CRM-to-contact comms (Gmail stays the tool)
- Email tracking / open rates (potentially never; AMTA isn't a
  marketing org)

---

## Important context for next session

### Working style (Jacinth's preferences, well-established)

- **Full file replacements** over surgical edits. Even small changes
  → send the whole file. She'll `mv` from Downloads.
- **Pause for design questions before coding.** Multiple times this
  week and especially this session, the right answer was "let me
  ask three questions before I write" — and her answers shaped the
  code in ways that saved rework. Specifically she found the
  ask_user_input_v0 tool helpful for surfacing options.
- **Honest pushback on scope.** She values being told when she's
  over-scoping, and she'll push back when Claude is over-cautious.
- **Bundle related work cleanly.** One commit per coherent feature,
  not one per file. She's good at PR hygiene.
- **Build locally before pushing.** `npm run build` has caught real
  errors faster than waiting for Vercel deploys. Make it a habit
  for any cross-file change.

### Profile V1 gotchas to carry forward (verbatim from backlog)

These bit during the May 16 session. Future-Claude: please don't
re-step.

- **`p_` prefix on function parameters.** PostgREST passes named
  args literally, so client calls must match the Postgres function
  signature exactly. E.g. `add_my_affiliation(p_token: ...)` not
  `add_my_affiliation(token: ...)`. We lost ~10 minutes to this
  during Chunk 2 smoke testing.
- **Postgres won't change function return types via CREATE OR
  REPLACE.** Tried to upgrade `get_profile_by_token` from `json` to
  `jsonb` in Chunk 4. Postgres rejected with error 42P13. Either
  pick one format upfront and stay consistent, or include a `DROP
  FUNCTION IF EXISTS` before the `CREATE`. Profile V1 settled on
  `json` for consistency with Chunk 1.
- **VERIFY SCHEMA before writing migrations.** Both
  `program_affiliations` and `programs` already had `deleted_at`
  columns that Claude wasn't expecting. Catching this mid-design
  changed the delete semantics (from "typed-confirm friction" to
  "soft delete is already the answer, just wire to it"). Run
  `grep -A 30 "create table public.<tablename>"` before writing
  any migration touching a table.
- **REVOKE PUBLIC + GRANT EXECUTE to anon/authenticated** for every
  SECURITY DEFINER function. The default grants are too permissive.
- **Transient network errors look like code bugs.** "TypeError:
  Failed to fetch" / `ERR_CONNECTION_CLOSED` during Profile V1
  testing turned out to be in-flight WiFi blips, not a code bug.
  Retry-once is the default debugging move before assuming the
  code is broken.

### Established codebase pattern: token-gated SECURITY DEFINER RPC

For ANY public-by-token access (no auth user, just a magic token in
the URL), use this shape:

```sql
CREATE OR REPLACE FUNCTION public.my_function(p_token text, ...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  v_contact_id := public.verify_profile_token(p_token);
  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- Ownership check if doing mutations on a record:
  -- verify the target record belongs to v_contact_id before mutating

  -- Do the actual work, then refresh token expiry:
  UPDATE public.profile_access_tokens
  SET expires_at = now() + interval '30 days'
  WHERE token = p_token AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.my_function(text, ...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_function(text, ...) TO anon, authenticated;
```

This pattern will likely extend to:
- `active_invitations` design (already noted in backlog Design
  Discussions)
- Future alumni claim approval flows
- Any "public read-by-token" pattern

### Stack reminders

- React 18 + TypeScript + Vite + Tailwind
- Supabase (project `amta-crm-prod`, `ifnadlzcdtydbkqnyeif.supabase.co`)
- Vercel auto-deploys on push to main
- Repo: github.com/jacinthsohi/amta-crm
- Live at crm.mocktrial.tech
- Brand color: maroon #70172a
- AMTA contact email: amta@collegemocktrial.org (locked primary
  email contact)
- Future from-address: help@collegemocktrial.org (for SendGrid)

### Files Jacinth currently has open / recent

- `src/features/profile/ProfilePage.tsx` (view + edit modes,
  affiliations modal)
- `src/features/profile/hooks.ts` (useProfile + 4 mutations)
- `src/features/profile/ProgramCombobox.tsx` (reusable picker)
- `src/features/contacts/ProfileLinkSection.tsx` (sidebar generator)
- `src/features/contacts/ContactDetailPage.tsx` (with sidebar
  generator wired in)
- `src/lib/format-location.ts` (extracted shared helper)
- `migrations/20260516_profile_access_tokens.sql`
- `migrations/20260516_profile_token_revoke.sql`
- `migrations/20260516_profile_affiliations.sql` (+ rollback)
- `migrations/20260516_ai_views_security_invoker.sql` (+ rollback)
- `docs/BACKLOG.md` (extensively updated this session)

### Test resources

- Jacinth's contact_id: `96ea6367-9256-4545-be99-3a7c2ce34ec2`
- Magic link tokens: short-lived, regenerate via the new "Generate
  magic link" button on her contact detail page
- Smoke test URL pattern:
  `https://crm.mocktrial.tech/profile?token=<token>`

### Things to watch for in the next session

1. **The permissioning model design discussion will surface
   tangentially.** Email automation isn't directly blocked by it,
   but the new Vercel serverless functions will run with Supabase
   service role and effectively bypass RLS. That's a *different*
   permissions question (function-level, not user-level), but
   future-you should at least notice it.

2. **SendGrid domain authentication is the gate.** Don't write
   email code before SPF/DKIM/DMARC is set up. The temptation will
   be "let me get the code working in dev first" — but if dev
   email lands in spam, you'll be debugging code that isn't broken.

3. **The Profile V1 modal has a Compose Email button that opens a
   mailto draft.** That existing template body is a good starting
   point for the SendGrid version — same copy, just delivered
   server-side instead of via the admin's local mail client.

4. **Two adjacent backlog items might pair well.** "Email
   automation for invitations" (existing 🔴 HIGH) and the magic
   link email (new). Both are SendGrid integrations with similar
   shape. Worth scoping them as one session.

5. **Profile V1 Chunk 6 polish is sitting in backlog** as 🟡
   MEDIUM. If next session ends early, this is the obvious filler
   item to pick up.

---

## Time check / energy

End of a 3-4 hour flight session. Real ground covered:
- Full Profile V1 build (the assigned work)
- Permissioning model surfaced + documented (unexpected bonus)
- Extensive backlog hygiene
- Multiple gotchas captured for future sessions

Nicely paced. Don't expect next session to ship this much; the
permissioning + email work are each meaningful projects in their
own right.
