# AMTA CRM Session Handoff — Email automation complete (May 21, 2026)

## Where we are right now

**Email automation is DONE.** Both email features are fully shipped
and verified in prod:

- **Profile magic-link emails** — an admin clicks "Email link
  directly" on a contact; the CRM mints a token and emails a
  branded link. (Shipped May 17–20.)
- **Invitation emails** — `/admin/invitations` "Send invitation"
  and "Resend" actually email the invitation now, instead of
  copy/paste. (Shipped May 21.)

Both send branded HTML email via SendGrid and are verified working
end to end. There is no remaining email work.

**Profile V1** (board-member self-service profile editing via magic
link) remains fully shipped and unaffected.

**Next session: open — see "What to pick up next" below.** There is
no single teed-up task; the email arc is complete. The biggest
outstanding item is the permissioning model design (🔴 HIGH).

---

## ⚠️ HARD-WON LESSON: Vercel does not bundle cross-file imports into Node-runtime functions

**Read this before touching anything in `api/`.** This cost most of
a session on May 21.

The branded email HTML is currently INLINED in both
`api/send-magic-link.ts` and `api/send-invitation-email.ts` —
~100 lines of table-based markup, duplicated. This looks like
obvious tech debt. **Do not try to dedupe it by extracting a shared
module.** We tried twice on May 21:

1. Shared module at `api/_email-template.ts`, imported by the
   functions as a sibling (`./_email-template`). Broke
   `send-magic-link` in prod: **ERR_MODULE_NOT_FOUND**.
2. Shared module at `src/lib/email-template.ts`, imported as
   `../src/lib/...`. Verified in isolation first with a throwaway
   `bundleTest()` helper imported into one function — **also
   ERR_MODULE_NOT_FOUND** at runtime.

**Conclusion:** this Vercel project does not bundle ANY cross-file
import into Node-runtime functions (the `@sendgrid/mail` ones). Each
Node function must be entirely SELF-CONTAINED. Critically:
`npm run build` locally does NOT catch this — it builds green, then
the function 500s at runtime on Vercel with ERR_MODULE_NOT_FOUND.

**If you ever want to dedupe the email HTML:** the only safe path is
to first re-prove cross-file bundling works, in isolation, with a
throwaway import + a deploy + a Vercel log check. As of May 21 it
does not work. Until Vercel's behavior changes, leave the HTML
inlined in both files — a third email function would just be a
third copy. This is recorded in BACKLOG.md under 🟡 MEDIUM as a
⚠️ "do NOT extract" item.

The deeper takeaway for next session: **this codebase has no
working precedent for an `api/` function importing from anywhere
else in the repo.** Treat every `api/` function as standalone.

---

## What shipped this session (May 21) — invitation emails

### New: `api/send-invitation-email.ts`
Node-runtime serverless function. Emails an existing invitation.
- Does NOT create the invitation — the row already exists (created
  client-side by `useSendInvitation`). This endpoint loads it by
  `invitation_id` and emails the `/accept-invitation?token=` link.
- Verifies caller JWT → verifies caller is an admin → loads the
  invitation → sends branded HTML + plain-text email via SendGrid.
- Guards: 404 if the invitation doesn't exist; 409 if already
  accepted or revoked; 422 if the email/token is somehow blank.
- On a successful send, stamps `invitations.sent_at = now()` —
  making that column honest (it was previously set to row-creation
  time; the table header literally says "Sent"). A failure of this
  final UPDATE is logged but does NOT fail the request — the email
  already went out.
- Branded HTML is INLINED — see the ⚠️ lesson above.

### Updated: `src/features/admin/hooks.ts`
- New `useSendInvitationEmail` — calls `/api/send-invitation-email`
  with the caller's JWT (the `supabase.auth.getSession()` →
  `Bearer` pattern).
- `useResendInvitation` now returns the updated row (`.select()
  .single()`), so the page can email it as the next step.

### Updated: `src/features/admin/InvitationsPage.tsx`
- `handleSend` and `handleResend` orchestrate TWO steps: (1)
  create/refresh the invitation row, then (2) call the email
  endpoint. Kept separate (not folded into one mutation) so the
  failure modes stay legible — "the row exists" and "the email
  sent" are two answerable questions.
- If the row is created but the email fails: an amber "warn"
  banner (distinct from the red error banner) tells the admin the
  invitation exists and to use "Copy link". The invite link is
  also auto-copied to the clipboard as a belt-and-suspenders
  backup, per the design decision.
- Per-row "Resending…" state.

### Decisions made (so they're not re-litigated)
- **Email wiring scope:** both "Send" and "Resend" actually email;
  auto-copy-to-clipboard kept as a backup.
- **`sent_at`:** made honest — stamped with the real send time on
  success. (Insert still sets it to creation-time because the
  column is NOT NULL; a successful send overwrites it.)
- **Orchestration — Option A:** the page runs create-row then
  email as two visible steps, for legible failure modes. The email
  send is NOT folded into the mutation.
- **Email copy:** subject "You're invited to the AMTA CRM", button
  "Accept Invitation" (matches the `/accept-invitation` route and
  the existing LoginPage "Accept it here" link).
- **No-email guard:** server-side light validation only (422 on a
  blank email). No client-side disabled-button UX — an invitation
  row can't exist without an email (`NOT NULL`), so that UI would
  be unreachable.
- **Shared email template:** attempted, abandoned — see the ⚠️
  lesson. Inlined in both functions instead.

---

## Earlier: the email automation foundation (May 17–20)

### Backend
- **Migration `20260517_create_profile_token_service.sql`** —
  applied to prod. Private `_mint_profile_token()` helper (single
  source of truth); `create_profile_token()` (admin-gated,
  browser-facing) delegates to it; `create_profile_token_service()`
  — same helper, NO `is_current_user_admin()` gate, because
  service-role callers have no `auth.uid()`. Safety is the REVOKE:
  never granted to anon/authenticated.
- **`api/send-magic-link.ts`** — Node-runtime function. Verifies
  caller JWT → verifies admin → mints a token via
  `create_profile_token_service` → emails a branded link.

### Frontend
- **`src/features/contacts/ProfileLinkSection.tsx`** — sidebar with
  "Generate link" (modal) + "Email link directly" (the endpoint).

### SendGrid
- Domain `collegemocktrial.org` authenticated (SPF/DKIM/DMARC).
- API key with Custom Access scoped to **Mail Send only** (least
  privilege). `SENDGRID_API_KEY` set in Vercel.
- Click tracking is ON (account-wide). It rewrites links to a
  tracking redirect — fine in the HTML emails because the link is
  a labeled button, not visible URL text. Iceboxed for later
  re-evaluation.

### Branded HTML email
- Both email functions send a plain-text body + a branded HTML
  body: light gray wrapper, white card, maroon (#70172a) header
  band with the white AMTA logo (hosted PNG, 160px wide), system
  font stack, a maroon CTA button, raw-URL fallback, footer.
- Table-based layout, inline styles — email clients don't support
  modern CSS. See the long in-file header comment before editing.

---

## What to pick up next

No single task is teed up — the email arc is done. Candidates, by
priority:

- **🔒 Permissioning model design (🔴 HIGH).** The big one. A
  design/discussion session, not a build. Workshops the multi-tier
  access model; it blocks the RLS Tier 2/3 audit and the
  active_invitations work. Different *kind* of session — more
  conversation, less code.
- **Profile V1 Chunk 6 polish (🟡 MEDIUM)** — good filler if a
  session ends early.
- **Unify the program picker UX (🟡 MEDIUM)** — adopt the
  ProgramCombobox on /alumni-signup and the admin affiliation form.
- **Seasons concept design discussion (💭 Design Discussions)** —
  possibly fast; unblocks board_terms, current-vs-past committees,
  richer data viz.
- **"Request login" button (🟡 MEDIUM)** — a board member enters
  their email and gets a fresh magic link. Small now that the
  mint-and-send code exists. Watch the security shape: must NOT
  reveal whether an email matches a contact.

---

## Important context for next session

### LESSON: Edge vs Node runtime on Vercel

`api/send-magic-link.ts` and `api/send-invitation-email.ts` are the
only functions on the Vercel **Node** runtime. Every other api/*
function is **Edge**. This is necessary, not tech debt:

- `@sendgrid/mail` depends on Node built-ins (`fs`, `path`) the
  Edge runtime does not provide. A function using it MUST be
  `runtime: "nodejs"`. Declaring it Edge → build failure.
- Edge and Node handlers have **different signatures**:
  - Edge: `handler(request: Request): Promise<Response>` — Web
    standard. `request.headers.get(...)`, `await request.json()`,
    `return new Response(...)`.
  - Node: `handler(req: VercelRequest, res: VercelResponse)` —
    Express style. `req.headers.authorization` (plain object),
    `req.body` (pre-parsed), `res.status(n).json(...)`.
- Switching a function's runtime means rewriting all its I/O
  plumbing, not just the `config` line.
- **For any new email function: copy `send-invitation-email.ts` or
  `send-magic-link.ts` as the template** — both are the correct
  Node shape AND correctly self-contained (no imports to fail to
  bundle). Do not start from an Edge function.

### Working style (Jacinth's preferences, well-established)

- **Full file replacements** over surgical edits. Even small
  changes → send the whole file. She'll `mv` from Downloads.
  (Migration files are the exception — pasted into the Supabase
  SQL editor; select-all before running or only the statement
  under the cursor executes.)
- **Pause for design questions before coding.** The
  `ask_user_input_v0` tool is useful for surfacing options.
- **Honest pushback on scope** — and on Claude's own mistakes. The
  May 21 session is a case study: a confident-but-wrong assumption
  about Vercel bundling cost real time. The recovery that worked:
  restore the broken feature FIRST (never debug from a broken
  baseline), then test the risky assumption in ISOLATION before
  building on it. Apply that pattern. Don't ship an unverified
  infrastructure assumption into a working feature.
- **One commit per coherent feature.**
- **Build locally before pushing** (`npm run build`) — but know
  its limits: a local build does NOT catch Vercel runtime/deploy
  errors. The Edge-module failure and BOTH ERR_MODULE_NOT_FOUND
  failures built green locally and only failed on Vercel. Always
  watch the Vercel deploy go green AND smoke-test the live
  function.
- **Functions that fail with specific, honest error strings** make
  debugging fast — keep writing them that way.

### Profile V1 / SECURITY DEFINER gotchas to carry forward

- **`p_` prefix on function parameters.** PostgREST passes named
  args literally; client calls must match.
- **Postgres won't change a function's return type via CREATE OR
  REPLACE** — DROP first.
- **VERIFY SCHEMA before writing migrations.** Run
  `grep -A 30 "create table public.<tablename>"` first.
- **REVOKE PUBLIC + GRANT EXECUTE to anon/authenticated** for every
  token-gated SECURITY DEFINER function. For service-role-only
  functions, REVOKE from PUBLIC and grant NOTHING to
  anon/authenticated — the REVOKE is the security.
- **Transient network errors look like code bugs.** Retry once.

### Two token-minting RPCs exist — don't confuse them

- `create_profile_token(p_contact_id)` — admin-gated. Called from
  the browser (the "Generate link" button).
- `create_profile_token_service(p_contact_id)` — NO auth gate,
  service-role only. Called by `api/send-magic-link.ts`, which
  does its own admin check first.
- Both delegate to private `_mint_profile_token(p_contact_id)`.
  Don't add a third minting path — extend the helper.
- Note: the INVITATION flow does NOT use these. Invitation tokens
  are generated client-side (`crypto.getRandomValues` in
  `useSendInvitation`) and stored on the `invitations` row. No RPC.

### Email functions — quick map

- `api/send-magic-link.ts` — profile magic-link email. Self-
  contained, branded HTML inlined.
- `api/send-invitation-email.ts` — invitation email. Self-
  contained, branded HTML inlined (a deliberate copy — see the
  ⚠️ lesson).
- Both: Node runtime, admin-gated, reuse `SENDGRID_API_KEY` +
  `PROFILE_LINK_BASE_URL`. Contact first name is HTML-escaped;
  system-generated URLs are not.
- If the branded look needs to change, change it in BOTH files.

### Stack reminders

- React 18 + TypeScript + Vite + Tailwind
- Supabase (project `amta-crm-prod`, `ifnadlzcdtydbkqnyeif.supabase.co`)
- Vercel auto-deploys on push to main
- Repo: github.com/jacinthsohi/amta-crm
- Live at crm.mocktrial.tech
- Brand color: maroon #70172a
- Email from-address: amta@collegemocktrial.org (also the locked
  primary email in Profile V1; `help@` swap is a 🟢 LOW item)
- White logo PNG (for email, on maroon):
  `https://collegemocktrial.org/wp-content/uploads/2025/11/cropped-Main-Logo-White.png`

### Vercel env vars

All set:
- `PROFILE_LINK_BASE_URL` = `https://crm.mocktrial.tech` ✅
- `SENDGRID_API_KEY` ✅ (Mail-Send-scoped key)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` ✅ (pre-existing)

No new env vars and no migration were needed for the invitation
email — it reuses everything and touches no schema.

### Test resources

- Jacinth's contact_id: `96ea6367-9256-4545-be99-3a7c2ce34ec2`
- Magic-link email: click "Email link directly" on a contact.
- Invitation email: `/admin/invitations` → pick a contact → "Send
  invitation"; or "Resend" on an existing row.
- Profile page URL: `https://crm.mocktrial.tech/profile?token=<t>`
- Invite URL: `https://crm.mocktrial.tech/accept-invitation?token=<t>`

### Things to watch for next session

1. **Never extract a shared module for `api/` functions** without
   re-proving Vercel bundling in isolation first — see the ⚠️
   lesson. As of May 21 it does not work; functions are self-
   contained on purpose.
2. **The permissioning model (🔴 HIGH)** is the biggest open item.
   The api/* admin-check inconsistency is logged against it.
3. **Profile V1 Chunk 6 polish** (🟡 MEDIUM) is the obvious filler
   if a session ends early.

---

## Status summary

Email automation: ✅ COMPLETE — magic-link emails and invitation
emails both shipped, branded, verified in prod. The backlog is the
source of truth and is current as of May 21. No email work remains.
Next session is open; the permissioning model is the largest
outstanding item.
