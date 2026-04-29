# Phase 3 Setup Guide — Auth + Data Layer

Goal: by the end of this phase, you'll be able to sign in to the app and see
real data flowing from your Supabase database.

This phase has the most setup steps of any phase because of Google OAuth
configuration. Take your time with the Google Cloud part — most issues at
this stage are typos in URLs.

## What you'll do in this phase

1. Drop the new code into your project
2. Run `npm install` to add the new dependencies
3. Configure Google OAuth (Google Cloud Console + Supabase dashboard)
4. Create a test contact row in your database
5. Run the app, sign up via the invitation flow, and verify you land on the
   stub home page
6. Optionally test the "invite someone" admin flow

---

## Step 1 — Replace the project files

The Phase 3 zip contains an updated full project. The simplest path:

1. **Back up your current `.env` file** somewhere safe (you'll need to restore
   it). The new project files include a fresh `.env.example` but no `.env`.
2. **Delete the contents** of your `~/Code/amta-crm/` folder, EXCEPT for:
   - The `.git` folder (preserves your git history)
   - The `node_modules` folder (saves you re-downloading 200MB)
   - Your `.env` file (your Supabase credentials — don't lose these)

   In Terminal:
   ```
   cd ~/Code/amta-crm
   # Move .env, .git, and node_modules out of the way
   mv .env /tmp/amta-env-backup
   mv .git /tmp/amta-git-backup
   mv node_modules /tmp/amta-nm-backup
   # Wipe everything else
   rm -rf * .[!.]*
   # Restore the saved files
   mv /tmp/amta-env-backup .env
   mv /tmp/amta-git-backup .git
   mv /tmp/amta-nm-backup node_modules
   ```
3. **Unzip the new project files** and copy them in. (If you got individual
   files instead of a zip, copy them all.)

If that feels error-prone, the lazier alternative is to just nuke
`~/Code/amta-crm` entirely and start fresh — you'd just need to re-paste your
Supabase URL and anon key into a new `.env`.

## Step 2 — Install new dependencies

```
cd ~/Code/amta-crm
npm install
```

The new packages this adds: `react-router-dom`, `@tanstack/react-query`,
`@tanstack/react-query-devtools`, plus a slightly newer `lucide-react`.

## Step 3 — Configure Google OAuth

This is the most fiddly part. You're connecting three things: a Google Cloud
project (which controls who can sign in via Google), your Supabase project
(which acts as the bridge), and your local app (which talks to Supabase).

### 3a. Create a Google Cloud project

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/).
2. Sign in with whatever Google account you want to use to manage this OAuth
   integration (this can be your personal Google account; it doesn't have to
   be an AMTA account).
3. At the very top of the page, click the project dropdown (next to "Google
   Cloud" branding) and click **New Project**.
4. Name it something like `amta-crm-auth`. Leave the organization dropdown
   on "No organization" if you don't have one. Click **Create**.
5. Wait for the project to provision (~30 seconds), then make sure it's
   selected in the project dropdown.

### 3b. Configure the OAuth consent screen

The "consent screen" is the page Google shows users when they're being asked
to log in to your app. We need to tell Google what to put on it.

1. In the left sidebar, click **APIs & Services → OAuth consent screen**.
2. Pick **External** as the user type. (This means "any Google account can
   sign in" — for AMTA we want this so your full board can use any of their
   own Google accounts. The "Internal" option only works if you have a
   Google Workspace org, which AMTA might not.)
3. Click **Create**.
4. Fill in the App information form:
   - **App name:** `AMTA CRM`
   - **User support email:** your email
   - **App logo:** optional, skip for now
   - **App domain section:** all optional, can skip for development
   - **Authorized domains:** leave empty for now (we're on localhost)
   - **Developer contact information:** your email
5. Click **Save and continue**.
6. **Scopes** screen: click **Save and continue** without adding any scopes.
   Supabase will ask for the basic ones it needs automatically.
7. **Test users** screen: click **Add users** and add the email addresses of
   anyone you want to be able to sign in *during development*. While the app
   is in "Testing" mode, only listed test users can sign in via Google.
   Add your own email here at minimum. Click **Save and continue**.
8. Review and click **Back to dashboard**.

You're now in "Testing" status, which is fine for development. To go fully
public ("Production" status), Google requires logo files and privacy policy
URLs, which we'll handle later when you're ready to deploy.

### 3c. Create OAuth credentials

1. In the left sidebar: **APIs & Services → Credentials**.
2. Click **+ Create credentials** at the top, then **OAuth client ID**.
3. **Application type:** Web application.
4. **Name:** `AMTA CRM web client` (or whatever).
5. **Authorized JavaScript origins:** click **Add URI** and add:
   - `http://localhost:5173`
6. **Authorized redirect URIs:** this is the most important field. Click
   **Add URI** and add the URL Supabase expects:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
   
   Replace `<your-project-ref>` with the random string in your Supabase
   project's URL. For example if your Supabase URL is
   `https://abcdefghij.supabase.co`, the redirect URI is
   `https://abcdefghij.supabase.co/auth/v1/callback`.
7. Click **Create**.
8. A modal pops up showing your **Client ID** and **Client Secret**. Copy
   both somewhere safe — you'll paste them into Supabase next. The Client
   Secret is sensitive; treat it like a password.

### 3d. Tell Supabase about Google

1. In your Supabase dashboard, click **Authentication → Providers** in the
   sidebar.
2. Scroll to **Google** and click it to expand.
3. Toggle **Enable Sign in with Google** to ON.
4. Paste the **Client ID** from Google Cloud into the **Client ID** field.
5. Paste the **Client Secret** into the **Client Secret** field.
6. Leave the **Authorized Client IDs** field empty.
7. Click **Save**.

That's the OAuth wiring done.

### 3e. Set the redirect URLs in Supabase

While you're in Supabase auth settings:

1. Click **Authentication → URL Configuration** in the sidebar.
2. **Site URL:** set to `http://localhost:5173` for now. (We'll change this to
   your production URL when we deploy.)
3. **Redirect URLs:** add the following entries (one per line):
   - `http://localhost:5173`
   - `http://localhost:5173/`
   - `http://localhost:5173/accept-invitation/finish`
4. Click **Save**.

This whitelists where Supabase Auth is allowed to redirect users back to
after sign-in. Without these entries, Supabase rejects the redirect for
security reasons.

## Step 4 — Add a test contact row

Your `contacts` table is empty, which means there's nobody to invite. Let's
seed a row for yourself.

1. In Supabase, go to **Table Editor → contacts**.
2. Click **Insert → Insert row**.
3. Fill in:
   - **first_name:** Your first name
   - **last_name:** Your last name
   - **email:** Your email (the one you'll log in with)
   - Leave everything else as default
4. Click **Save**.

Note: do NOT set `auth_user_id`. It will get filled in automatically when
you accept the invitation in Step 6.

## Step 5 — Run the app and create an invitation

```
cd ~/Code/amta-crm
npm run dev
```

Your browser should open to `http://localhost:5173`. Since you're not signed
in, you should be redirected to `/login`.

But wait — to test the invitation flow, you need to be signed in first to
generate one. Chicken-and-egg. So we'll do this in two parts:

### Part A — first-time sign-in via Supabase's "magic link"

Easiest path: temporarily create your auth user directly in Supabase.

1. In Supabase, go to **Authentication → Users**.
2. Click **Add user → Send invitation** (or **Add user → Create new user**).
3. Enter your email (the same one you used in `contacts`).
4. Click **Send invitation** — Supabase will email you a link. Click it.
5. The link will take you to your app at `http://localhost:5173`. You should
   see an amber warning saying "No contact record is linked to this auth
   account" — that's expected, because we haven't linked your auth user to
   your contact yet.

### Part B — link your auth user to your contact

You need to update the `contacts` row to point at your new auth user.

1. In Supabase, go to **Authentication → Users**, find yourself, and copy
   your user UUID (the `id` field — looks like
   `8a7b6c5d-1234-5678-90ab-cdef12345678`).
2. Go to **Table Editor → contacts**, find your row, and edit
   **`auth_user_id`** to that UUID.
3. Save the row.
4. **Refresh your app's browser tab.** The amber warning should be gone, and
   you should now see "You're signed in, [Your First Name]." with the count
   of contact categories.

🎉 **If you see your name and the category count, Phase 3 is done.**

### Part C (optional) — test the invitation flow with a second user

Now that you can sign in, try the invitation flow:

1. From the app's home page, click **Invite a user** in the top right.
2. You'll see the dropdown is empty (no other contacts have an email).
3. Add another contact in **Supabase → Table Editor → contacts** with a
   different email (e.g., a personal address you have access to).
4. Refresh the invitations page in the app — they should appear in the
   dropdown.
5. Pick them and click **Generate invitation link**.
6. Copy the link, open it in an incognito browser window.
7. The accept-invitation page should show their first name. You can either
   set a password or click "Continue with Google" (which only works if their
   email matches a Google account *and* they're added as a test user in
   Step 3b).

## Troubleshooting

### "redirect_uri_mismatch" from Google
Your **Authorized redirect URIs** in Google Cloud doesn't match what
Supabase actually used. Look at the error message — it'll show the exact URI
Google was expecting. Make sure that URI is in the list in Step 3c, then
wait a few minutes (Google's caching can be slow) and try again.

### "Invalid login credentials" on email/password
You're trying to sign in with a password, but you used the magic-link flow
in Part A which doesn't set a password. Fix: in Supabase **Authentication →
Users**, click your user, then **... → Send password recovery**. The email
you receive lets you set a password. Or, just keep using the magic link.

### App keeps showing "Loading…" forever
The auth provider is stuck. Open browser DevTools → Console. If you see
something about a missing env var, your `.env` got lost — re-create it.
If you see network errors to your Supabase URL, double-check the URL in
your `.env`.

### Google sign-in works but app shows "No contact record is linked"
You signed in successfully but your `contacts.auth_user_id` is NULL. Either:
- Update the `contacts` row manually as in Part B, OR
- Sign out, then accept an invitation properly via the invite flow

### "Supabase" or "react-router-dom" import errors after running `npm install`
Sometimes VS Code caches the old type information. Quit VS Code completely
and reopen it. If errors persist, try `npm install` again.

## What's next

Once you can sign in and see the "Phase 3 complete" badge with your name and
the category count, ping me and I'll start Phase 4 — porting the actual app
features (contacts, programs, committees, events, projects, tasks,
interactions, dashboard, search) from the prototype to use the new data
layer. That's the biggest phase by volume but conceptually straightforward
since we already designed everything in the artifact.
