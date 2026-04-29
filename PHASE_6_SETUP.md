# Phase 6 Setup Guide — Deploy to Production

The CRM goes live. This is the most procedural phase of the project — most
of the work is clicking around in dashboards (GitHub, Supabase, Vercel,
Squarespace, Google Cloud) rather than writing code. Budget **2–3 hours**
for the first run-through, plus **2–3 business days** of waiting if you
choose to submit for OAuth verification (recommended but optional).

The plan, in order:

1. **GitHub** — get the code into a private repo
2. **Production Supabase** — create a separate project for live data
3. **Vercel** — deploy the code, connect to GitHub for auto-deploys
4. **Custom domain** — point `crm.mocktrial.tech` at Vercel via Squarespace
5. **Google OAuth** — set up the production OAuth client, configure consent screen
6. **First sign-in** — invite yourself, log in, smoke test
7. **(Optional)** submit for Google verification to remove the warning screen

There's no `npm install` step at the end this time. Phase 6 is mostly
infrastructure.

---

## Step 0 — Prerequisites

Before you start, have these in your back pocket:

- A **GitHub account** with a recent password. If it's been a while:
  - You may need to set up a **Personal Access Token** for HTTPS pushes,
    or an **SSH key**. The guide below assumes Personal Access Token (simpler).
- Access to your **Squarespace Domains** account where you registered
  `mocktrial.tech`
- Access to your **Supabase** account — the same one with your dev project
- A **Vercel account** — free tier is fine. Sign up at vercel.com if you
  don't have one yet (Vercel encourages signing up via GitHub, which makes
  the connection step painless later)
- A **Google Cloud Console** account — same one you used for the dev OAuth client

You don't need to upgrade any of these to paid tiers for AMTA's scale.

---

## Step 1 — Replace project files with the Phase 6 drop

Same as before:

```
cd ~/Code
rm -rf amta-crm
mkdir amta-crm
cd amta-crm
cp -r ~/Downloads/amta-crm-app/. ~/Code/amta-crm/
cp .env.example .env
code .env
```

Paste your **dev** Supabase credentials (the ones you've been using). We'll
swap to production credentials only after Vercel is deployed — local dev
should stay pointed at the dev project so you can keep experimenting
without polluting production data.

```
npm install
npm run dev
```

Verify the new `/privacy` page renders by visiting
[localhost:5173/privacy](http://localhost:5173/privacy). It should show a
simple privacy policy. The login page should also have a small "Privacy
policy · Support" footer at the bottom.

If both work, the code is ready to ship.

---

## Step 2 — Push the code to GitHub

### 2a. Create a new private repo

Go to **github.com**, sign in.

Click the **+** in the top right → **New repository**.

Fill in:

- **Repository name**: `amta-crm`
- **Description**: "Internal CRM for the American Mock Trial Association"
- **Visibility**: **Private** (important — this code is internal)
- **Initialize this repository with**: leave all checkboxes UNCHECKED. We
  already have files locally; we don't want GitHub to create a conflicting
  README or `.gitignore`.

Click **Create repository**.

You'll land on an empty repo page that shows you a few snippets of git
commands. Keep this tab open — you'll need the URL it shows.

### 2b. Set up Personal Access Token (for HTTPS auth)

If you haven't pushed to GitHub from your terminal in a while, you'll
need a Personal Access Token. GitHub no longer accepts your account
password for git pushes.

1. In a new tab, go to **github.com/settings/tokens**
2. Click **Generate new token (classic)**
3. **Note**: "AMTA CRM laptop"
4. **Expiration**: 1 year (or "No expiration" if you really want)
5. **Scopes**: check the **repo** box (all sub-checkboxes get included)
6. Click **Generate token**
7. **Copy the token** — you can't see it again after leaving this page.
   Save it somewhere safe (password manager, notes app, whatever).

### 2c. Initialize git locally and push

In your terminal, in `~/Code/amta-crm`:

```
git init -b main
git add .
git commit -m "Initial commit — Phase 6 ready"
git remote add origin https://github.com/<YOUR-USERNAME>/amta-crm.git
git push -u origin main
```

Replace `<YOUR-USERNAME>` with your GitHub username (it's in the URL of
the repo page, like `github.com/jacinthsohi/amta-crm`).

When git asks for credentials:
- **Username**: your GitHub username
- **Password**: paste the **Personal Access Token** you just generated
  (NOT your GitHub password)

Some Macs cache this in Keychain so you only enter it once. Others ask
every time — if so, you can set up Git Credential Manager later.

Refresh the GitHub repo page in your browser. You should see all your
files. The `node_modules/` folder, `.env`, and `dist/` should NOT be
there — `.gitignore` correctly excludes them.

### Got an error?

- **"Permission denied"** — your Personal Access Token doesn't have the
  `repo` scope. Re-generate with the right scope.
- **"src refspec main does not match any"** — try `git push -u origin master`
  instead. Older git versions default the branch to `master` not `main`.
- **"remote: Repository not found"** — double-check the URL spelling.
  Easy mistake.

---

## Step 3 — Create the production Supabase project

We need a SECOND Supabase project, separate from your existing dev one.
This way, dev experimentation can't break production.

### 3a. Create the project

Go to **app.supabase.com**.

In the project picker (top left), click **+ New project**.

Fill in:

- **Organization**: your existing org (the one with the dev project)
- **Project name**: `amta-crm-prod`
- **Database password**: generate a strong one. **Save this** — you'll
  need it later if you use the CLI. You can always reset it via the
  dashboard if lost, but easier to keep it.
- **Region**: **East US (North Virginia)** — closest to most US users
  and same region Vercel deploys to by default
- **Pricing plan**: **Free**

Click **Create new project**. Wait ~2 minutes for provisioning.

### 3b. Run all migrations

Once the project is provisioned, you need to apply the schema.

In the production project's dashboard, go to **SQL Editor** (left sidebar).

You'll run each migration file in order. There are four:

1. `20260427000001_initial_schema.sql`
2. `20260427000002_rls_and_views.sql`
3. `20260427000003_soft_delete_helpers.sql`
4. `20260427000004_seed_data.sql` — **DECISION POINT**: this seeds demo
   data (sample contacts, programs, etc.) into the dev project. For
   production, you have two options:
   - **Skip it** — start with an empty database
   - **Run it** — start with the seeded data, then delete demo records
     once you've added real data

   My recommendation: **skip the seed file**. Production should start
   clean. You'll seed real AMTA data via the in-app forms.

For each migration you want to run:

1. Open the file in your local editor
2. Copy the entire contents
3. In the Supabase SQL Editor, click **+ New query**
4. Paste the SQL
5. Click **Run** (or Cmd+Enter)
6. Verify "Success" appears at the bottom — no red errors

If a migration fails, READ the error carefully. Most likely cause:
the previous migration didn't fully run. Re-run the failed one only —
Postgres errors stop transactions cleanly so you can usually re-run
from the failure point.

### 3c. Grab production credentials

In the production project, go to **Project Settings** → **API**.

Copy these two values somewhere safe:

- **Project URL** (looks like `https://xxxxx.supabase.co`)
- **anon public key** (long JWT-looking string starting with `eyJ...`)

You'll need both in Step 4.

### 3d. Set the Site URL — placeholder for now

In the production project, go to **Authentication** → **URL Configuration**.

For now, set:

- **Site URL**: `http://localhost:5173` (we'll update after Vercel deploys)
- **Redirect URLs**: leave empty for now

Save. We'll come back here in Step 4 after we have the Vercel URL.

### 3e. Configure Google OAuth provider in Supabase

You can do this now using your DEV Google OAuth client temporarily,
then swap to a production client in Step 5. OR skip this until Step 5
when we have the production Google client ready.

**My recommendation: skip until Step 5.** Easier to do once with the
final credentials.

---

## Step 4 — Deploy to Vercel

### 4a. Connect GitHub to Vercel

Go to **vercel.com**.

If you haven't signed up yet, click **Sign up** and choose **Continue
with GitHub**. This gives Vercel permission to access your GitHub repos.

If you already have a Vercel account but it isn't connected to GitHub:
go to **Settings** → **Git** and connect GitHub.

### 4b. Import the repo

From the Vercel dashboard, click **Add New** → **Project**.

You'll see a list of your GitHub repos. Find `amta-crm` and click
**Import**.

If it doesn't show up:
- You may need to grant Vercel access to your repos. Click
  **"Adjust GitHub App Permissions"** and either grant access to all
  repos or just to `amta-crm`.

### 4c. Configure the deployment

Vercel auto-detects Vite. You should see:

- **Framework preset**: Vite
- **Build command**: `vite build` (default)
- **Output directory**: `dist` (default)
- **Install command**: `npm install` (default)

Don't change these. They're correct.

Expand **Environment Variables**. Add two:

- **Name**: `VITE_SUPABASE_URL` · **Value**: your production project URL
  from Step 3c
- **Name**: `VITE_SUPABASE_ANON_KEY` · **Value**: your production anon key
  from Step 3c

For each variable, leave **Production**, **Preview**, **Development**
all checked.

Click **Deploy**.

Vercel runs `npm install`, then `vite build`, then publishes the result.
First deploy takes 2–3 minutes. You'll see real-time logs.

### 4d. Verify deployment

When deploy finishes, you'll get a URL like
`amta-crm-xyz123.vercel.app`. Click it.

You should see the AMTA CRM **login page**. Don't try to sign in yet —
Google OAuth isn't configured for this URL.

Try going to `your-vercel-url.vercel.app/privacy`. The privacy policy
should render. If it returns a 404, the `vercel.json` SPA rewrite isn't
working. Check that `vercel.json` is in the project root and was
committed to git.

### 4e. Update Supabase Site URL

Now that you have the Vercel URL, go back to your **production**
Supabase project → **Authentication** → **URL Configuration**.

Update:

- **Site URL**: `https://amta-crm-xyz123.vercel.app` (your actual
  Vercel URL)
- **Redirect URLs**: add `https://amta-crm-xyz123.vercel.app/**`
  (the `/**` is critical — it allows Supabase to redirect back to any
  page in the app after auth)

Save.

We'll update both URLs again after the custom domain is live in Step 5.

---

## Step 5 — Custom domain via Squarespace

### 5a. Add the domain in Vercel

In Vercel, go to your project → **Settings** → **Domains**.

Type `crm.mocktrial.tech` and click **Add**.

Vercel will show you DNS records to add. Most likely:

- **Type**: `CNAME`
- **Name**: `crm`
- **Value**: `cname.vercel-dns.com`

Keep this page open.

### 5b. Add the DNS record in Squarespace

Sign in to **squarespace.com** → **Domains** → click `mocktrial.tech`.

Look for **DNS Settings** or **Custom Records**.

Add a new record matching what Vercel showed:

- **Type**: CNAME
- **Host**: `crm`
- **Data**: `cname.vercel-dns.com`
- **TTL**: leave default (auto)

Save.

### 5c. Wait for DNS propagation

DNS changes propagate in **5 minutes to 48 hours**, usually under 30
minutes. Vercel's domain page will show "Pending" then switch to
"Valid Configuration" once it sees the record.

Vercel auto-issues an SSL certificate once DNS is valid (Let's Encrypt,
free). This takes another 1–5 minutes.

When done, you can visit `https://crm.mocktrial.tech` and see the
login page. **The custom domain is live.**

### 5d. Update Supabase URLs again

Production Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: `https://crm.mocktrial.tech`
- **Redirect URLs**: replace the Vercel URL with `https://crm.mocktrial.tech/**`

Save.

You can leave the old Vercel URL working too — Vercel keeps both URLs
live indefinitely. But the canonical URL going forward is
`crm.mocktrial.tech`.

---

## Step 6 — Google OAuth for production

This is the most fiddly step. We're creating a **separate** OAuth client
for production, distinct from your dev OAuth client. Production OAuth
clients can be submitted for verification; dev ones can stay in Testing
mode forever.

### 6a. Create a new Google Cloud project

Go to **console.cloud.google.com**.

In the project picker (top bar), click **New Project**.

- **Project name**: `AMTA CRM Production`
- **Organization**: leave default (no organization)
- Click **Create**

Wait ~30 seconds. Switch to the new project via the picker.

### 6b. Configure the OAuth consent screen

In the left sidebar (or via search), navigate to **APIs & Services** →
**OAuth consent screen**.

Click **Get Started**.

**App information** step:

- **App name**: `AMTA CRM`
- **User support email**: `help@collegemocktrial.org`
- Click **Next**

**Audience** step:

- Choose **External** (we already established Internal-only won't work
  for AMTA's user mix)
- Click **Next**

**Contact information** step:

- **Email addresses**: `help@collegemocktrial.org`
- Click **Next**

**Finish** step:

- Agree to the user data policy
- Click **Continue** → **Create**

You'll land on the OAuth consent screen overview.

### 6c. Add the app's branding details

Click into **Branding** in the left sidebar.

Fill in:

- **App name**: `AMTA CRM` (already set)
- **User support email**: `help@collegemocktrial.org` (already set)
- **App logo**: optional. Upload AMTA's logo if you have a square PNG
  (recommended size: 120×120px). Skip if you don't have one ready.
- **App domain** section:
  - **Application home page**: `https://crm.mocktrial.tech`
  - **Application privacy policy link**: `https://crm.mocktrial.tech/privacy`
  - **Application terms of service link**: leave blank (we don't have
    one — Google doesn't require this for non-sensitive scopes)
- **Authorized domains**: `mocktrial.tech` (just the apex; Google
  matches all subdomains automatically)
- **Developer contact information**: `help@collegemocktrial.org`

Click **Save**.

### 6d. Configure scopes

In the left sidebar, click **Data Access**.

Click **Add or Remove Scopes**.

We only need three basic scopes:

- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

These are non-sensitive scopes — they don't need verification beyond
basic brand verification. Check those three boxes, click **Update**,
then **Save**.

### 6e. Add yourself as a test user

In the left sidebar, click **Audience**.

Scroll to **Test users** → **+ Add users**. Add:

- Your own email (`jacinthsohi@gmail.com`)
- `help@collegemocktrial.org` if you want emails to that address to
  also test
- Other AMTA board members you want to invite for initial testing

Click **Save**. Up to 100 test users allowed.

### 6f. Create the OAuth client credentials

In the left sidebar, navigate to **APIs & Services** → **Credentials**.

Click **+ Create Credentials** → **OAuth client ID**.

Fill in:

- **Application type**: Web application
- **Name**: `AMTA CRM Web Client`
- **Authorized JavaScript origins**:
  - `https://crm.mocktrial.tech`
- **Authorized redirect URIs**:
  - `https://<your-supabase-prod-project>.supabase.co/auth/v1/callback`
    (find your project URL from Supabase Step 3c, append `/auth/v1/callback`)

Click **Create**.

A modal pops up showing:

- **Client ID**: copy this
- **Client secret**: copy this

Save both somewhere safe. You'll need them in Step 6g.

### 6g. Wire Google OAuth into Supabase

In the production Supabase project, go to **Authentication** →
**Providers** → click **Google**.

- Toggle **Enable Sign in with Google** to ON
- **Client ID (for OAuth)**: paste the Client ID from Step 6f
- **Client secret (for OAuth)**: paste the Client secret from Step 6f
- **Authorized Client IDs**: leave blank
- **Skip nonce check**: leave OFF

Click **Save**.

### 6h. Test sign-in

Go to **https://crm.mocktrial.tech**.

Click **Continue with Google**.

You'll be sent to Google's account picker. Pick your account.

Because we're in **Testing mode**, you'll see a scary warning:

> **Google hasn't verified this app**
>
> The app is requesting access to sensitive info in your Google
> Account. Until the developer (`help@collegemocktrial.org`) verifies
> this app with Google, you shouldn't use it.

Click **Advanced** → **Go to AMTA CRM (unsafe)** → **Continue**.

You'll be redirected back to AMTA CRM. **You should be signed in.**

Welcome to production. 🎉

---

## Step 7 — First admin invitation and smoke test

Once you're signed in, go to **Admin → Invitations** in the sidebar (or
visit `/admin/invitations`).

Add invitations for the AMTA board members who should have access.
They'll receive emails with a link to accept.

**A note on invitation emails:** Supabase's default email service has
**low rate limits** (about 30 emails per hour) and **mediocre
deliverability**. For AMTA's invitation volume that's almost certainly
fine, but invitations might land in spam. If a board member doesn't
receive their invitation, ask them to check spam, or have them
sign in directly (they'll automatically be created as a contact when
they accept the invitation, regardless of how the invitation arrived).

If invitation deliverability becomes a problem, you can configure a
custom SMTP provider (SendGrid free tier, Resend, AWS SES) in
**Authentication** → **Emails** → **SMTP Settings**. Skip for now.

### Smoke test

Once you're signed in, do a quick smoke test:

- ✅ Dashboard loads (greeting + stats + 4 cards)
- ✅ Click **Contacts** — empty list (since we skipped seed data)
- ✅ Create a contact — should save, return to detail page
- ✅ Press **Cmd+K** — search palette opens
- ✅ Open a form, type formatted text in a Notes field — bold/italic/
  lists work
- ✅ Refresh the page on a deep route like `/contacts/abc-123` — should
  load directly without 404 (the `vercel.json` rewrite is doing its job)

If all of those work, **Phase 6 is complete.** AMTA CRM is in production.

---

## Step 8 (Optional) — Submit for Google verification

This step removes the scary "Google hasn't verified this app" warning
and lifts the 7-day refresh token expiration that forces users to
re-authenticate weekly. Recommended.

### When to do this

- Anytime after Step 7 is working
- Plan for **2–3 business days** of waiting for Google to review
- Brand verification only (no security audit) since we don't use
  sensitive scopes

### How to submit

In Google Cloud Console, navigate to your **AMTA CRM Production**
project → **APIs & Services** → **OAuth consent screen** → **Audience**
section.

Click **Publish App**.

Confirm the warning. The app's **Publishing status** changes from
"Testing" to "In production." It now requires verification before
displaying without warnings.

Click **Prepare for verification**.

Google walks you through their review form. Most of what you'll need
is already configured:

- **App identity**: name, logo, support email — all set in Step 6c
- **App home page**: `https://crm.mocktrial.tech`
- **Privacy policy**: `https://crm.mocktrial.tech/privacy`
- **Authorized domains**: `mocktrial.tech`
- **Verify ownership of `mocktrial.tech`** — this is the slowest part.
  Google asks you to verify domain ownership through Google Search Console.

### Verifying domain ownership

1. Go to **search.google.com/search-console**
2. Click **Add property** → **URL prefix** → enter
   `https://crm.mocktrial.tech` (or `https://mocktrial.tech`)
3. Google shows you a verification method. **TXT record** is most
   reliable — they give you a long random string to add as a TXT
   record in your DNS.
4. Add the TXT record in **Squarespace Domains** → DNS settings:
   - **Type**: TXT
   - **Host**: `@` (apex) or whatever Google specified
   - **Data**: the verification string Google gave you
5. Wait 5–30 minutes for DNS to propagate
6. In Search Console, click **Verify**

Once verified, Search Console shows ✓. Go back to the OAuth verification
form and continue.

### Justification for sensitive scopes

We don't use sensitive scopes, so this section is empty/skip.

### Submit

Submit the form. Google says "Your verification is in progress."

Most non-sensitive-scope verifications complete in **2–3 business
days**. You may receive emails asking for clarification — these go to
the support email (`help@collegemocktrial.org`). Respond promptly to
keep the review moving.

When verification completes, Google emails you. The warning screen is
gone. Refresh tokens no longer expire after 7 days.

You're verified. 🎉

---

## Things still pending (deferred)

- **Restore UI for soft-deleted records** — admin-accessible page
  to view and restore soft-deleted entities. Punted to post-launch
  polish.
- **Inline edit on inline records** — board terms, officer terms,
  committee assignments, program affiliations, event hosts/staff/
  documents. Currently create-only. Polish phase.
- **Migrate to crm.amta.org** — when AMTA's website vendor can update
  the DNS, port the production domain over. Three-step migration:
  add new domain in Vercel, update Supabase redirect URLs, update
  Google OAuth authorized domains.
- **Custom SMTP** — if invitation deliverability is poor, configure
  SendGrid/Resend/SES in Supabase auth settings.
- **Sentry / error monitoring** — useful for catching runtime errors
  in production. Free tier works for AMTA scale.
- **Database backups beyond 7 days** — free Supabase tier does daily
  backups for 7 days. Pro tier adds Point-in-Time Recovery up to 7
  days. Consider when you have ~6+ months of real data.

## Day-to-day operations

After launch, here's how routine tasks work:

### Adding a new user
1. Go to Admin → Invitations → New invitation
2. Add their email + first/last name
3. They get an email with a link → click it → sign in with Google
4. They appear in your contacts as a "User" category

### Removing a user's access
1. Go to their contact → Edit
2. Set their auth_user_id link to none (delete from sidebar shortcut),
   OR just delete them (soft delete) which preserves their historical
   data but blocks future sign-ins
3. NOTE: this is one of the polish items — currently you'd do this in
   Supabase directly via the dashboard. Easy to add to the app later.

### Deploying changes
1. Edit code locally
2. Test locally with `npm run dev`
3. `git add .` → `git commit -m "what changed"` → `git push`
4. Vercel auto-deploys in 1–2 minutes
5. Verify the change at `crm.mocktrial.tech`

### Database changes
1. Write a new SQL migration file in `supabase/migrations/`
2. Test it against your dev Supabase project (paste in SQL Editor)
3. Run the same SQL against your production project
4. Commit the migration file to git so future deployments have it

### Backing up production data
Supabase auto-backups daily (7 days retention on free tier). To do a
manual backup any time: **Project Settings** → **Database** →
**Backups** → **Download backup**.

## Troubleshooting

### "Google hasn't verified this app" warning

Expected in Testing mode. Go through Step 8 to remove it.

### After signing in, redirected to wrong URL or 404

Supabase Site URL or Redirect URLs are wrong. Re-check Step 5d.
Site URL should be `https://crm.mocktrial.tech` and Redirect URLs should
include `https://crm.mocktrial.tech/**`.

### Vercel deploy fails

Check the deploy logs. Most common causes:
- Missing env var (the build step runs OK but app crashes at runtime)
- TypeScript errors that didn't show up locally because `lint` wasn't
  run. Run `npm run lint` locally to catch these.

### Vercel deploy works but app is broken

Open browser DevTools → Console. The error usually points at the cause:
- "Invalid API key" — wrong VITE_SUPABASE_ANON_KEY
- "Failed to fetch" — wrong VITE_SUPABASE_URL or Supabase RLS blocking
- Blank screen with no errors — could be the localStorage hang we hit
  in dev. Run the localStorage clear:
  ```js
  Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
  location.reload();
  ```

### DNS for crm.mocktrial.tech not resolving

Check `dig crm.mocktrial.tech` from your terminal. Should show
`cname.vercel-dns.com`. If not, the DNS record didn't save in
Squarespace. Re-check Step 5b.

### "Could not find the column..." errors

A migration didn't fully run on production. Compare the schemas
between your dev Supabase project (which works) and prod (which
doesn't). Re-run any missing migrations.

## What's next

This is the last setup guide. AMTA CRM is in production.

After AMTA's been using it for a few weeks, common follow-ups:

- **Restore UI** for the inevitable accidental delete
- **Custom SMTP** if invitation emails go to spam
- **Inline edit** for the records that still create-only
- **Reports / exports** — board members will want CSV downloads of
  contact lists, etc.
- **Migrate to crm.amta.org** when DNS access aligns

Tell me how the deployment goes, and which of those (or other things)
matter most for the next iteration.

🎉
