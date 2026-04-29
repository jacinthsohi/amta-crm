# Phase 4b-ii Setup Guide — Contacts (mutations)

Goal: contacts go from read-only to fully manageable. You can create new
contacts, edit existing ones, soft-delete them, and add board terms,
officer terms, committee assignments, and program affiliations to anyone.

This is the smallest setup of any phase so far — no SQL changes, no new
dependencies. Just code drop and restart.

## What you'll do

1. Drop in the new code (preserve `.env`, `.git`, `node_modules`)
2. Restart the dev server
3. Verify the form flows work

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

(As before, the lazier alternative is to just delete `~/Code/amta-crm`
entirely, recreate it, copy in the new files, recreate `.env` from
`.env.example`, and run `npm install`. Slightly slower but harder to
mess up.)

## Step 2 — No database changes

Phase 4b-ii doesn't touch Supabase. No SQL to run, no auth changes. The
data model from Phase 1 already supports all the new mutations.

## Step 3 — Run

```
npm run dev
```

If you get the same "Loading…" hang, paste this in DevTools console once
and reload:

```js
Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
location.reload();
```

## Step 4 — Verify the form flows

### Create a new contact

1. Click **Contacts** in the sidebar.
2. Click **New contact** at the top right.
3. A side panel slides in from the right.
4. Fill in:
   - First name, Last name (required — Save button stays disabled until both are filled)
   - Email (optional but validated if you type one)
   - Phone (optional)
   - Categories — try typing "Volunteer" and pressing Enter; you'll see
     a "Create 'Volunteer'" option. Click it. The new category gets
     created in your database and tagged on this contact.
   - Notes (optional)
5. Click **Create contact** (or press Cmd+Enter).
6. The panel closes. The browser navigates you to the new contact's
   detail page automatically.

### Edit an existing contact

1. Click **Edit** in the hero of any contact's detail page.
2. The panel opens pre-filled with the contact's data.
3. Change anything — categories, notes, phone, etc.
4. Click **Save**.
5. The panel closes. The detail page updates with your changes.

### Soft-delete a contact

1. From an existing contact's detail page, click **Edit**.
2. In the form's footer, on the left side, you'll see a red **Delete**
   button.
3. Click it. A confirmation dialog appears.
4. Confirm. The contact gets soft-deleted (its row stays in the
   database with `deleted_at` set, but the app hides it from all views).
5. You're routed back to `/contacts` and the contact no longer appears
   in the list.

To restore a soft-deleted contact you'd need SQL (the Restore UI ships
later). Open Supabase Table Editor → `contacts`, find the row, set its
`deleted_at` back to `null`.

### Add a board term

1. From any contact's detail page, in the **Board Terms** section,
   click **Add term**.
2. Pick the type (First-Year Candidate / Second-Year Candidate / Voting
   Director).
3. Enter the election year.
4. Optionally enter start and end dates.
5. Click **Add term**.
6. The panel closes and the new term appears in the section.

You'll also notice that adding a board term to a contact who didn't
previously have any sets their `has_board_history` field to `true`
automatically (via the database trigger we set up in Phase 1). The
list page will show them with the appropriate status if they're also
in the "Current Board Member" category.

### Add an officer term

1. In the **Officer Terms** section, click **Add term**.
2. Pick the role (President, President-Elect, Past President,
   Secretary, Treasurer).
3. Enter a start date (required — officer roles have specific start
   dates).
4. Optionally enter an end date.
5. Click **Add term**.

### Add a committee assignment

1. In the **Committee Assignments** section, click **Add assignment**.
2. Pick a committee from the dropdown (it'll show all 10 committees,
   including the 3 subcommittees of Tournament Administration).
3. Enter a position — common values are "Member", "Chair",
   "Co-Chair", "Lead". The field is free-text.
4. Optionally enter start and end dates.
5. Click **Add assignment**.
6. After saving, click the row to navigate to that committee's detail
   (still a placeholder until 4c, but the link works).

### Add a program affiliation

1. In the **Program Affiliations** section, click **Add affiliation**.
2. Pick a program from the dropdown.
3. Pick the type (Student / Alumni, Coach, or Advisor).
4. Enter start year (required).
5. Optionally enter end year.
6. Click **Add affiliation**.

If you see all of this work, **Phase 4b-ii is done.** 🎉

## Things to try if you're feeling thorough

- **Cmd+Enter to save**: in the ContactForm, fill in some fields then
  press Cmd+Enter. It should save without you needing to click the
  button.
- **Esc to cancel**: open any form, type something to make it dirty,
  press Esc. You'll get a "discard unsaved changes?" prompt.
- **Click outside the panel**: same — backdrop click is treated as
  cancel.
- **Delete a recently-created category**: open a contact, click Edit,
  remove the new "Volunteer" category by clicking its X. Save. The
  category is removed from this contact (but the category itself still
  exists in the database — that's intentional, since it might be on
  other contacts too).
- **Edit a contact's standing**: in the form, the "Board standing"
  pill picker appears for contacts who have board history. Try
  toggling it.

## Troubleshooting

### "Save" button stays disabled
You haven't filled in both first name and last name. Those are
required.

### "Doesn't look like a valid email"
Email format is checked when provided. Either enter a valid email or
leave the field blank.

### "Could not save: ..."
Check the error message — most likely a Supabase connectivity issue or
a constraint violation. If it says something about a duplicate email,
that's because partial unique constraints don't allow two non-deleted
contacts to share an email.

### Form panel doesn't close after Save
The mutation is still pending. Wait a moment. If it stays pending for
more than a few seconds, check DevTools → Network for failing
requests.

### Deleted a contact accidentally
Open Supabase **Table Editor → contacts**, find the row with the matching
name, set its `deleted_at` field back to `null`, save. They'll reappear
in the app on next refresh.

### "Edit" button on the contact detail page does nothing
This means the form isn't getting the contact data. Hard-reload (Cmd+
Shift+R) and try again. If it persists, paste me the browser console
errors.

## What's next

Phase 4b is now complete. Next stop: **Phase 4c — Programs and
Committees**. Each gets the same treatment: a list page, a detail page,
a form for create/edit/delete. The pattern's been validated by 4b-ii so
4c will go faster.

Ping me when contacts are working and we'll start 4c.
