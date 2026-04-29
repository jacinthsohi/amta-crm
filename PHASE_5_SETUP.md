# Phase 5 Setup Guide — Tiptap Rich-Text Editor

Goal: every "long text" field in the CRM gains a real editor. Bold,
italic, lists, links, headings, blockquotes — all the formatting you'd
want in meeting notes or a project description. Plain text comes in,
HTML goes out, sanitization on render.

No SQL changes. No data migration. Just code + new dependencies.

## What you'll do

1. Drop in the new code
2. Run `npm install` — Tiptap and DOMPurify get pulled in
3. Restart the dev server
4. Verify the editor works in all 7 places

---

## Step 1 — Replace project files

Same as before, with one important difference: **don't skip `npm install`
this time.** This phase adds new dependencies.

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

That `npm install` will fetch the new packages: `@tiptap/react`,
`@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`,
`@tiptap/pm`, `dompurify`, and `@types/dompurify`. About 200kb gzipped
total — small for a real editor.

If you hit the loading hang:

```js
Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
location.reload();
```

## Step 2 — No database changes

The existing `text` columns in Postgres store HTML now instead of
plain text. Same column type, same length limits — just richer content.
Existing plain-text data still renders fine because Tiptap wraps each
line in `<p>` tags automatically.

## Step 3 — Verify the editor

Sign in. Pick any contact and click **Edit** to open ContactForm.

Scroll to the **Notes** field. Instead of a plain textarea, you should
see:

- A **toolbar row** at the top with icon buttons: Bold, Italic, Strike,
  Code, Heading 2, Heading 3, Bullet list, Numbered list, Blockquote,
  Link, Undo, Redo
- An **editing area** below it where you can type
- The whole thing has a focus ring in maroon when you click inside

**Try it:**

1. Type a sentence
2. Select some text and click **Bold** — it goes bold
3. Press Enter twice and click **Bullet list** — start a list
4. Type a bullet, press Enter for another, press Enter twice to exit
5. Click **Link** — a prompt appears asking for a URL. Type
   `amta.org` (no protocol needed — it'll auto-prepend `https://`)
   and press OK. The selected text becomes a maroon link.
6. Click **Save**

Now go back to the contact's detail page. Scroll to **Notes** and you
should see the formatted text — bold rendered as bold, the bullet list
properly bulleted, the link in maroon, etc.

### The full list of fields that got the editor

- **Contacts** → Notes
- **Programs** → Notes
- **Committees** → Description
- **Events** → Description **and** Notes (both fields)
- **Projects** → Description
- **Tasks** → Description (rows=2, smaller editor since tasks are usually short)
- **Interactions** → Notes (`content` field) — this is the big one,
  meeting notes finally have proper formatting

### What stayed plain text (intentional)

The inline forms — **board terms, officer terms, committee assignments,
program affiliations, event hosts, event staff, event documents** —
still use plain `<textarea>` for their notes/description fields.
These are usually short one-liners ("elected to fill X seat", etc.) and
the editor would feel heavy. We can swap later if you want.

### Existing legacy data

Any notes/descriptions you typed in earlier phases are plain text in the
database. When you load them now, Tiptap wraps them in `<p>` tags and
they render fine. Re-save a record and it'll be stored as proper HTML.

### List pages and search

- **Interactions list** preview text strips HTML to plain text so the
  table row stays compact
- **Projects list** description preview does the same
- **Cmd+K search** also strips HTML when building the searchable text,
  so searching for "p" doesn't match every paragraph tag

If all the above works, **Phase 5 is done.** 🎉

Just **Phase 6 — deploy** remains.

## Things still pending (expected)

- **Inline edit on legacy inline records** — board terms, etc. still
  create-only. Click navigates.
- **Production deploy** — you're still on `localhost:5173`. Phase 6
  ships to Vercel + production Supabase + verified Google OAuth.
- **Restore UI for soft-deleted records** — admin-accessible page to
  view and restore. Punted to post-launch.

## Troubleshooting

### "Loading editor..." stuck
Tiptap takes a tick to initialize. If it hangs more than a second,
check DevTools console for errors. Most likely cause: `npm install`
didn't pick up the new packages. Try `npm install` again.

### Text appears but no toolbar
The toolbar lives at the top of every `RichTextEditor`. If you don't
see it, the CSS may not have hot-reloaded. Hard refresh.

### Existing notes show with `<p>` tags as literal text
Means the field is rendering as plain text, not via `RichTextDisplay`.
Tell me which entity and I'll check that detail page.

### Link button does nothing
The link UX uses a `window.prompt()` for the URL — some browsers block
this if you click too fast. Try again, slowly.

### Pasted text looks weird (extra spaces, weird line breaks)
Tiptap's default paste handler tries to preserve formatting from the
source. If you copy from Google Docs you may get unexpected styling.
Use **Cmd+Shift+V** to paste as plain text.

### Saved text has tons of `<br>` tags
Tiptap converts hard line breaks into `<br>` tags inside paragraphs.
This is correct HTML behavior. Render looks fine.

### Editor toolbar wraps onto two lines on a narrow side panel
Expected — the toolbar is responsive and wraps. Looks fine on
narrow viewports. Only happens at very small widths.

## What's next

**Phase 6 — Deploy.** This is the last phase. We push the code to
GitHub, deploy to Vercel, set up a production Supabase project,
configure proper Google OAuth (move from Testing to Production), and
hand the URL to the AMTA board.

A few things to think about for Phase 6:
- Do you want a custom domain (like `crm.amta.org`)? Or `.vercel.app`
  for now?
- Should we set up Vercel preview deployments for future iterations?
- Privacy policy URL needed for Google OAuth verification — do we
  have one or do we need to create a basic one?

Tell me how Phase 5 verification goes and we'll plan Phase 6 details.
