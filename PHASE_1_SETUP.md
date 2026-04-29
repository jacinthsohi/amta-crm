# Phase 1 Setup Guide — Database

This guide walks you through creating a Supabase project and running the
migrations that set up the AMTA CRM database.

You only need to do this once. After this phase you'll have a real Postgres
database in the cloud, ready for the app to connect to.

## What you'll do in this phase

1. Create a free Supabase account
2. Create a new Supabase project
3. Run three SQL migration files against it
4. Verify the tables were created
5. Save the project credentials for later phases

---

## Step 1 — Create a Supabase account

1. Go to [https://supabase.com](https://supabase.com).
2. Click **Start your project** in the top right.
3. Sign in with GitHub (recommended — it's the fastest), or with email.

The free tier is more than enough for AMTA's needs. No credit card required.

## Step 2 — Create a new Supabase project

Once signed in, you'll see a dashboard.

1. Click **New project**.
2. If prompted, pick or create an organization. The default one is fine; you
   can name it "AMTA" or similar.
3. Fill in the project form:
   - **Name:** `amta-crm` (or whatever you prefer)
   - **Database password:** click **Generate a password** and **save it
     somewhere safe** (a password manager is ideal). You'll likely never need
     to type it manually but you don't want to lose it.
   - **Region:** pick the one closest to where most of your admins are.
     `East US (North Virginia)` is a safe default.
   - **Pricing plan:** Free tier.
4. Click **Create new project**. Provisioning takes ~2 minutes. You'll see a
   loading screen; wait for it to finish before moving on.

## Step 3 — Save your project credentials

While the project is provisioning, take note of where these will live:

- **Project URL** — looks like `https://xxxxxxxxxxxxxxxx.supabase.co`. Find it
  later under **Project Settings → API → Project URL**.
- **Anon (public) key** — a long string starting with `eyJ...`. Find it under
  **Project Settings → API → Project API keys → `anon` `public`**.
- **Service role key** — a different long `eyJ...` string under the same page.
  **Treat this one like a password** — never share it, never commit it to
  code. You'll only need it for backend tasks, and we won't use it in the
  frontend at all.

I'll ask you to paste the URL and the anon key into your app's config file in
Phase 2. Don't paste them anywhere yet — just know where to find them.

## Step 4 — Run the migrations

The migrations are three SQL files in the `supabase/migrations` folder of the
codebase I'll be giving you. They create every table, every index, every
constraint, the soft-delete and restore helpers, and the row-level security
policies.

There are two ways to run them. I recommend **Option A** (the SQL Editor) for
this phase because you don't yet have a local dev environment set up.

### Option A — Paste them into the Supabase SQL Editor (recommended for now)

1. In your Supabase project dashboard, click the **SQL Editor** icon in the
   left sidebar (looks like a database with a play button).
2. Click **New query**.
3. Open the first migration file:
   `supabase/migrations/20260427000001_initial_schema.sql`
4. Copy its entire contents into the SQL Editor.
5. Click **Run** (or press Cmd/Ctrl + Enter).
6. Wait for it to finish. You should see "Success. No rows returned." or
   similar at the bottom. If you see an error, **stop and let me know what
   it says** — better to fix early than to half-create the schema.
7. Repeat with the second migration file:
   `20260427000002_rls_and_views.sql`
8. Repeat with the third:
   `20260427000003_soft_delete_helpers.sql`

### Option B — Use the Supabase CLI (more powerful, comes later)

Once you have a local dev environment in Phase 2, you'll be able to run
`supabase db push` to apply migrations from the command line. But for now,
Option A is enough.

## Step 5 — Verify the tables were created

In the Supabase dashboard:

1. Click the **Table Editor** icon in the left sidebar.
2. You should see ~20 tables listed (contacts, programs, committees, events,
   tasks, interactions, board_terms, etc.).
3. Click into `contact_categories` — you should see six rows already (Alumni,
   Donor, Judge, Coach, Current Board Member, Past Board Member). Those were
   seeded by the first migration.

If you see all the tables, **Phase 1 is done.** 🎉

## Troubleshooting

### "extension uuid-ossp does not exist"
Old Supabase projects don't have this extension enabled by default. Click
**Database → Extensions** in the sidebar, search for `uuid-ossp`, click the
toggle to enable it, then re-run migration 1.

### "permission denied for schema auth"
You're running as the wrong role. The SQL Editor uses the postgres superuser
by default, so this shouldn't happen — but if it does, paste a fresh copy of
the migration into a new query window and try again.

### "relation already exists"
You ran a migration twice. That's mostly fine for development — the database
just refuses to recreate things that already exist. To start fresh, see the
"Reset" section below.

### Reset (start over)
If you mess something up and want to wipe everything:
1. **Project Settings → General → Pause project → Restore from backup → Reset
   database** (this deletes ALL data — only do this in early development!),
   OR
2. In the SQL Editor, run `drop schema public cascade; create schema public;
   grant all on schema public to postgres, anon, authenticated, service_role;`
   then re-run all three migrations.

## What's next

When Phase 1 is done, ping me and I'll start Phase 2 — the Vite + React + TypeScript
project skeleton. That phase will give you a runnable app shell that connects
to the database you just created.
