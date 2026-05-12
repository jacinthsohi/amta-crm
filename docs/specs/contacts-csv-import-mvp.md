# Contacts CSV Import — MVP Spec

**Status:** Draft, pre-build
**Author:** Jacinth Sohi (drafted with Claude)
**Date:** May 12, 2026
**Estimated build:** 2.5–3 hours focused

---

## Why

The CRM has 484 programs but only 59 contacts. Real organizational data
(judges, alumni, coaches, donors) lives in spreadsheets that admins maintain
outside the CRM. Without a bulk import flow, populating the CRM is one-by-one
manual entry — which is why it hasn't happened.

This MVP gets a real CSV import shipped so admins can populate the CRM in
realistic batches. The first concrete use case: importing ~100 judges for the
Claremont Regional Event, tagging them as "Judge" and associating them with
that event in one flow.

This also unblocks downstream features that depend on populated data — the
KPI dashboard, the heatmap, and meaningful filter/sort behavior.

---

## What we're building

A CSV import flow at `/contacts/import` with:

1. File upload (drag/drop or click-to-pick)
2. Column mapping — admin maps CSV columns to contact fields
3. Bulk options — tag all imported contacts with a category, optionally
   associate them all with an event
4. Validation + preview before commit
5. Submit with row-level error reporting
6. Result screen with imported/skipped/errored counts

---

## What we're explicitly NOT building

- **Fuzzy dupe detection.** Only exact email match is checked. Same person
  with different emails, name typos, etc. are out of scope. See backlog
  item "Admin data-cleanup / dupe-merge tool" for the real fix.
- **Smart column auto-detection.** Admin picks the mapping manually.
- **Multi-field collapsing.** If the source CSV has e.g. firm_name + practice_area + years_experience that should become one notes field, admin
  collapses in Excel before upload.
- **Update flow for existing contacts' core fields.** If an email matches an
  existing contact, we add the new category/event association but do NOT
  update name/phone/notes on the existing record. Avoids overwrite surprises.
- **Async/background imports.** All processing happens client-side in the
  browser session. Synchronous submit, wait for result.

---

## Design decisions

### Decision 1: Exact email dupes are additive, not errors

If a CSV row's email matches an existing contact:
- Do NOT create a new contact
- DO add the selected category to the existing contact (if not already)
- DO add the existing contact to the selected event (if not already)
- Surface in the result screen as "Already existed: added category/event"
  — not as an error

Rationale: the typical case is "this judge is already in the system as an
alumna and now they're also judging Claremont." Skipping them entirely
would mean missing the event association, which is the whole point of the
import.

### Decision 2: 500-row cap per import

Soft cap of 500 rows per CSV. If the file has more, show error: "Please
split your file into batches of 500 rows or fewer."

Rationale: keeps the import synchronous and feedback fast. Browser memory
and Supabase round-trip patterns get awkward beyond this scale, and we
don't have a real use case for 1000+ at once. Real estimated max: ~100
judges per regional event, 484 programs total → 500 covers any realistic
batch.

### Decision 3: Position field for event association defaults to "Judge"

When admin checks "Add all to event," a text input appears with default
value "Judge". Admin can override per import.

Rationale: matches the primary use case (judges to events) without
forcing it. The position field on event_staff is unconstrained text,
so this stays flexible.

### Decision 4: Two distinct buttons on /contacts (not dropdown)

"Import CSV" and "Export CSV" sit side by side on the contacts list page.
No dropdown / split button.

Rationale: discoverability over compactness. Both actions are equally
important; hiding one behind a chevron hurts UX.

### Decision 5: Column mapping is explicit, not auto-detected

Admin picks which CSV column maps to first_name, last_name, etc. via
dropdowns. We don't try to auto-detect based on header names.

Rationale: real CSVs have inconsistent headers ("First Name" vs "first_name"
vs "fname"). Auto-detection works most of the time and fails the rest of
the time silently. Explicit mapping is one extra click but always correct.
We can add "auto-suggest based on header name" later as a nicety.

---

## User flow

### Step 1: Entry point

On `/contacts` list page, add an "Import CSV" button next to the existing
"Export CSV" button. Both buttons live in the page header area.

Click "Import CSV" → navigate to `/contacts/import`.

### Step 2: Upload

`/contacts/import` page renders:
- Heading: "Import contacts from CSV"
- Subtext: "Upload a CSV to bulk-add contacts. Max 500 rows per file."
- Drag-and-drop zone, also clickable to open file picker
- Helper text below: "CSV should have a header row. Columns can be in any
  order — you'll map them in the next step."
- Cancel button → back to /contacts

On file select:
- Parse CSV in browser via `papaparse`
- If file exceeds 500 rows: show error, stay on upload step
- If file is empty or malformed: show error, stay on upload step
- If parse succeeds: advance to step 3

### Step 3: Column mapping + bulk options

Two sections side by side or stacked:

**Left/top — Column mapping:**

For each contact field (first_name*, last_name*, email*, phone, notes),
render a dropdown labeled with the field name. The dropdown options are
the CSV's column headers, plus a "— None —" option.

Required fields marked with *. Admin must map first_name, last_name, email.
Phone and notes are optional (leave as "— None —" if not in the CSV).

**Right/bottom — Bulk options:**

- Section heading: "Apply to all imported contacts"
- Multi-select: "Tag as category: [Alumni / Coach / Donor / Judge / Community Volunteer]"
  - Pulled from `active_contact_categories`
  - Can pick multiple (e.g. "Judge" AND "Coach")
  - Can leave empty (no tags applied)
- Checkbox: "Also add to an event"
  - When checked, reveals:
    - Event dropdown (active events, sorted by date)
    - Position text input, default "Judge"

**Preview section below:**

Show first 5 rows of the CSV, with the columns highlighted/colored according
to the mapping. Helps admin verify they mapped correctly before submitting.

**Action buttons at bottom:**

- "Back" → return to step 2
- "Import N contacts" (disabled if required fields not mapped) → step 4

### Step 4: Processing

Loading screen with progress: "Importing… 47 of 100." Show the progress so
admin knows something is happening for larger imports.

For each CSV row (sequentially or in small parallel batches):
1. Validate row: required fields present, email format valid
2. If invalid: collect as error row, skip
3. Check for existing contact by exact lowercase email match
4. If exists:
   - Add selected categories to existing contact (skip already-assigned)
   - Add to event via event_staff if event selected (skip if already there)
   - Track as "updated"
5. If new:
   - Insert into contacts
   - Insert category_assignments for each selected category
   - Insert event_staff row if event selected
   - Track as "imported"

### Step 5: Result screen

Heading: "Import complete"

Three stat cards:
- ✅ **Imported as new:** N
- ↻ **Updated existing:** N (with category/event added)
- ⚠️ **Errored:** N (skipped)

If errors exist, list them in a table:
- Row number
- Name (if parseable)
- Reason ("Missing email", "Invalid email format", "Database error: <msg>")

Bottom actions:
- "Done — back to contacts"
- "Import another file" → step 1

---

## Data model implications

No schema changes required. Uses existing tables:
- `contacts` (insert)
- `contact_category_assignments` (insert)
- `event_staff` (insert)
- `contact_categories` (read, for the category dropdown)
- `active_events` (read, for the event dropdown)

Duplicate check uses `contacts.email` (case-insensitive). Already has
practical uniqueness, but worth noting: schema doesn't enforce a UNIQUE
constraint on email today. Two contacts can technically share an email.
Out of scope for this MVP to enforce that — flagging for future.

---

## Out-of-scope but worth backlogging

1. **Smart column auto-detection.** Suggest mappings based on header names.
2. **Validate-only mode.** Run the import, but don't write — show what
   would happen. Useful for big imports.
3. **Update existing contact's core fields.** Currently we only add
   categories/events to existing contacts. Updating their name/phone/notes
   could be useful but is overwrite-risky.
4. **Import entry point from an Event page.** "Add judges" button on
   `/events/:id` that pre-selects that event. Logical extension; pure UX
   improvement.
5. **Re-runnable / undoable imports.** Track import batches so an admin
   can review or roll back an import.
6. **Async / background imports.** For files > 500 rows. Requires queue
   infrastructure we don't have.

---

## Open questions (need answers before build)

1. **What's the actual category list?** Pulled from `active_contact_categories`
   at runtime, but worth confirming the values match what the CSV import UI
   expects. Specifically: is "Judge" the exact case-sensitive name? (We saw
   it referenced as "Judge" in ContactsListPage.tsx filter.)
2. **Are events filtered to upcoming only, or all events?** Probably upcoming
   + recent past (within 30 days?) so you can still add judges to an event
   that just happened. Confirm with Jacinth.
3. **What's the existing pattern for `papaparse` in the codebase?** If
   it's already a dep, great. If not, we add it.

---

## Acceptance criteria

This ships when:
- [ ] /contacts has an "Import CSV" button next to "Export CSV"
- [ ] /contacts/import renders a working three-step flow
- [ ] A 100-row CSV with valid data imports successfully, with all rows
      tagged with the chosen category
- [ ] A CSV with one duplicate email correctly updates the existing
      contact (adds category) rather than creating a duplicate
- [ ] A CSV with one invalid row (missing email) imports the valid rows
      and surfaces the bad row as an error
- [ ] A CSV with > 500 rows is rejected with a clear message
- [ ] Selecting an event during import creates event_staff rows for
      every imported contact

---

## After ship

Next session: use this to import the real judges CSV for Claremont Regional.
That tests the feature end-to-end with real data and unblocks the judge-event
relationship use case Jacinth identified.
