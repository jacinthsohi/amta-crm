# AMTA CRM Session Handoff — Email magic-link send shipped (May 17, 2026)

## Where we are right now

**The profile magic-link email path is built and verified in prod.**
Admins can click "Email link directly" on a contact and the CRM
mints a fresh token, builds the URL, and (will) email it via
SendGrid. Every stage works in production EXCEPT the actual SendGrid
send — see "The one thing still blocked" below.

This session ran the "option 2" plan from the previous handoff: do
all the email-automation work that does NOT require SendGrid account
access, since access was pending. That turned out to be everything
except the final ~15-minute config step.

**Profile V1 (from the prior session) is still fully shipped** —
board members self-service their profile via magic link. Unchanged
this session except that the token-minting RPC was refactored (see
below) — and re-verified working after the refactor.

---

## The one thing still blocked: SendGrid

`api/send-magic-link.ts` is complete and deployed. Clicking "Email
link directly" today returns: **"Server misconfigured: SENDGRID_API_KEY
is not set."** That is the EXPECTED and CORRECT state — it means
auth, admin-check, token mint, and URL build all succeeded, and only
the SendGrid send itself is missing its key.

**To finish (≈15 min, once SendGrid account access is in hand):**
1. **Authenticate the `collegemocktrial.org` domain in SendGrid**
   — Sender Authentication → SPF / DKIM / DMARC. SendGrid gives you
   DNS records; add them at the domain's DNS host. REQUIRED, or
   emails land in spam. This is the slow part (DNS propagation).
2. **Add `SENDGRID_API_KEY` to Vercel** env vars (Production).
3. **Redeploy** — env var changes don't reach already-built
   deployments.
4. Click "Email link directly" on a real contact, confirm the
   email arrives, verify it's in Inbox not Spam/Promotions.

`PROFILE_LINK_BASE_URL` is already set in Vercel
(`https://crm.mocktrial.tech`) — done this session.

This is also tracked in the backlog as the 🔴 HIGH "SendGrid-gated
finish" item.

---

## Next session — a fork

**If SendGrid access has landed:**
1. Do the ~15-minute SendGrid-gated finish above first. Quick win,
   makes the magic-link feature genuinely complete.
2. Then build **email automation for invitations** — the sibling
   feature. Emailing a new user their invitation link (the
   `AcceptInvitationPage` / `FinishInvitationPage` flow) instead of
   hand-sending from Gmail. This is now mostly a known quantity:
   `api/send-magic-link.ts` is the working template to copy,
   including its Node-runtime shape (see "Edge vs Node" below — do
   NOT default to the Edge pattern the other api/* functions use).

**If SendGrid access is STILL blocked:**
- The Seasons concept design discussion is still the best fallback
  (it was the fallback last session too). Possibly a fast one once
  you walk Option 1 (label) vs Option 2 (schema branch) — and it
  unblocks board_terms population, current-vs-past committee
  distinction, and richer data-viz granularity. See backlog
  💭 Design Discussions.
- Or: Profile V1 Chunk 6 polish (🟡 MEDIUM) is a good filler.

**Possible bonus once SendGrid is live:** the "Request login" button
(🟡 MEDIUM, new this session) — a board member who lost their link
enters their email and gets a fresh one. Small now that the
mint-and-send code exists; just watch the security shape (must not
reveal whether an email matches a contact).

---

## What shipped this session

Four commits, one migration (+ rollback), one new dependency
(`@sendgrid/mail`), one devDependency (`@vercel/node`).

### Backend
- **Migration `20260517_create_profile_token_service.sql`** — applied
  to prod and verified. Extracts the token revoke-then-issue logic
  into a private `_mint_profile_token()` helper (single source of
  truth). `create_profile_token()` (admin-gated, browser-facing)
  now delegates to it — behavior unchanged, re-verified working.
  Adds `create_profile_token_service()` — same helper, NO
  `is_current_user_admin()` gate, because service-role callers have
  no `auth.uid()`. Its safety is the REVOKE: never granted to
  anon/authenticated. The migration file header explains the
  missing-auth-gate rationale at length.
- **`api/send-magic-link.ts`** — Vercel serverless function. Verifies
  caller JWT → verifies caller is an admin (`contacts.is_admin`) →
  mints a token via `create_profile_token_service` → builds the URL
  → sends via SendGrid. Returns clean JSON errors at every step.

### Frontend
- **`src/features/contacts/ProfileLinkSection.tsx`** — rewritten.
  The sidebar "Profile self-service" section now has TWO buttons:
  "Generate link" (opens the existing modal, unchanged) and
  "Email link directly" (calls the new endpoint, no modal). The
  second is disabled when the contact has no email on file, with a
  hint. Success/sending/error states inline. The modal — including
  its "Compose email" mailto fallback — is untouched.

### Decisions made this session (so they're not re-litigated)
- **Auth bar:** the send endpoint checks caller-is-ADMIN, stricter
  than `contact-summary.ts` (which only checks caller-is-a-user),
  because minting an access token is higher-stakes. This creates a
  deliberate inconsistency across api/* functions — logged as a
  🟢 LOW backlog item to revisit under the permissioning model.
- **Token minting — Option A:** a dedicated service-role RPC, not
  re-implementing the revoke/insert logic in TypeScript. Keeps
  token logic as one source of truth.
- **UI — Option 2:** two separate sidebar buttons, not a third
  button crammed into the modal. Modal + mailto fallback preserved.
- **From address:** `help@collegemocktrial.org`.
- **Plain text v1.** Branded HTML email wrapper deferred to v2
  (backlog 🟡 MEDIUM).
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
- `send-magic-link.ts` has a long header comment explaining all of
  this. **For the invitation email function: copy
  `send-magic-link.ts` as the template** — it's already the correct
  Node shape. Do not start from an Edge function.

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
  over-scoping, and pushes back when Claude is over-cautious.
  Example this session: she flagged adding a feature at session
  end; the right call was "capture in backlog, don't build now" —
  but the small one-line legacy-copy removal WAS worth doing
  inline. Judge size honestly.
- **Bundle related work cleanly.** One commit per coherent feature.
- **Build locally before pushing** (`npm run build`). NOTE: a local
  Vite build does NOT catch Vercel runtime/deployment errors (the
  Edge-module failure only showed up on Vercel). Watch the Vercel
  deploy go green too.

### Profile V1 / SECURITY DEFINER gotchas to carry forward

- **`p_` prefix on function parameters.** PostgREST passes named
  args literally; client calls must match. `create_profile_token(p_contact_id: ...)`.
- **Postgres won't change a function's return type via CREATE OR
  REPLACE** — DROP first, or pick one type and stay consistent.
- **VERIFY SCHEMA before writing migrations.** Run
  `grep -A 30 "create table public.<tablename>"` first. Surprises
  (`deleted_at` columns) have changed designs mid-flight.
- **REVOKE PUBLIC + GRANT EXECUTE to anon/authenticated** for every
  token-gated SECURITY DEFINER function. For service-role-only
  functions (like `create_profile_token_service`), REVOKE from
  PUBLIC and grant NOTHING to anon/authenticated — the REVOKE is
  the security.
- **Transient network errors look like code bugs.** "TypeError:
  Failed to fetch" mid-test was an in-flight WiFi blip. Retry once
  before assuming the code is broken.

### Two token-minting RPCs now exist — don't confuse them

- `create_profile_token(p_contact_id)` — admin-gated
  (`is_current_user_admin()`). Called from the browser by an
  authenticated admin (the "Generate link" button).
- `create_profile_token_service(p_contact_id)` — NO auth gate,
  service-role only (REVOKE'd from anon/authenticated). Called by
  `api/send-magic-link.ts`, which does its own admin check first.
- Both delegate to the private `_mint_profile_token(p_contact_id)`
  helper. Don't add a third minting path — extend the helper.

### Stack reminders

- React 18 + TypeScript + Vite + Tailwind
- Supabase (project `amta-crm-prod`, `ifnadlzcdtydbkqnyeif.supabase.co`)
- Vercel auto-deploys on push to main
- Repo: github.com/jacinthsohi/amta-crm
- Live at crm.mocktrial.tech
- Brand color: maroon #70172a
- AMTA contact email: amta@collegemocktrial.org (the locked primary
  email shown to board members in Profile V1)
- Email from-address: help@collegemocktrial.org (SendGrid)

### Vercel env vars (for the email feature)

- `PROFILE_LINK_BASE_URL` = `https://crm.mocktrial.tech` — SET ✅
- `SENDGRID_API_KEY` — NOT SET, pending account access ⏳
- (existing, already set: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `ANTHROPIC_API_KEY`)

### Files touched / relevant this session

- `api/send-magic-link.ts` (new — the lone Node-runtime function)
- `src/features/contacts/ProfileLinkSection.tsx` (rewritten —
  two-button sidebar)
- `migrations/20260517_create_profile_token_service.sql` (+ rollback)
- `package.json` / `package-lock.json` (added `@sendgrid/mail`,
  `@vercel/node`)
- `src/features/contacts/AISummary.tsx` (NOT changed — referenced
  as the JWT-from-frontend pattern; `supabase.auth.getSession()` →
  `session.access_token` → `Authorization: Bearer`)
- `docs/BACKLOG.md` (updated this session)

### Test resources

- Jacinth's contact_id: `96ea6367-9256-4545-be99-3a7c2ce34ec2`
- Smoke test the magic-link send: click "Email link directly" on
  any contact's detail page. Pre-SendGrid, expect the inline error
  "Server misconfigured: SENDGRID_API_KEY is not set". A contact
  with no email should show the button disabled.
- Profile page URL pattern:
  `https://crm.mocktrial.tech/profile?token=<token>`

### Things to watch for next session

1. **Copy `send-magic-link.ts` for the invitation email function** —
   it's the correct Node-runtime template. Starting from an Edge
   function re-introduces the runtime saga.
2. **Do the SendGrid-gated finish before building more email code.**
   If the domain isn't authenticated, test emails land in spam and
   you'll debug code that isn't broken.
3. **The permissioning model (🔴 HIGH) still looms.** Not blocking
   email work, but the api/* admin-check inconsistency we created
   this session is logged against it. When the model lands, make
   the api/* auth checks uniform.
4. **Profile V1 Chunk 6 polish** (🟡 MEDIUM) is the obvious filler
   if a session ends early.

---

## Time check / energy

Half-day session, done late morning. Solid scope: full email
backend + UI built and verified in prod, blocked only on an
external account. Backlog and handoff updated. Clean stopping
point — the SendGrid finish is a crisp, well-documented ~15-minute
task whenever access lands.
