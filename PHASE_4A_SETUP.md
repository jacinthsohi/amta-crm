# Phase 4a Setup Guide — Layout Shell + Shared Infrastructure

Goal: get the new layout (sidebar + main content) running, with the dashboard
showing real database counts and the entity nav items going to "Coming soon"
pages. After this sub-phase you'll have the visual frame of the app in place,
and every subsequent sub-phase fills in one more entity.

This setup is **much shorter** than Phase 3 — no external service config,
just code drop and restart.

## What you'll do

1. Drop the new code in (preserving `.env`, `.git`, `node_modules`)
2. Confirm no new dependencies are needed (none for 4a)
3. Restart the dev server
4. See the new layout, with the sidebar and a stat-card dashboard

---

## Step 1 — Replace project files

The simplest path:

1. **Stop the dev server** if it's running (`Ctrl + C` in the terminal).
2. **Open a fresh terminal window** and `cd ~/Code/amta-crm`.
3. Move what we want to keep aside:
   ```
   mv .env /tmp/amta-env-backup
   mv .git /tmp/amta-git-backup
   mv node_modules /tmp/amta-nm-backup
   ```
4. Wipe the rest of the folder:
   ```
   ls -A | xargs rm -rf
   ```
5. Unzip the new project files into your Downloads (or wherever your browser
   saves files), then move everything (including hidden files) into
   `~/Code/amta-crm/`:
   ```
   cp -r ~/Downloads/amta-crm-app/. ~/Code/amta-crm/
   ```
   The `.` at the end of the source matters — it copies hidden files too.
6. Restore the saved files:
   ```
   mv /tmp/amta-env-backup .env
   mv /tmp/amta-git-backup .git
   mv /tmp/amta-nm-backup node_modules
   ```
7. Verify:
   ```
   ls -a
   ```
   You should see all the project files, including `.env`, `.git`,
   `.gitignore`, `node_modules`, the new `src/components` folder, the new
   `src/features/layout` folder, etc.

(If the move/wipe approach makes you nervous, a perfectly fine alternative
is to just delete `~/Code/amta-crm` entirely, recreate it, copy in the new
files, run `npm install` to recreate `node_modules`, and recreate `.env`
with your saved Supabase URL and anon key. Slightly slower but harder to
get wrong.)

## Step 2 — No new dependencies for 4a

Phase 4a doesn't add any new npm packages. The `package.json` is unchanged
from Phase 3. So you don't need to re-run `npm install` — your existing
`node_modules/` will work as-is.

(If you nuked `node_modules` in Step 1, you do need to run `npm install`
before continuing.)

## Step 3 — Run

```
npm run dev
```

The app should open and you should see:

- A **maroon-tinted sidebar** on the left with: brand at top, search box,
  nav items (Home, Contacts, Programs, Committees, Events, Projects,
  Interactions, Tasks), and your profile chip with a sign-out button at
  the bottom.
- A **dashboard** as the main content with: a personalized greeting using
  your first name, today's date, three stat cards (Contacts, Programs,
  Events) showing real counts from the database, and a "Phase 4a complete"
  badge.
- The **Home** nav item highlighted in maroon (since you're at `/`).

If you see this, **Phase 4a is done.** 🎉

### Try a few things

- **Click any other nav item** (Contacts, Events, etc.) — you'll see a
  "Coming soon" placeholder. The URL changes to e.g. `/contacts`. The
  sidebar highlight shifts to the active item.
- **Press `⌘K`** (or `Ctrl+K`) — a small placeholder modal appears that
  says "Search coming in 4f." Press Escape to dismiss.
- **Click the sign-out icon** in the profile area at the bottom of the
  sidebar — you should be sent back to `/login`. Sign back in.
- **Go to `/admin/invitations`** — the invitation page from Phase 3 is
  still wired up (just no link to it from the sidebar anymore — we'll
  add it under a future Settings menu).

## What's next

Phase 4b — Contacts. The biggest sub-phase, because it establishes all the
patterns (data hooks, list/detail pages, create/edit forms, inline sub-form
patterns for board terms / officer terms / committee assignments / program
affiliations) that everything else follows. Once 4b is in, the rest of
Phase 4 is mostly mechanical.

Ping me when you're seeing the new layout and I'll start writing 4b.

## Troubleshooting

### Page is blank or white
Open browser DevTools (Cmd+Option+I), look at the Console tab. The most
likely culprit is a missing import — this would be a bug on my side. Send
me the exact error text.

### "Cannot find module '@/...'"
Restart the dev server (`Ctrl+C` then `npm run dev` again). VS Code and
Vite occasionally lose track of the path alias on first load.

### Sidebar shows but the rest is blank
Means the layout rendered but the route content didn't. Try clicking
between two nav items — sometimes the very first render hits a routing
edge case that resolves on the second click.

### Dashboard shows "—" for the stat cards
The Supabase query failed silently. Open DevTools → Network tab, filter
for "supabase", click the failing request, look at the response body.
Send me what you see.

### Profile chip in the sidebar shows your email instead of your name
Means your `contacts.auth_user_id` linkage from Phase 3 didn't take.
Re-do Step B.3 from `PHASE_3_SETUP.md` and refresh.
