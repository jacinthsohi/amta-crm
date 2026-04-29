# Phase 4b-i Setup Guide — Contacts (read-only)

Goal: see all 24 seeded contacts in a real list, click into any one of them,
view their full history (officer terms, board terms, committee assignments,
program affiliations).

This sub-phase is **read-only**. Editing, creating, deleting, and the inline
"Add board term" / "Add officer term" / etc. forms ship in 4b-ii.

## What you'll do

1. Drop in the new code
2. Run the new SQL seed migration in Supabase
3. Restart the dev server
4. Verify you can see and navigate the contacts list

---

## Step 1 — Replace project files

In your terminal, in `~/Code/amta-crm`:

```
# Stop the dev server first if it's running (Ctrl+C in its terminal)
mv .env /tmp/amta-env-backup
mv .git /tmp/amta-git-backup
mv node_modules /tmp/amta-nm-backup
ls -A | xargs rm -rf
cp -r ~/Downloads/amta-crm-app/. ~/Code/amta-crm/
mv /tmp/amta-env-backup .env
mv /tmp/amta-git-backup .git
mv /tmp/amta-nm-backup node_modules
```

(If that move/wipe approach makes you nervous, just nuke `~/Code/amta-crm`
entirely and recreate it, the same way as Phase 4a. You'll re-run
`npm install` and re-paste the `.env` values, but it's harder to mess up.)

## Step 2 — Run the new seed migration

This is the only Supabase step. It loads all 24 contacts plus their
relationships into your database.

1. Open your Supabase dashboard.
2. Go to **SQL Editor** → click the **+** at the top to open a fresh
   editor tab. (Reusing the same tab as a previous migration will append
   the queries, just like in Phase 1 — fresh tab is the safe move.)
3. Open `supabase/migrations/20260427000004_seed_data.sql` in VS Code.
4. Copy its entire contents and paste into the Supabase SQL Editor.
5. Click **Run**.

You should see "Success. No rows returned" or similar at the bottom. If you
see errors, paste them to me — most likely cause would be a typo I
introduced.

### Verify the seed worked

In Supabase **Table Editor**:
- `contacts` should now have ~24 rows (yours, plus the 24 seeded ones)
- `programs` should have 8 rows
- `committees` should have 10 rows (7 top-level + 3 subcommittees)
- `board_terms`, `officer_terms`, `committee_assignments`,
  `program_affiliations`, `contact_category_assignments` should all have
  rows

Click into `contacts` and confirm you see names like Jacinth Sohi, Justin
Bernstein, DeLois Leapheart, etc. The seed is **idempotent** — running it
again won't duplicate, but won't add new things either.

### A note on duplicate Jacinth

The seed inserts a contact for "Jacinth Sohi" with email
`jacinth.sohi@example.org`. You also have your own "Jacinth Sohi" contact
from Phase 3 with whatever email you actually used to sign in. **These
are two separate rows.** Your real one is the one with `auth_user_id`
set; the seeded one is a development fixture. You can leave both in for
now — your auth correctly links to your real one, and we can clean it up
later by either soft-deleting the seeded version or merging them.

## Step 3 — No new dependencies

Phase 4b-i doesn't add new npm packages. Skip `npm install` if your
`node_modules/` survived the file swap.

## Step 4 — Run the dev server

```
npm run dev
```

The browser should open. Sign in if you're not already.

If you get the same Phase 3 "Loading…" hang, run this in the browser
DevTools console once and reload:

```js
Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
location.reload();
```

(This is the stale-localStorage issue we hit in 4a — same fix.)

## Step 5 — Verify

Click **Contacts** in the sidebar. You should see:

- A header with "Contacts" title, subtitle, and a **New contact** button
  (clicking it shows an alert that creation ships in 4b-ii — that's
  expected)
- A search box and 6 filter pills: All / Current Board / Alumni / Donors
  / Judges / Coaches
- A **table with all 24+ seeded contacts**, plus your own contact
- Each row shows: avatar with initials, name, email, category chips,
  primary affiliation (e.g. Yale, Stanford), and a status indicator

Try a few things:

- **Type "ber" in the search** — should filter to "Caroline Berube" and
  "Justin Bernstein"
- **Click "Current Board"** — should filter to ~20 contacts who are
  current board members
- **Click "Alumni"** — should show ~5 contacts categorized as alumni
- **Click any contact row** — opens the detail page

On the detail page you should see:

- A breadcrumb at the top (Contacts › [Name])
- A hero with avatar, name, status tags, email/phone, and category chips
- An **Edit** button (clicking shows an alert — editing ships in 4b-ii)
- Notes section (if the contact has notes)
- Four sections in the main column: Officer Terms, Board Terms, Committee
  Assignments, Program Affiliations
- A right sidebar with "At a glance" counts
- Click any **committee row** in Committee Assignments → goes to the
  committee detail (currently a Coming Soon placeholder for Phase 4c)
- Click any **program row** in Program Affiliations → similar

If all of this works, **Phase 4b-i is done.** 🎉

## Troubleshooting

### Contacts list is empty
Did the seed migration run? Check `contacts` in Table Editor.

### "Could not load this data" / network errors on the list
Open browser DevTools → Network tab, reload, look for red rows. Most
likely a Supabase connectivity issue — see if your project is paused.

### Contacts list shows but no avatar initials
Means the `first_name` / `last_name` columns are empty. Check the seed —
those should be populated. Most likely cause is the seed didn't run
fully.

### Empty or "—" affiliation column
Means `program_affiliations` table is empty. Did the seed migration
finish without errors? You can re-run it; it's idempotent.

### Contact detail page says "(deleted committee)" or "(deleted program)"
Something's referencing a row that doesn't exist. If you didn't manually
delete anything, this is a bug — let me know and I'll diagnose.

### TypeScript errors in VS Code about missing exports
Restart TypeScript: in VS Code, Cmd+Shift+P → "TypeScript: Restart TS
Server". Or just close and reopen VS Code.

## What's next

Phase 4b-ii — make the contacts pages writable. ContactForm (with
multi-tag categories), the four inline forms (BoardTermForm,
OfficerTermForm, CommitteeAssignmentForm, ProgramAffiliationForm), and
soft-delete UX.

Ping me when 4b-i is working and I'll write 4b-ii.
