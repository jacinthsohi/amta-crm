# Phase 4e Setup Guide — Projects, Tasks, and Interactions

Goal: the last three entities ship together. Your CRM goes from "manage
people, programs, committees, and events" to "track everything the board
is working on, who's responsible, and what's been said about it." The
polymorphic interactions are what make this a real CRM rather than a
contact database.

This is the largest phase yet by file count, but no SQL changes — the
schema's been ready since Phase 1.

## What you'll do

1. Drop in the new code
2. Restart the dev server
3. Verify all three entities work end to end

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

Paste your Supabase URL and anon key, save.

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

Phase 4e doesn't touch Supabase. The `projects`, `tasks`, `interactions`,
`interaction_participants`, and `interaction_links` tables have been
sitting there ready since Phase 1.

## Step 3 — Verify the three new entities

Sign in. Three new sidebar items now light up: **Projects**, **Tasks**,
**Interactions**.

### Projects

Click **Projects**. You'll see an empty list (we didn't seed projects).
Let's create one.

1. Click **New project**
2. Fill in:
   - **Name**: "Develop new Code of Ethics"
   - **Description**: anything
   - **Status**: Active, Priority: High
   - **Owner**: pick yourself
   - **Committee**: pick "Rules, IP & Ethics Committee" (or any)
   - Skip the event link
3. Click **Create project** → auto-navigates to the project's detail
   page

On the project detail page you'll see:

- Hero with name, status, owner, committee link
- Empty **Tasks** section with an "Add task" button
- Empty **Related interactions** section

Click the committee link in the hero → goes to committee detail. There's
now a **Projects** section showing this project. The cross-wiring works.

### Tasks

Back on the project, click **Add task**:

1. Title: "Draft policy document"
2. Status: To do, Priority: High
3. Project: pre-filled to current project
4. Assigned to: yourself
5. Due date: pick a date next week
6. **Create task**

Task appears in the Tasks section. Click it again → reopens the form
in edit mode (this is the click-to-edit affordance — only tasks have it
in 4e, the other inline records still ship without edit).

Now go to **Tasks** in the sidebar. You should see:

- Filter pills: **Mine** / Everyone, plus status filters (All / To do /
  In progress / Blocked / Done)
- "Mine" is the default — your task appears
- Click "Everyone" → would show all tasks if more existed

Click the task row → edit form opens. Try changing status to "Done" →
save. The task now shows with a strikethrough on every page that
references it.

### Interactions

Click **Interactions** in the sidebar. Empty list, "Log interaction"
button.

1. Click **Log interaction**
2. Type: Meeting, Subject: "Sync re: ethics policy timeline"
3. Date/time: now (pre-filled)
4. Direction: Internal
5. Participants: pick yourself + one other contact
6. Notes: write a few sentences
7. **Links** section at the bottom:
   - Add the project you just created
   - Add the committee you linked the project to
8. Click **Log it** → auto-navigates to the interaction detail

On the detail page you'll see:

- Hero with type icon, subject, type/direction tags, date+time
- Participants list (clickable to contact details)
- Notes
- Links section grouped by entity type — your project and committee
  appear

### Verify cross-wiring

This is the big one — every place an interaction was linked, it should
appear:

1. Go to the project detail page → "Related interactions" section now
   shows your interaction. Click it → back to interaction detail
2. Go to the committee detail page → "Related interactions" section
   shows it
3. Go to your contact detail page → "Recent interactions" section
   shows it (and any other contact who was a participant gets it on
   theirs too)

Also check tasks and interactions on contacts:

1. Contact detail → "Tasks assigned" section shows the task you
   assigned to yourself. Click it → reopens task form.
2. Contact detail → "Recent interactions" shows the interaction.

### Edit/delete flows

For each entity, try:

- **Edit** on the hero → form opens pre-filled → change something →
  Save
- **Edit** in the form → click red **Delete** button in footer →
  confirm → soft-deletes and routes back to the list
- All three entities support this — Projects, Tasks (via the task
  form's Delete), Interactions

If all of the above works, **Phase 4e is done.** 🎉

You now have all 7 core entities shipping. The remaining work in
Phase 4 is dashboard + global search (4f).

## Things still pending (expected)

- **Dashboard** — currently a placeholder. 4f wraps Phase 4 with
  real stats and recent activity.
- **Global search** (Cmd+K) — same, ships in 4f.
- **Inline edit** on the older inline records (board terms, officer
  terms, committee assignments, program affiliations, event hosts/
  staff/documents) — these are still create-only. Click navigates to
  the linked entity. We'll add edit-existing in a polish pass.

## Troubleshooting

### Empty pickers in InteractionForm
The pickers (events, committees, programs, projects, contacts) all
load via separate queries. Refresh the page if any are empty.

### "Saving..." hang on interaction save
Most likely the multi-link reconciliation hit a constraint issue. Open
DevTools Network tab and look at the failing request — paste me the
response and I'll diagnose.

### Task in "Mine" filter doesn't show up
The "Mine" filter compares `assigned_to_contact_id` to your auth
contact's id. If your auth contact isn't fully linked, click
"Everyone" to see all tasks instead.

### "Log interaction" form has no "Date/time" field that works
The field uses `type="datetime-local"` which is supported by all modern
browsers but may render differently. If it doesn't accept input, hard
refresh.

### Cross-entity invalidation glitch
After creating an interaction with links, sometimes the linked entity
pages don't immediately show it. Hard refresh works. If reproducible,
let me know — the invalidation logic is broad but might miss an edge
case.

## What's next

**Phase 4f** — Dashboard and global search. After that, Phase 5 (Tiptap
rich-text editor for descriptions/notes/content fields) and Phase 6
(deploy to Vercel + production OAuth).

We are 6 of 7 features done. Big stretch coming up.
