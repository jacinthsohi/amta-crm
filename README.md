# AMTA CRM

Internal CRM for the American Mock Trial Association.

React 18 + TypeScript + Vite + Tailwind · React Router v6 ·
TanStack Query · Supabase · Tiptap · lucide-react · DOMPurify.

## Setup guides

- ✅ Phase 1 — Database
- ✅ Phase 2 — Project skeleton
- ✅ Phase 3 — Auth
- ✅ Phase 4a–f — All entities, dashboard, search
- ✅ Phase 5 — Tiptap rich-text editor
- ⬅ **Phase 6 — Deploy to production** (`PHASE_6_SETUP.md`) — you are here

## Quick start (local development)

```bash
npm install
npm run dev
```

Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
See `.env.example`.

## Production

Production runs at `crm.mocktrial.tech`. To deploy changes:

1. Commit changes to the `main` branch on GitHub
2. Vercel auto-deploys (1–2 minutes)
3. Verify the change works on the production URL

For database changes, write a new SQL migration in `supabase/migrations/`,
test it locally against the dev Supabase project, then run it on the
production Supabase project via the SQL editor.

## Folder structure

```
amta-crm/
├── supabase/migrations/    SQL migrations, run in order
├── src/
│   ├── App.tsx             Routes
│   ├── main.tsx, index.css
│   ├── lib/                supabase, auth, errors, format helpers
│   ├── components/         Reusable UI (Avatar, Tag, Section, etc.)
│   └── features/
│       ├── auth/           Login, accept invitation flow
│       ├── admin/          Invitations management
│       ├── layout/         AppLayout shell, Sidebar
│       ├── dashboard/      Home page with stats and 4 cards
│       ├── search/         Cmd+K global search
│       ├── legal/          Public privacy policy
│       ├── contacts/       The big one — list, detail, 5 forms
│       ├── programs/       Member institutions
│       ├── committees/     Hierarchy of board committees
│       ├── events/         Tournaments and board meetings
│       ├── projects/       Initiatives and goals
│       ├── tasks/          Action items
│       └── interactions/   Polymorphic activity log
├── vercel.json             SPA routing for Vercel
└── .env                    Local secrets (not committed)
```

## Keyboard shortcuts

- **Cmd+K** (or **Ctrl+K**) — open the global search palette
- **Cmd+Enter** — save the currently-open form
- **Esc** — close the open modal/palette/form (with dirty-check)

Inside the rich-text editor:
- **Cmd+B**, **Cmd+I** — bold, italic
- **Cmd+Z**, **Cmd+Shift+Z** — undo, redo
- **Cmd+Shift+V** — paste as plain text

## Support

Operational questions: help@collegemocktrial.org
