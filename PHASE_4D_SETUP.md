# Phase 4d Setup Guide — Events

Goal: events join contacts, programs, and committees as a fully working
entity. Tournaments and board meetings can be created, edited, and
deleted; you can manage their host programs, staff, and document links;
and the cross-entity wiring lights up so programs show their hosted
events and contacts show what they're staffing.

This is the largest entity by sub-record count, but the setup is small
— no database changes, no new dependencies.

## What you'll do

1. Drop in the new code
2. Restart the dev server
3. Verify event flows work

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

Paste your Supabase URL and anon key into `.env`, save.

```
npm install
npm run dev
```

If you hit the loading hang, paste this in DevTools console:

```js
Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
location.reload();
```

## Step 2 — No database changes

Phase 4d doesn't touch Supabase. No SQL to run, no new schema.

## Step 3 — Verify

Sign in. The events sidebar item now lights up when you click it.

### Events list

Click **Events** in the sidebar. You should see:

- "Events" header with a "New event" button
- A search box and two filter rows: type (All / Tournaments / Board
  meetings) and status (All / Upcoming / In progress / Completed)
- An empty state message because we don't have any events seeded yet

The seed file from Phase 4b-i didn't populate events — we left that
blank deliberately so you can create real ones. Let's make some.

### Create your first event

1. Click **New event**
2. The form panel slides in
3. Fill in:
   - **Name**: "2026 Yale Invitational"
   - **Event type**: Tournament (already selected)
   - **Tournament type**: Invitational (auto-shown because you picked
     tournament — try toggling to Board meeting and watch this field
     disappear)
   - **Start date**: pick any date
   - **End date**: pick a date a couple days later (or leave blank for
     a one-day event)
   - **Location city**: New Haven
   - **State**: CT
   - **Status**: Upcoming
   - **Primary host**: pick yourself or any contact
   - **Banner gradient**: try clicking the different swatches — the
     preview at the top updates. Pick "Heritage" (purple) or whatever
     looks right
   - Add a description if you like
4. Click **Create event** (or Cmd+Enter)
5. Panel closes. You auto-navigate to the new event's detail page.

### The detail page

You should see:

- **A purple gradient banner stripe** at the top (or whichever you
  picked)
- Below that, the event name, type/tournament type tag, status tag
- Date range, location, primary host (clickable, goes to that contact)
- Three sections:
  - **Host programs** (only for tournaments — board meetings hide
    this section)
  - **Staff**
  - **Documents** (will appear once you add some)
- Plus a placeholder for "Related interactions" (until 4e)

### Add a host program

1. In the **Host programs** section, click **Add host**
2. The form opens. Pick "Yale University" (or whoever you set up) from
   the dropdown
3. Role is pre-filled with "Host" — leave it or change it
4. Click **Add host**
5. The program appears in the section. Click it → navigates to the
   program detail page

### Verify the cross-wiring

While you're on Yale's program detail page (after clicking the host
above):

1. Scroll down to the **Hosted events** section
2. Your new "2026 Yale Invitational" should appear there
3. Click it → goes back to the event detail

Cross-entity navigation works in both directions now.

### Add staff

1. Back on the event detail, click **Add staff** in the Staff section
2. Pick a contact, enter a position like "Tournament Director"
3. Click **Add staff**
4. The staff entry appears. Click them → goes to their contact detail
5. On their contact detail page, scroll to the **Events** section —
   your event shows up there with its gradient banner

### Add a document

1. Click **Add document** in the Documents section
2. Pick a type (Welcome packet)
3. Title: "Welcome packet draft"
4. URL: paste any real URL — e.g. `https://example.com`
5. Click **Add document**
6. The document link appears, grouped by type. Click it → opens in a
   new tab

### Edit + delete

1. Click **Edit** on the event hero
2. Change the description, change the banner gradient, change the
   status to "In progress"
3. Save → the changes reflect immediately
4. Click **Edit** again, click the red **Delete** button in the form
   footer, confirm
5. The event vanishes from the list

If all of this works, **Phase 4d is done.** 🎉

## Things still pending (expected)

- **Related interactions** on event detail → comes in Phase 4e
- **Inline editing** of host/staff/document records — you can add and
  delete (via the soft-delete RPC manually for now), but click-to-edit
  on existing rows is on the polish list
- **Real file uploads** — documents are URL-only. Supabase Storage
  uploads come later

## Troubleshooting

### "Add host" picker shows no programs
Programs query failed. Refresh the page; if it persists, check the
Network tab.

### "Add staff" picker shows no contacts
Same — contacts query needs to load first. Refresh.

### Deleted event still shows on a program's "Hosted events"
Cache invalidation glitch. Hard refresh (Cmd+Shift+R). If reproducible,
let me know and we'll fix.

### Form hangs on "Saving..."
Same stale-localStorage issue we keep hitting. Run the localStorage
clear in DevTools and reload, then try again.

## What's next

Phase 4e: Projects, Tasks, and Interactions. Three more entities, all
connected to events / committees / contacts in various ways. Then 4f
wraps Phase 4 with the dashboard and global search.

Ping me when 4d is working.
