# Phase 4c Setup Guide — Programs and Committees

Goal: programs and committees go from "Coming soon" placeholders to fully
working list/detail/form pages with all the same affordances as contacts.
You can also add affiliations and committee assignments **from the entity
side** (not just from the contact side).

This is a smaller setup than 4b — no SQL changes, no new dependencies.
Just code drop and restart.

## What you'll do

1. Drop in the new code (preserve `.env`, `.git`, `node_modules`)
2. Restart the dev server
3. Verify programs and committees flows work

---

## Step 1 — Replace project files

Same approach as before. The simplest path:

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

If you hit the loading screen again, paste this in DevTools console:

```js
Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
location.reload();
```

## Step 2 — No database changes

Phase 4c doesn't touch Supabase. Your seeded programs and committees are
already in place from 4b-i.

## Step 3 — Verify

Sign in to the app.

### Programs

Click **Programs** in the sidebar. You should see:

- Page header with "Programs" title and "New program" button
- Search box and filter pills (All / Active / Inactive)
- A table with all 8 seeded programs (Yale, Stanford, UVA, Rhodes, UCLA,
  UChicago, Northwestern, Tufts)
- Each row showing name, short name, location, joined year, and status

**Try:**
- Click any program (e.g. Yale) → detail page opens
- The hero shows the program's name, location, website (clickable, opens
  in new tab), joined year, and status
- Below that, a **People** section grouped by Coaches / Current students
  / Alumni / Advisors (depending on what's seeded)
- Click any person → navigates to their contact detail
- Click **Edit** → form opens pre-filled. Try changing the notes →
  Save. Update should reflect immediately.
- From the People section, click **Add affiliation** → form opens with
  the program **locked** and a contact picker. Pick a contact, enter
  start year → Add. The new affiliation appears in the right group.
- Try create flow: Programs → New program → fill in name + short name
  → Create. You should auto-navigate to the new program's detail page.

### Committees

Click **Committees** in the sidebar. You should see:

- Page header with "Committees" title and "New committee" button
- Search box
- A **tree-style layout** with parent committees at the top (e.g.
  Executive Committee, Tournament Administration Committee) and the
  3 subcommittees nested under Tournament Administration with a slight
  indent.
- Tag indicators: "Executive" maroon tag for the Executive Committee,
  "Inactive" gray tag if any are inactive.

**Try:**
- Click "Tournament Administration Committee" → detail page
- Hero shows name + status; below that, the description
- **Members** section sorts chairs first, then alphabetically. Maroon
  "Chair" tag for chairs.
- Click any member → contact detail
- **Subcommittees** section shows the 3 nested ones. Click one →
  navigates to that subcommittee's detail
- That subcommittee's hero shows "Subcommittee of Tournament
  Administration Committee" with a clickable link back up
- Breadcrumb at the top reflects the hierarchy: Committees ›
  Tournament Administration Committee › Host Recruitment & Selection
- Click **Edit** on any committee → form opens pre-filled, try
  changing the description → Save
- From the Members section, click **Add member** → form opens with the
  committee **locked** and a contact picker. Pick someone, enter
  position → Add.
- Try create flow: Committees → New committee → fill in name → Create

### Cross-entity navigation

The app should now feel "connected" — try this end-to-end flow:

1. Click any contact who has committee assignments (e.g. Justin
   Bernstein has Development + Rules, IP & Ethics + Executive)
2. In the Committee Assignments section, click any committee → goes
   to that committee's detail page
3. From there, click any member → goes to that contact's detail page
4. From there, click any program in their affiliations → goes to that
   program's detail page

Every link works. Every back button takes you up the hierarchy.

If all of this works, **Phase 4c is done.** 🎉

## Things that still don't work yet (expected)

- **Hosted events** on a program's detail page → placeholder until
  Phase 4d
- **Projects** on a committee's detail page → placeholder until
  Phase 4e
- **Editing existing affiliations / assignments** — clicking a row
  navigates to the linked entity (intentional). Inline edit comes in
  a polish pass.

## Troubleshooting

### Programs/committees lists are empty
The seeded data should have populated them. Check Supabase Table
Editor → `programs` (should have 8 rows) and `committees` (should have
10 rows). If empty, re-run the seed migration.

### "Add affiliation" / "Add member" picker shows no contacts
Means the contacts query failed. Check Network tab for failing
requests, or refresh the page.

### Tree layout looks wrong (subcommittees not nested)
Check that the subcommittees in your `committees` table actually have
`parent_committee_id` set. Open Supabase Table Editor → committees,
look at the "Host Recruitment & Selection" row, confirm its
`parent_committee_id` matches the Tournament Administration Committee's
`id`.

### Console shows React Router warnings
These should be gone now that we opted into the v7 future flags. If
you still see them, hard reload (Cmd+Shift+R).

## What's next

Phase 4d — Events. The biggest entity in terms of sub-records:
hosts, staff, documents, plus the unified tournament/board-meeting
structure. We'll port it next, then 4e (projects, tasks, interactions),
then 4f (dashboard + global search) wraps up Phase 4.

Ping me when 4c is working.
