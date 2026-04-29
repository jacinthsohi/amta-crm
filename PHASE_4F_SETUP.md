# Phase 4f Setup Guide — Dashboard and Global Search

Goal: the dashboard becomes a real landing page (instead of a placeholder
with three counts), and Cmd+K opens a search palette that jumps you to
any contact/program/committee/event/project/task/interaction in the app.

This is the **last sub-phase of Phase 4**. After this, all of Phase 4 is
done and the CRM is feature-complete. Phase 5 just adds a rich-text
editor; Phase 6 deploys it.

No SQL changes, no new dependencies — just code.

## What you'll do

1. Drop in the new code
2. Restart the dev server
3. Verify dashboard and Cmd+K search work

---

## Step 1 — Replace project files

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

Paste credentials, save.

```
npm install
npm run dev
```

Clear localStorage if it hangs:

```js
Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
location.reload();
```

## Step 2 — No database changes

## Step 3 — Verify the dashboard

Sign in. The home page (click **Home** in the sidebar) should now show:

### Greeting + date

A time-of-day-aware greeting at the top: "Good morning, Jacinth" or
"Good afternoon, Jacinth" depending on what time you sign in. Today's
full date below it.

### Stats strip (4 clickable cards)

A row of 4 cards across the top showing:
- **Contacts** — total contact count
- **Current board** — count of contacts categorized as "Current Board Member"
- **Active projects** — count of projects with status=active
- **Upcoming events** — count of events with status=upcoming

**Click any of them** — should navigate to the corresponding list page.
A small arrow icon on the right of each card hints at this.

### Two-column card grid

Below the stats, four cards in a 2x2 grid:

1. **My tasks** — your top 5 open tasks (status: todo / in progress /
   blocked, assigned to you), sorted with overdue ones first, then by
   due date.
   - If you have no tasks, shows a friendly empty state
   - Each task is clickable — navigates to the parent project (or task
     list if no project)
   - Overdue tasks have **red** due-date text saying "Overdue [date]"
   - High priority tasks show a "High" warn-tone tag

2. **Upcoming events** — next 4 events with start_date >= today and
   status != cancelled, sorted by start date.
   - Each event has its gradient banner thumbnail
   - Click any → event detail page

3. **Active projects** — your active/planning projects. Falls back to
   org-wide if you don't own any.
   - Sorted by target completion date
   - Click any → project detail page

4. **Recent interactions** — last 5 interactions across the whole org,
   sorted newest first.
   - Shows participant avatar stack on the right
   - Click any → interaction detail page

### Empty states

If you have zero data of any type, the corresponding card shows a
friendly message like "Nothing on your plate. Nicely done." with a CTA
to go to that section.

## Step 4 — Verify global search

Press **Cmd+K** (or **Ctrl+K** on Windows/Linux) anywhere in the app.

A search modal should appear, centered, with a backdrop blur.

### Without typing

The empty state shows a sample of recent items grouped by entity type:
**Contacts**, **Programs**, **Committees**, **Events**, **Projects**,
**Tasks**, **Interactions**. Up to 3 of each, with their type label as a
header above each group.

### Typing a query

Try typing a query — say **"yale"** or **"jacinth"** or part of any
real entity name.

Results filter live as you type. Now they're shown as a flat ranked
list (not grouped) with the entity type label on the right side of
each row to disambiguate.

**Ranking** is:
1. Items whose label *starts with* your query come first
2. Then whole-word matches in the label
3. Then substring matches in the label
4. Then matches anywhere in associated text (descriptions, emails, etc)

### Keyboard navigation

- **Arrow ↑/↓** — moves the highlighted result
- **Enter** — jumps to the highlighted result's detail page (modal closes)
- **Esc** — closes the modal
- **Mouse hover** — also highlights, like keyboard
- **Click** — also jumps

The active row is highlighted in **maroon-50** background with maroon-700
text. The footer shows a small counter ("12 results") and keyboard hints.

### Things to test

1. Type a contact's name → press Enter → land on their contact page
2. Type a partial program name → arrow down to the right one → Enter
3. Type something nonsense → "No matches" empty state
4. Open search, type, hit Esc → modal closes without navigating
5. Search for a task by its title → Enter takes you to the parent
   project (since tasks don't have their own detail route)

If all of that works, **Phase 4f is done.** 🎉

**That's the end of Phase 4.** All seven entities exist, the dashboard
is real, search is wired. Functionally the CRM is feature-complete.

## Things still pending (expected)

- **Tiptap rich text** — descriptions, notes, content fields are still
  plain text. Phase 5 swaps them for a real editor.
- **Production deploy** — the app runs on `localhost:5173`. Phase 6
  deploys to Vercel + a real production Supabase setup with proper
  OAuth.
- **Inline edit on legacy inline records** — board terms, officer
  terms, committee assignments, etc. are still create-only. Click
  navigates. We'll polish this later.

## Troubleshooting

### Cmd+K doesn't open the modal
Make sure you're on a page that uses AppLayout (any authenticated
page). The shortcut is wired at the layout level. If you're on
/login it won't work.

### Search shows "Loading..." indefinitely
The palette uses TanStack Query which fetches all entities. If queries
are stuck in pending, check Network tab. Hard refresh usually fixes it.

### Stats show 0 when you have data
The dashboard relies on the `useContacts`, `useEvents`, etc. hooks. If
they're erroring, the dashboard renders zeros. Open DevTools Console
and look for red errors.

### "My tasks" shows other people's tasks
Means the auth contact link isn't set up correctly (your auth user
doesn't have a matching contact row with auth_user_id set). The
dashboard falls back to showing everyone's tasks in that case.

### Dashboard scrolls but the cards don't fit
Browser zoom level might be too high. Cmd+0 to reset zoom.

## What's next

**Phase 5 — Tiptap rich-text editor.** We swap the plain `<textarea>`
elements in description/notes/content fields for a proper editor with
bold/italic/links/lists. Format-preserving HTML in the database.

Then **Phase 6 — Deploy.** Vercel + Supabase production project +
real Google OAuth verification. The CRM goes live.

Tell me when 4f is working and we move on.
