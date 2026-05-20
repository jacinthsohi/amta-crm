# AMTA CRM Session Handoff — Magic-link email fully shipped (May 20, 2026)

## Where we are right now

**Email automation for profile magic links is DONE — fully shipped
and verified in prod.** An admin clicks "Email link directly" on a
contact and the CRM mints a fresh token, builds the URL, and emails
a branded HTML message via SendGrid. Real emails send and land in
the inbox. No part of this feature is blocked or pending anymore.

This wrapped across three sessions: May 16 (Profile V1 + the
groundwork), May 17 (the full email backend + UI, built while
SendGrid access was still pending), and May 20 (SendGrid turned on,
debugged to working, plus a branded HTML email).

**Profile V1** (board-member self-service profile editing via magic
link) remains fully shipped and is unaffected.

**Next session: email automation for invitations** — the sibling
feature. See below.

---

## Next session: invitation email flow

The one remaining email piece. Currently, inviting a new user means
copy/pasting their invitation link out of the CRM and hand-sending
it from Gmail. The goal: a "send invitation email" action, the same
way "Email link directly" now works for magic links.

**This is now mostly a known quantity** — the magic-link send is the
template. What's the same, what's different:

- **Copy `api/send-magic-link.ts` as the starting point.** It is
  already the correct Vercel **Node-runtime** shape (see the Edge
  vs Node lesson below — do NOT start from one of the Edge api/*
  functions). The auth pattern, the SendGrid call, the branded
  HTML structure — all reusable.
- **The branded HTML email** (maroon header, white logo, button) is
  currently inlined in `send-magic-link.ts`. When the invitation
  email needs the same shell, that's the moment to extract a shared
  helper (e.g. `api/_email-template.ts`) so the two functions don't
  duplicate ~100 lines of table markup. Tracked in the backlog.
- **What's genuinely different:** invitations aren't profile
  tokens. The invitation flow has its own table (`invitations`)
  and its own pages (`AcceptInvitationPage` / `FinishInvitationPage`).
  Sending an invitation email means looking up / creating an
  invitation row and emailing a link to the accept page — not
  minting a `profile_access_tokens` row.
- **Intersects the active_invitations design discussion** (backlog
  💭 Design Discussions). The `invitations` table RLS is admin-only,
  and `FinishInvitationPage` writes `contacts.auth_user_id`
  directly. Worth re-reading that entry before building — the
  invitation email itself is simple, but if the work drifts into
  "how do non-authed users read their invitation," that's the
  deeper design question, and it's also entangled with the
  permissioning model (🔴 HIGH). Keep the email-sending scope
  tight; don't accidentally sign up for the RLS redesign.

**If invitations turns out blocked or too big** for the available
time, good fallbacks (unchanged from prior handoffs):
- Seasons concept design discussion (💭 Design Discussions) —
  possibly a fast one; unblocks board_terms, current-vs-past
  committees, richer data viz.
- Profile V1 Chunk 6 polish (🟡 MEDIUM).
- Unify the program picker UX (🟡 MEDIUM) — adopt the
  ProgramCombobox on /alumni-signup and the admin affiliation form.

**Possible small bonus:** the "Request login" button (🟡 MEDIUM) —
a board member enters their email and gets a fresh magic link.
Small now that the mint-and-send code exists. Watch the security
shape: must NOT reveal whether an email matches a contact (always
show the same "if that email is on file, we've sent a link"
message).

---

## What shipped — the email automation feature (May 17 + May 20)

### Backend
- **Migration `20260517_create_profile_token_service.sql`** —
  applied to prod, verified. Extracts the token revoke-then-issue
  logic into a private `_mint_profile_token()` helper (single
  source of truth). `create_profile_token()` (admin-gated,
  browser-facing) delegates to it. Adds
  `create_profile_token_service()` — same helper, NO
  `is_current_user_admin()` gate, because service-role callers have
  no `auth.uid()`. Safety is the REVOKE: never granted to
  anon/authenticated.
- **`api/send-magic-link.ts`** — Vercel **Node-runtime** serverless
  function. Verifies caller JWT → verifies caller is an admin
  (`contacts.is_admin`) → mints a token via
  `create_profile_token_service` → builds the URL → sends a
  branded HTML + plain-text email via SendGrid. Clean JSON errors
  at every step.

### Frontend
- **`src/features/contacts/ProfileLinkSection.tsx`** — the sidebar
  "Profile self-service" section has TWO buttons: "Generate link"
  (opens the existing modal, unchanged) and "Email link directly"
  (calls the endpoint, no modal). The second is disabled when the
  contact has no email, with a hint. Inline sending/success/error
  states. The modal — including its "Compose email" mailto
  fallback — is untouched.

### SendGrid (May 20)
- Domain `collegemocktrial.org` was already authenticated in
  SendGrid (SPF/DKIM/DMARC) — no DNS work needed.
- Created a SendGrid API key with **Custom Access scoped to Mail
  Send only** (least privilege — not Full Access). Set
  `SENDGRID_API_KEY` in Vercel.
- Click tracking is ON (account-wide; AMTA uses SendGrid for other
  things). It rewrites links to a tracking redirect — fine in the
  HTML email because the link is a labeled button, not a visible
  URL. Iceboxed for later re-evaluation.

### Branded HTML email (May 20)
- `send-magic-link.ts` sends both a plain-text body and a branded
  HTML body. HTML: light gray wrapper, white card, maroon
  (#70172a) header band with the white AMTA logo (hosted PNG on
  collegemocktrial.org, 160px wide), system font stack, a maroon
  "Update My Profile" button, raw-URL copy-paste fallback, footer.
- Email HTML is table-based with inline styles — see the in-file
  header comment before editing it.

### Decisions made (so they're not re-litigated)
- **Auth bar:** the send endpoint checks caller-is-ADMIN, stricter
  than `contact-summary.ts` (caller-is-a-user only), because
  minting an access token is higher-stakes. Deliberate
  inconsistency across api/* functions — logged as a 🟢 LOW
  backlog item to make uniform under the permissioning model.
- **Token minting — Option A:** a dedicated service-role RPC, not
  re-implementing revoke/insert in TypeScript. One source of truth.
- **UI — Option 2:** two separate sidebar buttons, not a third
  button in the modal.
- **From address:** `amta@collegemocktrial.org` — the only
  `@collegemocktrial.org` mailbox currently monitored. `help@`
  reads better but needs an ops change (someone monitoring it)
  first; tracked as 🟢 LOW.
- **Branded HTML, barebones:** deliberately simple (maroon header,
  logo, button). Fancier is possible later; not needed now.
- **Scope:** profile magic links + (next) invitations. NOT broader
  email comms — those stay in Gmail / Mailchimp.

---

## Important context for next session

### LESSON: Edge vs Node runtime on Vercel (this bit us twice)

`api/send-magic-link.ts` is the FIRST and only function on the
Vercel **Node** runtime. Every other api/* function is **Edge**.
This is necessary, not tech debt — but it's a footgun:

- `@sendgrid/mail` depends on Node built-ins (`fs`, `path`) the Edge
  runtime does not provide. A function using it MUST be
  `runtime: "nodejs"`. Declaring it Edge → build failure.
- Edge and Node handlers have **different signatures**:
  - Edge: `handler(request: Request): Promise<Response>` — Web
    standard. `request.headers.get(...)`, `await request.json()`,
    `return new Response(...)`.
  - Node: `handler(req: VercelRequest, res: VercelResponse)` —
    Express style. `req.headers.authorization` (plain object, no
    `.get()`), `req.body` (pre-parsed), `res.status(n).json(...)`.
- Switching a function's runtime means **rewriting all its I/O
  plumbing**, not just the `config` line. We learned this the hard
  way: changed the config, build passed, then it crashed at runtime
  with `request.headers.get is not a function`.
- **For the invitation email function: copy `send-magic-link.ts`
  as the template.** It's already the correct Node shape. Do not
  start from an Edge function.

### Working style (Jacinth's preferences, well-established)

- **Full file replacements** over surgical edits. Even small changes
  → send the whole file. She'll `mv` from Downloads. (Migration
  files are the exception — those get pasted into the Supabase SQL
  editor; remember to select-all before running, or only the
  statement under the cursor executes.)
- **Pause for design questions before coding.** The
  `ask_user_input_v0` tool is useful for surfacing options. Her
  answers consistently shape the code in ways that save rework.
- **Honest pushback on scope.** She values being told when she's
  over-scoping, and pushes back when Claude is over-cautious. Judge
  the size of a request honestly — a one-line legacy-copy removal
  is worth doing inline; a multi-file feature at session end is a
  "capture in backlog" not a "build now."
- **Bundle related work cleanly.** One commit per coherent feature.
- **Build locally before pushing** (`npm run build`). NOTE: a local
  Vite build does NOT catch Vercel runtime/deployment errors (the
  Edge-module failure only showed up on Vercel). Watch the Vercel
  deploy go green too.
- **Walking a function to "done" via successive clear error
  messages** worked well this session — each missing-env-var error
  ("PROFILE_LINK_BASE_URL is not set" → "SENDGRID_API_KEY is not
  set" → success) was progress, not a setback. Write functions that
  fail with specific, honest error strings.

### Profile V1 / SECURITY DEFINER gotchas to carry forward

- **`p_` prefix on function parameters.** PostgREST passes named
  args literally; client calls must match.
- **Postgres won't change a function's return type via CREATE OR
  REPLACE** — DROP first, or pick one type and stay consistent.
- **VERIFY SCHEMA before writing migrations.** Run
  `grep -A 30 "create table public.<tablename>"` first.
- **REVOKE PUBLIC + GRANT EXECUTE to anon/authenticated** for every
  token-gated SECURITY DEFINER function. For service-role-only
  functions (like `create_profile_token_service`), REVOKE from
  PUBLIC and grant NOTHING to anon/authenticated — the REVOKE is
  the security.
- **Transient network errors look like code bugs.** Retry once
  before assuming the code is broken.

### Two token-minting RPCs exist — don't confuse them

- `create_profile_token(p_contact_id)` — admin-gated
  (`is_current_user_admin()`). Called from the browser by an
  authenticated admin (the "Generate link" button).
- `create_profile_token_service(p_contact_id)` — NO auth gate,
  service-role only (REVOKE'd from anon/authenticated). Called by
  `api/send-magic-link.ts`, which does its own admin check first.
- Both delegate to the private `_mint_profile_token(p_contact_id)`
  helper. Don't add a third minting path — extend the helper.

### Email HTML, if you touch it

- It's inlined in `api/send-magic-link.ts` with a long header
  comment. Table-based layout, inline styles, system fonts, hosted
  PNG logo — because email clients don't support modern CSS.
- The interpolated contact name is HTML-escaped (`escapeHtml`);
  the magic URL is system-generated so it's not escaped.
- When the invitation email needs the same shell → extract a
  shared `api/_email-template.ts` rather than copy-pasting.

### Stack reminders

- React 18 + TypeScript + Vite + Tailwind
- Supabase (project `amta-crm-prod`, `ifnadlzcdtydbkqnyeif.supabase.co`)
- Vercel auto-deploys on push to main
- Repo: github.com/jacinthsohi/amta-crm
- Live at crm.mocktrial.tech
- Brand color: maroon #70172a
- AMTA contact email: amta@collegemocktrial.org (also the SendGrid
  from-address; also the locked primary email in Profile V1)
- White logo PNG (for email, on maroon):
  `https://collegemocktrial.org/wp-content/uploads/2025/11/cropped-Main-Logo-White.png`

### Vercel env vars

All set as of May 20:
- `PROFILE_LINK_BASE_URL` = `https://crm.mocktrial.tech` ✅
- `SENDGRID_API_KEY` ✅ (Mail-Send-scoped key)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` ✅ (pre-existing)

### Key files for the email feature

- `api/send-magic-link.ts` — the lone Node-runtime function; the
  template for the invitation email.
- `src/features/contacts/ProfileLinkSection.tsx` — two-button
  sidebar.
- `migrations/20260517_create_profile_token_service.sql` (+ rollback)
- `src/features/contacts/AISummary.tsx` — reference for the
  JWT-from-frontend pattern: `supabase.auth.getSession()` →
  `session.access_token` → `Authorization: Bearer`.

### Test resources

- Jacinth's contact_id: `96ea6367-9256-4545-be99-3a7c2ce34ec2`
- Smoke test the magic-link send: click "Email link directly" on
  her own contact page — a real branded email should arrive in her
  inbox. A contact with no email shows the button disabled.
- Profile page URL pattern:
  `https://crm.mocktrial.tech/profile?token=<token>`

### Things to watch for next session

1. **Copy `send-magic-link.ts` for the invitation email function** —
   correct Node-runtime template. Starting from an Edge function
   re-introduces the runtime saga.
2. **Keep the invitation-email scope tight.** Sending the email is
   simple. "How do non-authed users read their invitation by token"
   is the deeper active_invitations design question (💭 Design
   Discussions) and is entangled with the permissioning model
   (🔴 HIGH). Don't accidentally sign up for the RLS redesign.
3. **Extract the shared email template** when the invitation email
   needs the branded shell — don't copy-paste the HTML.
4. **The permissioning model (🔴 HIGH) still looms.** The api/*
   admin-check inconsistency is logged against it.
5. **Profile V1 Chunk 6 polish** (🟡 MEDIUM) is the obvious filler
   if a session ends early.

---

## Status summary

Email automation for magic links: ✅ fully shipped, verified in
prod, branded. The backlog is the source of truth and is current
as of May 20. One email feature remains (invitations); everything
needed to build it is captured above.
